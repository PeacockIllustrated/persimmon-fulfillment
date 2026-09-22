#!/usr/bin/env python3
"""Turn an order into a print-ready artwork pack.

    build_pack.py PER-20260914-J5NO
    build_pack.py PER-20260914-J5NO --resolve-only
    build_pack.py --outstanding --apply

One page per line item, at that sign's true print size, each labelled by how it
was obtained. Until now this existed only as a session's worth of ad-hoc steps,
so the J5NO pack could be produced once and never reproduced.

The stages are separable on purpose. Resolving an order reads nothing but the
library JSON, so ``--resolve-only`` answers "what would this order take?" on any
machine, with no browser, no renderer and no database credentials. Everything
that needs Chromium or node sits behind that line.

Provenance, which every page carries:

    LIBRARY     lifted from artwork we hold, cropped or scaled to the size ordered
    MERGED      a personalised template redrawn with this order's own text
    GENERATED   drawn to the house style because we hold nothing
    BLOCKED     artwork found, but its logo is another housebuilder's
    UNRESOLVED  nothing to work from

Nothing here guesses. A sign that cannot be placed is reported by name and left
out of the pack: a missing sign is a phone call, a wrong sign on a hoarding is a
reprint and a site visit.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field, asdict
from pathlib import Path

from pypdf import PdfReader, PdfWriter, Transformation

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import sign_templates as T                      # noqa: E402
from page_fit import MM, fit, page_mm, target_mm  # noqa: E402
from palette import normalise_page              # noqa: E402

LIBRARY_PATH = REPO_ROOT / "shop" / "data" / "artwork-library.json"
LOGO_BAND_PDF = HERE / "assets" / "logoband_78.pdf"

# The five states an order moves through once it is ours to artwork. Mirrored in
# shop/supabase-setup.sql -- change both together.
FULFILMENT_STATES = ("pending", "resolving", "proof_ready", "approved", "packed")

# Confirmed from the catalogue image, not invented. See the README.
HOUSE_HOURS = [
    "Monday - Friday",
    "8:00am - 5:30pm",
    "Saturday",
    "8:00am - 1:00pm",
]


# ---------------------------------------------------------------------------
# What we can draw
# ---------------------------------------------------------------------------

def _field(merge: dict, *names: str) -> str:
    """First custom field present under any of these keys.

    The shop has renamed fields over time -- PCFA107 has shipped with both
    ``emergency_contact`` and ``emergency_contact_number`` -- so a generator
    asks for every spelling it has seen rather than silently drawing a board
    with a blank phone number on it.
    """
    for name in names:
        if merge.get(name):
            return str(merge[name])
    return ""


# base code -> (width_mm, height_mm, merge fields) -> HTML for one sign.
GENERATORS = {
    "PCF03":   lambda w, h, m: T.working_hours(w, h, HOUSE_HOURS),
    "PCF114":  lambda w, h, m: T.green_on_white(w, h, _field(m, "custom_text")),
    "PCF144":  lambda w, h, m: T.pedestrians_ahead(w, h),
    "PCF151":  lambda w, h, m: T.site_organisation(w, h),
    "PCF350":  lambda w, h, m: T.parking_left(w, h),
    "PCFA107": lambda w, h, m: T.compound_board(
        w, h,
        _field(m, "site_name"),
        _field(m, "site_managers_name", "site_manager"),
        _field(m, "emergency_contact", "emergency_contact_number"),
    ),
}


# ---------------------------------------------------------------------------
# Reading the order
# ---------------------------------------------------------------------------

ORDER_SELECT = (
    "order_number,po_number,status,fulfilment_status,site_name,contact_name,"
    "created_at,psp_order_items(code,base_code,name,size,material,quantity,custom_data)"
)


def _env() -> dict[str, str]:
    from artwork_library import load_env
    return load_env()


def fetch_orders(order_numbers: list[str] | None,
                 outstanding: bool,
                 from_file: str | None) -> list[dict]:
    """Orders to work, from the database or a previously exported file."""
    if from_file:
        data = json.loads(Path(from_file).expanduser().read_text())
        rows = data["orders"] if isinstance(data, dict) else data
        if order_numbers:
            wanted = {n.upper() for n in order_numbers}
            rows = [r for r in rows if r["order_number"].upper() in wanted]
        elif outstanding:
            # An export predating the column: fall back to the order's own
            # status, which is the same set the migration backfills from.
            rows = [r for r in rows
                    if (r.get("fulfilment_status") or
                        ("packed" if r.get("status") == "completed" else "pending"))
                    == "pending"]
        return rows

    import requests
    env = _env()
    headers = {
        "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
        "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}",
    }
    params = {"select": ORDER_SELECT, "order": "created_at.desc"}
    if order_numbers:
        joined = ",".join(n.upper() for n in order_numbers)
        params["order_number"] = f"in.({joined})"
    elif outstanding:
        params["fulfilment_status"] = "eq.pending"
    resp = requests.get(f"{env['SUPABASE_URL']}/rest/v1/psp_orders",
                        headers=headers, params=params, timeout=60)
    resp.raise_for_status()
    return resp.json()


def set_fulfilment_status(order_number: str, status: str) -> None:
    """Move one order along. Only ever called under --apply."""
    if status not in FULFILMENT_STATES:
        raise ValueError(f"{status!r} is not one of {FULFILMENT_STATES}")
    import requests
    env = _env()
    resp = requests.patch(
        f"{env['SUPABASE_URL']}/rest/v1/psp_orders",
        headers={
            "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
            "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        params={"order_number": f"eq.{order_number}"},
        json={"fulfilment_status": status},
        timeout=30,
    )
    resp.raise_for_status()


def merge_fields(item: dict) -> dict:
    """The order's own text for this line, flattened to key -> value."""
    custom = item.get("custom_data")
    if not isinstance(custom, dict):
        return {}
    return {f["key"]: f.get("value", "")
            for f in custom.get("fields", []) if f.get("key")}


# ---------------------------------------------------------------------------
# Resolve -- one decision per line item, no I/O beyond the library
# ---------------------------------------------------------------------------

@dataclass
class Plan:
    code: str
    base_code: str
    name: str
    size: str | None
    qty: int
    provenance: str
    reason: str = ""
    source: str | None = None          # library file, relative to --artwork-root
    page: int | None = None
    scaled: bool = False
    merge: dict = field(default_factory=dict)
    fit_note: str = ""
    brand: str | None = None
    palette_changes: list[str] = field(default_factory=list)
    palette_flags: list[str] = field(default_factory=list)
    out: str | None = None

    @property
    def packable(self) -> bool:
        return self.provenance in ("LIBRARY", "MERGED", "GENERATED")


def index_library(library: dict) -> dict[str, dict]:
    """Variant code -> its record, with the entry's name folded in."""
    index = {}
    for entry in library["entries"]:
        for variant in entry["variants"]:
            index[variant["code"]] = {
                "baseCode": entry["baseCode"],
                "name": entry.get("name", ""),
                "personalised": entry.get("personalised", False),
                **variant,
            }
    return index


def resolve_item(item: dict, index: dict[str, dict], artwork_root: Path | None) -> Plan:
    """Decide how one line item becomes a page. First matching rule wins."""
    code = item["code"]
    base = item.get("base_code") or code.split("/")[0].split("-")[0]
    merge = merge_fields(item)
    plan = Plan(
        code=code, base_code=base, name=item.get("name", ""),
        size=item.get("size"), qty=int(item.get("quantity", 1)),
        provenance="UNRESOLVED", merge=merge,
    )

    generator = GENERATORS.get(base)

    # 1. Personalised lines can never be lifted. The layout is reusable, the
    #    text is not: library artwork for PCFA107 carries another site's manager
    #    and another site's phone number. Merge it or raise it.
    if merge:
        if generator:
            plan.provenance = "MERGED"
            plan.reason = "personalised -- template redrawn with this order's text"
        else:
            plan.reason = ("personalised, and no template to merge into -- "
                           "artwork held for this code belongs to another site")
        return plan

    # 2. Artwork we hold, at this size or scalable to it.
    record = index.get(code)
    if record:
        art = record.get("artwork", {})
        status = art.get("status")
        if status in ("ready", "ready-scaled") and art.get("file"):
            source = art["file"]
            exists = artwork_root is None or (artwork_root / source).exists()
            if exists:
                plan.provenance = "LIBRARY"
                plan.source = source
                plan.page = art.get("page")
                plan.scaled = status == "ready-scaled"
                plan.reason = ("held at this size" if status == "ready"
                               else f"scaled from {art.get('scaledFrom', 'another size')}")
                return plan
            plan.reason = f"library points at {source}, which is not under the artwork root"

    # 3. Nothing usable held -- draw it.
    if generator:
        plan.provenance = "GENERATED"
        plan.reason = (f"drawn instead: {plan.reason}" if plan.reason
                       else "no artwork held; drawn from the catalogue image")
        return plan

    plan.reason = plan.reason or "no artwork held and no house template for this code"
    return plan


def resolve_order(order: dict, index: dict[str, dict], artwork_root: Path | None) -> list[Plan]:
    return [resolve_item(item, index, artwork_root)
            for item in order.get("psp_order_items", [])]


# ---------------------------------------------------------------------------
# Node helpers -- rendering and the brand check
# ---------------------------------------------------------------------------

def node_dir(explicit: str | None) -> Path:
    """Where node_modules lives.

    Node resolves an ESM import by walking up from the *script's* own directory,
    not from the working directory, so the dependencies have to sit beside these
    scripts or above them. Anywhere else is silently invisible, which shows up
    as ERR_MODULE_NOT_FOUND on a path that plainly has node_modules in it.
    """
    allowed = [HERE, *HERE.parents]
    candidates = [explicit, os.environ.get("PERSIMMON_NODE_DIR"), str(HERE), str(REPO_ROOT)]
    for candidate in candidates:
        if not candidate:
            continue
        path = Path(candidate).expanduser().resolve()
        if (path / "node_modules").is_dir() and path in allowed:
            return path
    named = [c for c in (explicit, os.environ.get("PERSIMMON_NODE_DIR")) if c]
    hint = ""
    if named:
        hint = ("\n"
                f"{named[0]} was given, but node only looks for node_modules beside\n"
                "the script and in its parent directories, so it cannot be used from there.")
    raise SystemExit(
        "No usable node_modules found. Run `npm install` in scripts/fulfilment "
        "(playwright,\npdfjs-dist and @napi-rs/canvas), or install them at the "
        "repository root." + hint
    )


def run_node(script: Path, args: list[str], cwd: Path) -> str:
    result = subprocess.run(["node", str(script), *args], cwd=cwd,
                            capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(f"{script.name} failed:\n{result.stderr.strip()}")
    return result.stdout


def html_to_pdfs(jobs: list[dict], nd: Path) -> None:
    """jobs: [{html, out, w, h}] -- rendered at exact millimetres by Chromium."""
    if not jobs:
        return
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
        json.dump(jobs, fh)
        spec = fh.name
    try:
        run_node(HERE / "html2pdf.mjs", [spec], nd)
    finally:
        os.unlink(spec)


def classify_brands(targets: list[tuple[Path, int]], nd: Path) -> dict[tuple[str, int], str]:
    """Brand per (file, page). Only library pages need asking -- ours are ours."""
    if not targets:
        return {}
    args = [f"{path}#{page}" for path, page in targets]
    out = run_node(HERE / "brand.mjs", args, nd)
    return {(rec["file"], rec["page"]): rec.get("brand", "unknown")
            for rec in json.loads(out)}


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

def stamp_logo(page, width_mm: float, height_mm: float) -> None:
    """Lay the real vector lockup into the band the template reserved.

    The logo is never redrawn -- it is the housebuilder's mark, cropped once
    from production artwork as the top band of a sign and scaled to fit here.
    """
    if not LOGO_BAND_PDF.exists():
        return
    logo = PdfReader(str(LOGO_BAND_PDF)).pages[0]
    logo_w = float(logo.mediabox.width)
    scale = (width_mm * MM) / logo_w
    band_h = float(logo.mediabox.height) * scale
    page.merge_transformed_page(
        logo,
        Transformation().scale(scale, scale).translate(0, height_mm * MM - band_h),
    )


def build_generated(plans: list[Plan], work: Path, nd: Path) -> None:
    """Draw everything we hold nothing for, then stamp the logo on."""
    todo = [p for p in plans if p.provenance in ("MERGED", "GENERATED")]
    if not todo:
        return

    T.use_proof_logo()          # the band shows in the render; see below
    jobs = []
    for i, plan in enumerate(todo):
        want = target_mm(plan.size)
        if not want:
            plan.provenance = "UNRESOLVED"
            plan.reason = f"cannot read a print size from {plan.size!r}"
            continue
        w, h = want
        html = GENERATORS[plan.base_code](w, h, plan.merge)
        out = work / f"gen{i:02d}_{plan.code.replace('/', '-')}.pdf"
        plan.out = str(out)
        jobs.append({"html": html, "out": str(out), "w": w, "h": h})

    html_to_pdfs(jobs, nd)


def load_library_page(plan: Plan, artwork_root: Path, work: Path, index: int) -> None:
    """Lift one page out of held artwork and bring it to the ordered size."""
    src = artwork_root / plan.source
    reader = PdfReader(str(src))
    page_no = (plan.page or 1) - 1
    if not 0 <= page_no < len(reader.pages):
        plan.provenance = "UNRESOLVED"
        plan.reason = f"{plan.source} has no page {plan.page}"
        return

    writer = PdfWriter()
    writer.add_page(reader.pages[page_no])
    page = writer.pages[0]
    page, note = fit(page, plan.size, plan.scaled)
    plan.fit_note = note

    out = work / f"lib{index:02d}_{plan.code.replace('/', '-')}.pdf"
    with open(out, "wb") as fh:
        writer.write(fh)
    plan.out = str(out)


def build_library_pages(plans: list[Plan], artwork_root: Path | None, work: Path) -> None:
    for i, plan in enumerate(plans):
        if plan.provenance != "LIBRARY":
            continue
        if artwork_root is None:
            plan.provenance = "UNRESOLVED"
            plan.reason = "library artwork needs --artwork-root"
            continue
        load_library_page(plan, artwork_root, work, i)


def redraw_blocked(plans: list[Plan]) -> None:
    """A blocked page is still a sign the site needs.

    PCF151 is the case this exists for: the only board we hold is Charles
    Church branded, so the brand gate blocks it -- but we can draw the
    Persimmon one, panel for panel, and the order gets its sign. Blocking is
    about never *shipping* another housebuilder's board, not about refusing to
    supply the sign at all. Without this the order quietly arrives one page
    short of what was bought.
    """
    for plan in plans:
        if plan.provenance == "BLOCKED" and plan.base_code in GENERATORS:
            plan.provenance = "MERGED" if plan.merge else "GENERATED"
            plan.reason = f"redrawn in Persimmon branding: {plan.reason}"
            plan.source = plan.page = None
            plan.out = None


# ---------------------------------------------------------------------------
# Gates
# ---------------------------------------------------------------------------

def gate_brand(plans: list[Plan], nd: Path) -> None:
    """A Charles Church board on a Persimmon order is the one stop-the-line failure.

    Only library pages are asked: generated pages carry the lockup we stamped.
    An `unknown` answer is not a block -- the classifier declines to guess on a
    near-tie, and refusing to pack on "don't know" would block good artwork.
    """
    targets = [(Path(p.out), 1) for p in plans if p.provenance == "LIBRARY" and p.out]
    if not targets:
        return
    brands = classify_brands(targets, nd)
    for plan in plans:
        if plan.provenance != "LIBRARY" or not plan.out:
            continue
        plan.brand = brands.get((plan.out, 1), "unknown")
        if plan.brand == "charleschurch":
            plan.provenance = "BLOCKED"
            plan.reason = "artwork held for this code is Charles Church branded"


def gate_palette(plans: list[Plan], work: Path) -> None:
    """Bring every page onto the house palette, recording what moved."""
    for plan in plans:
        if not (plan.packable and plan.out):
            continue
        reader = PdfReader(plan.out)
        writer = PdfWriter()
        writer.add_page(reader.pages[0])
        changes, flags = normalise_page(writer.pages[0])
        plan.palette_changes, plan.palette_flags = changes, flags
        out = work / (Path(plan.out).stem + "_pal.pdf")
        with open(out, "wb") as fh:
            writer.write(fh)
        plan.out = str(out)


def gate_size(plans: list[Plan]) -> list[str]:
    """Every packed page is the size that was ordered, or it is reported."""
    problems = []
    for plan in plans:
        if not (plan.packable and plan.out):
            continue
        want = target_mm(plan.size)
        if not want:
            continue
        page = PdfReader(plan.out).pages[0]
        have = page_mm(page)
        if abs(have[0] - want[0]) > 2.0 or abs(have[1] - want[1]) > 2.0:
            problems.append(
                f"{plan.code}: page is {have[0]:.0f}x{have[1]:.0f}mm, "
                f"ordered {want[0]:.0f}x{want[1]:.0f}mm"
            )
    return problems


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def assemble(plans: list[Plan], out_pdf: Path) -> int:
    writer = PdfWriter()
    packed = 0
    for plan in plans:
        if not (plan.packable and plan.out):
            continue
        writer.add_page(PdfReader(plan.out).pages[0])
        packed += 1
    if packed:
        with open(out_pdf, "wb") as fh:
            writer.write(fh)
    return packed


def proof_sheet(plans: list[Plan], pack_pdf: Path, out_png: Path, nd: Path) -> bool:
    """Contact sheet: one labelled cell per packed page, in pack order."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return False

    pages_dir = out_png.parent / "_proof"
    pages_dir.mkdir(exist_ok=True)
    run_node(HERE / "packpng.mjs", [str(pack_pdf), str(pages_dir)], nd)
    shots = sorted(pages_dir.glob("page*.png"))
    if not shots:
        return False

    rows = [p for p in plans if p.packable and p.out]
    cols, cell, pad, cap = 3, 440, 26, 46
    grid = (len(shots) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (cell + pad) + pad,
                              grid * (cell + pad + cap) + pad), "white")
    draw = ImageDraw.Draw(sheet)
    try:
        bold = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15)
        plain = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 13)
    except OSError:
        bold = plain = ImageFont.load_default()

    for i, shot in enumerate(shots):
        img = Image.open(shot).convert("RGB")
        img.thumbnail((cell, cell))
        cx = pad + (i % cols) * (cell + pad)
        cy = pad + (i // cols) * (cell + pad + cap)
        draw.rectangle([cx - 1, cy - 1, cx + cell, cy + cell], outline="#DDDDDD")
        sheet.paste(img, (cx + (cell - img.width) // 2, cy + (cell - img.height) // 2))
        if i < len(rows):
            plan = rows[i]
            draw.text((cx, cy + cell + 6), f"{i+1}. {plan.code}  x{plan.qty}",
                      font=bold, fill="#111111")
            draw.text((cx, cy + cell + 24),
                      f"{plan.name[:40]}  ({plan.size}, {plan.provenance})",
                      font=plain, fill="#666666")
    sheet.save(out_png)
    return True


def manifest(order: dict, plans: list[Plan], packed: int, size_problems: list[str]) -> dict:
    return {
        "order": order["order_number"],
        "site": order.get("site_name"),
        "contact": order.get("contact_name"),
        "lineItems": len(plans),
        "pagesPacked": packed,
        "provenance": {p: sum(1 for x in plans if x.provenance == p)
                       for p in ("LIBRARY", "MERGED", "GENERATED", "BLOCKED", "UNRESOLVED")},
        "needsAttention": (
            [f"{p.code}: {p.reason}" for p in plans if not p.packable]
            + size_problems
            + [f"{p.code}: {p.fit_note}" for p in plans if "MISMATCH" in p.fit_note]
        ),
        "pages": [asdict(p) for p in plans],
    }


# ---------------------------------------------------------------------------
# One order, end to end
# ---------------------------------------------------------------------------

def report_plans(plans: list[Plan]) -> None:
    for plan in plans:
        print(f"  {plan.provenance:11} {plan.code:28} {plan.reason}")


def run_order(order: dict, index: dict[str, dict], args, nd: Path | None) -> dict:
    number = order["order_number"]
    artwork_root = Path(args.artwork_root).expanduser() if args.artwork_root else None
    plans = resolve_order(order, index, artwork_root)

    print(f"\n{number} -- {order.get('site_name', '?')} -- {len(plans)} line items")

    if args.resolve_only:
        report_plans(plans)
        return manifest(order, plans, 0, [])

    out_dir = Path(args.out).expanduser() / number
    out_dir.mkdir(parents=True, exist_ok=True)
    work = out_dir / "_work"
    work.mkdir(exist_ok=True)

    if args.apply:
        set_fulfilment_status(number, "resolving")

    # Library first, so the brand check has pages to look at; anything it
    # blocks is then redrawn before we render, and the whole lot is rendered
    # in one browser launch.
    build_library_pages(plans, artwork_root, work)
    gate_brand(plans, nd)
    redraw_blocked(plans)
    build_generated(plans, work, nd)
    gate_palette(plans, work)
    size_problems = gate_size(plans)

    # Printed now rather than at resolve time: the brand gate can turn a
    # library pull into a redraw, and showing the pre-gate verdict had the
    # console claiming LIBRARY for a board that was actually blocked and drawn.
    report_plans(plans)

    pack_pdf = out_dir / f"{number}-artwork.pdf"
    packed = assemble(plans, pack_pdf)
    report = manifest(order, plans, packed, size_problems)

    if packed:
        proof_sheet(plans, pack_pdf, out_dir / f"{number}-proof.png", nd)
    (out_dir / f"{number}-manifest.json").write_text(json.dumps(report, indent=2))

    where = pack_pdf if packed else "nothing packed"
    print(f"  -> {packed}/{len(plans)} pages  {where}")
    for note in report["needsAttention"]:
        print(f"     needs attention: {note}")

    if args.apply and packed == len(plans) and not report["needsAttention"]:
        set_fulfilment_status(number, "proof_ready")
    elif args.apply:
        # Something wants a human before this is worth proofing. Leave it
        # pending rather than claiming a proof is ready.
        set_fulfilment_status(number, "pending")

    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("orders", nargs="*", help="order numbers, e.g. PER-20260914-J5NO")
    parser.add_argument("--outstanding", action="store_true",
                        help="every order at fulfilment_status 'pending'")
    parser.add_argument("--artwork-root", help="folder holding the job folders")
    parser.add_argument("--out", default="out", help="where packs are written")
    parser.add_argument("--from-file", help="orders JSON export, instead of the database")
    parser.add_argument("--resolve-only", action="store_true",
                        help="decide and report; draw nothing")
    parser.add_argument("--apply", action="store_true",
                        help="move fulfilment_status as the pack is built")
    parser.add_argument("--node-dir", help="directory holding node_modules")
    args = parser.parse_args()

    if not args.orders and not args.outstanding:
        parser.error("name at least one order, or pass --outstanding")
    if args.apply and args.from_file:
        parser.error("--apply writes to the database; it cannot run from --from-file")

    library = json.loads(LIBRARY_PATH.read_text())
    index = index_library(library)
    orders = fetch_orders(args.orders or None, args.outstanding, args.from_file)
    if not orders:
        print("Nothing outstanding." if args.outstanding else "No such order.")
        return

    nd = None if args.resolve_only else node_dir(args.node_dir)
    reports = [run_order(order, index, args, nd) for order in orders]

    if len(reports) > 1:
        print(f"\n{len(reports)} orders")
        for report in reports:
            flag = "" if not report["needsAttention"] else \
                f"  ({len(report['needsAttention'])} need attention)"
            print(f"  {report['order']}  {report['pagesPacked']}/{report['lineItems']}{flag}")


if __name__ == "__main__":
    main()
