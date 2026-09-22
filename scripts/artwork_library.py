#!/usr/bin/env python3
"""
Artwork library builder for the Persimmon signage portal.

Purpose
-------
We make signs to order. Once a sign has been artworked it should never be
artworked again -- it belongs in a "ready made" library that future orders can
be auto-fulfilled from. This script builds and maintains that library.

Three subcommands:

  seed    Pull the full order history from Supabase and write
          shop/data/artwork-library.json -- one entry per base code, with every
          size/material variant we have ever actually sold, plus how often.
          This is the *candidate* list: every sign we have made at least once.

  match   Walk a folder of finished artwork (the "Persimmon App Jobs" folder),
          work out which order each subfolder belongs to, and map the files
          inside it to the line items on that order. Writes a reconciliation
          report and, with --apply, marks the matched variants as artworked in
          the library.

  report  Print library coverage, and optionally the pick list for one order
          (--order PER-YYYYMMDD-XXXX): what can be pulled from the library
          versus what still has to be made.

Folder matching is deliberately tolerant, because the folders were named by
hand. For each folder name it looks for, in order of confidence:
  1. a full order number      PER-20260914-J5NO
  2. an order number suffix   J5NO            (the "last 4")
  3. a purchase order number  798468          (matched against psp_orders.po_number)
  4. a site name              "Fairways 351"
Anything it cannot place with confidence is listed as unmatched rather than
guessed at, so a human can settle it.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import requests

import sign_reader

REPO_ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = REPO_ROOT / "shop" / ".env"
LIBRARY_PATH = REPO_ROOT / "shop" / "data" / "artwork-library.json"
REGISTRY_PATH = REPO_ROOT / "shop" / "data" / "artwork-registry.json"
CATALOG_PATH = REPO_ROOT / "shop" / "data" / "catalog.json"
OVERRIDES_PATH = REPO_ROOT / "shop" / "data" / "folder-overrides.json"

# Extensions we consider to be production artwork rather than a preview or note.
ARTWORK_EXTS = {".ai", ".eps", ".pdf", ".svg", ".cdr", ".dxf", ".plt"}
PREVIEW_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".tif", ".tiff"}

ORDER_NUMBER_RE = re.compile(r"PER-\d{8}-[A-Z0-9]{4}", re.I)
ORDER_SUFFIX_RE = re.compile(r"(?<![A-Z0-9])([A-Z0-9]{4})(?![A-Z0-9])", re.I)
PO_NUMBER_RE = re.compile(r"(?<!\d)(\d{5,8})(?!\d)")
# Product codes as they appear in the catalogue: PCF03, PCFA107, PA82PCF,
# PCFDWTP, optionally with a /SIZE suffix such as /M or /W.
PRODUCT_CODE_RE = re.compile(r"(?<![A-Z0-9])(P[A-Z]{0,3}\d{1,4}[A-Z0-9]*)(?:/([A-Z0-9]{1,7}))?", re.I)


# --------------------------------------------------------------------------
# Supabase access
# --------------------------------------------------------------------------

def load_env() -> dict[str, str]:
    """Read shop/.env into a dict. Environment variables win over the file."""
    env: dict[str, str] = {}
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip().strip('"').strip("'")
    for key in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
        if os.environ.get(key):
            env[key] = os.environ[key]
    missing = [k for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY") if not env.get(k)]
    if missing:
        sys.exit(f"Missing {', '.join(missing)} -- set them in the environment or shop/.env")
    return env


def fetch_orders(env: dict[str, str] | None, from_file: str | None = None) -> list[dict]:
    """Every order with its line items, newest first.

    Reads from a previously exported JSON file when --from-file is given, so the
    library can be rebuilt on a machine with no database credentials.
    """
    if from_file:
        data = json.loads(Path(from_file).expanduser().read_text())
        return data["orders"] if isinstance(data, dict) else data

    env = env or load_env()
    url = f"{env['SUPABASE_URL']}/rest/v1/psp_orders"
    headers = {
        "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
        "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}",
    }
    params = {
        "select": "order_number,po_number,status,site_name,contact_name,created_at,"
                  "psp_order_items(code,base_code,name,size,material,quantity,custom_data)",
        "order": "created_at.desc",
    }
    resp = requests.get(url, headers=headers, params=params, timeout=60)
    resp.raise_for_status()
    return resp.json()


# --------------------------------------------------------------------------
# seed
# --------------------------------------------------------------------------

def is_personalised(item: dict) -> bool:
    """True when the sign carries order-specific text (site name, manager, phone).

    These can never be fully auto-fulfilled from a library: the layout is
    reusable but the content is not, so we track them as templates.
    """
    return item.get("custom_data") is not None


def build_library(orders: list[dict], existing: dict | None) -> dict:
    """Collapse the order history into one entry per base code."""
    # Preserve any artwork status already recorded, keyed by (base_code, code).
    prior: dict[tuple[str, str], dict] = {}
    if existing:
        for entry in existing.get("entries", []):
            for variant in entry.get("variants", []):
                prior[(entry["baseCode"], variant["code"])] = variant.get("artwork", {})

    # Legacy flat registry: a bare list of base codes known to have artwork,
    # from before the library existed. Only ever read a HAND-MAINTAINED
    # registry. Once we generate it, it is derived data: it has no size
    # granularity, so reading it back would mark every size of a code ready
    # off one file and silently inflate coverage on the next rebuild.
    legacy_codes: set[str] = set()
    if REGISTRY_PATH.exists():
        registry = json.loads(REGISTRY_PATH.read_text())
        if "GENERATED" not in registry.get("description", ""):
            legacy_codes = set(registry.get("codes", []))

    by_base: dict[str, dict] = {}
    for order in orders:
        for item in order.get("psp_order_items", []) or []:
            base = item.get("base_code") or item.get("code")
            if not base:
                continue
            entry = by_base.setdefault(base, {
                "baseCode": base,
                "name": item.get("name") or base,
                "personalised": False,
                "variants": {},
                "history": {
                    "orderNumbers": [],
                    "totalQty": 0,
                    "lastOrdered": None,
                },
            })
            entry["personalised"] = entry["personalised"] or is_personalised(item)

            # The stored code carries a cache-busting suffix on custom items
            # (PCF114/W-cf1789391038209); strip it so variants collapse properly.
            code = re.sub(r"-cf\d+$", "", item.get("code") or base)
            variant = entry["variants"].setdefault(code, {
                "code": code,
                "size": item.get("size"),
                "material": item.get("material"),
                "qty": 0,
                "artwork": prior.get((base, code)) or {
                    "status": "ready" if base in legacy_codes else "none",
                    "file": None,
                    "sourceOrder": None,
                    "capturedAt": None,
                },
            })
            variant["qty"] += item.get("quantity") or 0

            hist = entry["history"]
            hist["totalQty"] += item.get("quantity") or 0
            if order["order_number"] not in hist["orderNumbers"]:
                hist["orderNumbers"].append(order["order_number"])
            created = (order.get("created_at") or "")[:10]
            if created and (hist["lastOrdered"] is None or created > hist["lastOrdered"]):
                hist["lastOrdered"] = created

    # Anything already in the library that the order history does not
    # reproduce must be carried forward. The library is the source of truth;
    # history only ever adds to it. Without this, re-seeding quietly drops
    # every code and size that has artwork but no order behind it.
    if existing:
        for entry in existing.get("entries", []):
            base = entry["baseCode"]
            kept = by_base.setdefault(base, {
                "baseCode": base,
                "name": entry.get("name", base),
                "personalised": entry.get("personalised", False),
                "variants": {},
                "history": {"orderNumbers": [], "totalQty": 0, "lastOrdered": None},
            })
            for variant in entry.get("variants", []):
                kept["variants"].setdefault(variant["code"], {
                    "code": variant["code"],
                    "size": variant.get("size"),
                    "material": variant.get("material"),
                    "qty": variant.get("qty", 0),
                    "artwork": variant.get("artwork", {
                        "status": "none", "file": None,
                        "sourceOrder": None, "capturedAt": None,
                    }),
                })

    # Codes that already had artwork but have never been ordered through the
    # portal still belong in the library -- seeding purely from order history
    # would silently drop them and shrink the registry.
    catalog_index = {}
    if CATALOG_PATH.exists():
        catalog = json.loads(CATALOG_PATH.read_text())
        catalog_index = {
            p["baseCode"]: p
            for c in catalog["categories"] for p in c["products"]
        }
    for base in sorted(legacy_codes - by_base.keys()):
        product = catalog_index.get(base, {})
        variants = {}
        for v in product.get("variants", []):
            variants[v["code"]] = {
                "code": v["code"],
                "size": v.get("size"),
                "material": v.get("material"),
                "qty": 0,
                "artwork": prior.get((base, v["code"])) or {
                    "status": "ready", "file": None, "sourceOrder": None, "capturedAt": None,
                },
            }
        if not variants:
            variants[base] = {
                "code": base, "size": None, "material": None, "qty": 0,
                "artwork": prior.get((base, base)) or {
                    "status": "ready", "file": None, "sourceOrder": None, "capturedAt": None,
                },
            }
        by_base[base] = {
            "baseCode": base,
            "name": product.get("name", base),
            "personalised": False,
            "variants": variants,
            "history": {"orderNumbers": [], "totalQty": 0, "lastOrdered": None},
        }

    entries = []
    for base, entry in by_base.items():
        entry["variants"] = sorted(entry["variants"].values(), key=lambda v: v["code"])
        entry["history"]["ordersUsedIn"] = len(entry["history"]["orderNumbers"])
        entries.append(entry)
    entries.sort(key=lambda e: (-e["history"]["ordersUsedIn"], -e["history"]["totalQty"], e["baseCode"]))

    return {
        "updatedAt": date.today().isoformat(),
        "description": (
            "Ready-made artwork library. One entry per base code, listing every size/"
            "material variant actually ordered through the portal, how often it has been "
            "ordered, and whether production artwork exists for it. 'personalised' entries "
            "carry order-specific text and are reusable as templates, not as finished files."
        ),
        "source": "psp_orders + psp_order_items",
        "entries": entries,
    }


def write_registry_from_library(library: dict) -> int:
    """Regenerate the flat registry the order-list PDF consumes.

    lib/order-list-pdf.tsx reads artwork-registry.json as a plain list of base
    codes, so it stays as the derived view rather than a second source of truth.
    """
    codes = sorted({
        entry["baseCode"]
        for entry in library["entries"]
        if any(v["artwork"]["status"].startswith("ready") for v in entry["variants"])
    })
    REGISTRY_PATH.write_text(json.dumps({
        "updatedAt": library["updatedAt"],
        "description": (
            "Product base codes with production-ready artwork. Used by order list PDF to "
            "show artwork status. GENERATED from artwork-library.json -- edit that instead."
        ),
        "codes": codes,
    }, indent=2) + "\n")
    return len(codes)


def cmd_seed(args: argparse.Namespace) -> None:
    orders = fetch_orders(None if args.from_file else load_env(), args.from_file)
    existing = json.loads(LIBRARY_PATH.read_text()) if LIBRARY_PATH.exists() else None
    library = build_library(orders, existing)
    LIBRARY_PATH.write_text(json.dumps(library, indent=2) + "\n")

    variants = sum(len(e["variants"]) for e in library["entries"])
    ready = sum(1 for e in library["entries"] for v in e["variants"]
                if v["artwork"]["status"].startswith("ready"))
    personalised = sum(1 for e in library["entries"] if e["personalised"])
    registry_codes = write_registry_from_library(library)

    print(f"Seeded {LIBRARY_PATH.relative_to(REPO_ROOT)} from {len(orders)} orders")
    print(f"  {len(library['entries'])} base codes, {variants} size/material variants")
    print(f"  {personalised} base codes carry order-specific text (template only)")
    print(f"  {ready}/{variants} variants have artwork recorded")
    print(f"  regenerated registry with {registry_codes} codes")


# --------------------------------------------------------------------------
# match
# --------------------------------------------------------------------------

def _fuzz(s: str) -> str:
    """Fold the characters people mistype in a job-folder name: O/0, I/L/1."""
    return s.upper().replace("O", "0").replace("I", "1").replace("L", "1")


def index_orders(orders: list[dict]) -> dict:
    """Build lookup tables for the ways a folder might name an order."""
    by_number, by_suffix, by_po, by_site = {}, defaultdict(list), defaultdict(list), defaultdict(list)
    by_fuzzy = defaultdict(list)
    for order in orders:
        num = order["order_number"]
        by_number[num.upper()] = order
        by_suffix[num.split("-")[-1].upper()].append(order)
        by_fuzzy[_fuzz(num.split("-")[-1])].append(order)
        po = (order.get("po_number") or "").strip()
        if po:
            by_po[po.upper()].append(order)
        site = (order.get("site_name") or "").strip().lower()
        if site:
            by_site[site].append(order)
    return {"number": by_number, "suffix": by_suffix, "po": by_po,
            "site": by_site, "fuzzy": by_fuzzy}


def load_overrides() -> dict[str, str]:
    """Hand-recorded folder -> order corrections, keyed case-insensitively."""
    if not OVERRIDES_PATH.exists():
        return {}
    data = json.loads(OVERRIDES_PATH.read_text()).get("overrides", {})
    return {k.upper(): v.upper() for k, v in data.items()}


def match_folder_name(name: str, idx: dict, overrides: dict[str, str] | None = None) -> tuple[list[dict], str]:
    """Resolve one folder name to candidate orders, with how we got there."""
    upper = name.upper()

    # A human has already settled this one; never second-guess it.
    if overrides and upper in overrides:
        order = idx["number"].get(overrides[upper])
        if order:
            return [order], "override"

    m = ORDER_NUMBER_RE.search(upper)
    if m and m.group(0) in idx["number"]:
        return [idx["number"][m.group(0)]], "order-number"

    for po in PO_NUMBER_RE.findall(upper):
        if po in idx["po"]:
            return idx["po"][po], "po-number"

    # Only trust a 4-char token if it is not also a plain word in the name.
    for token in ORDER_SUFFIX_RE.findall(upper):
        if token in idx["suffix"]:
            return idx["suffix"][token], "order-suffix"

    site = name.strip().lower()
    if site in idx["site"]:
        return idx["site"][site], "site-name"

    # Last resort: allow for O/0 and I/L/1 having been mistyped.
    for token in ORDER_SUFFIX_RE.findall(upper):
        fuzzy = _fuzz(token)
        if fuzzy in idx["fuzzy"]:
            return idx["fuzzy"][fuzzy], "order-suffix-fuzzy"

    return [], "unmatched"


DIMS_RE = re.compile(r"(\d{2,4})\s*[x\u00d7]\s*(\d{2,4})", re.I)


def sizes_match(filename: str, size: str, tol: int = 5) -> bool:
    """True when a filename's dimensions match an ordered size, either way up.

    Print files are named by sheet size (2440x1220.pdf) and the catalogue
    records the sign size (1220x2440mm); the same pair, transposed.
    """
    fm = DIMS_RE.search(Path(filename).stem)
    sm = DIMS_RE.search(size or "")
    if not (fm and sm):
        return False
    a = sorted((int(fm.group(1)), int(fm.group(2))))
    b = sorted((int(sm.group(1)), int(sm.group(2))))
    return all(abs(x - y) <= tol for x, y in zip(a, b))


def near_misses(name: str, idx: dict, max_edits: int = 1) -> list[str]:
    """Order numbers one typo away from a folder name, as a hint for a human.

    Never applied automatically -- a single wrong character is exactly how a
    folder ends up attributed to the wrong job.
    """
    import difflib
    out = []
    for token in ORDER_SUFFIX_RE.findall(name.upper()):
        for suffix, orders in idx["suffix"].items():
            if suffix == token or len(suffix) != len(token):
                continue
            edits = sum(1 for a, b in zip(suffix, token) if a != b)
            if edits <= max_edits:
                out.extend(o["order_number"] for o in orders)
    return sorted(set(out))


def extract_product_codes(filename: str, known: set[str]) -> list[str]:
    """Pull catalogue codes out of a filename, keeping only ones we recognise."""
    found = []
    stem = Path(filename).stem
    for base, _suffix in PRODUCT_CODE_RE.findall(stem):
        if base.upper() in known and base.upper() not in found:
            found.append(base.upper())
    return found


def scan_folder(root: Path) -> list[tuple[Path, list[Path]]]:
    """Return (folder, files) for every directory that directly holds files.

    Job folders are not always one level down -- an exported or re-zipped
    archive nests them -- so the unit of work is "a directory with artwork in
    it", at whatever depth, and its own name is what identifies the order.
    """
    groups: dict[Path, list[Path]] = {}
    for f in sorted(root.rglob("*")):
        if f.is_file() and not f.name.startswith("."):
            groups.setdefault(f.parent, []).append(f)
    return sorted(groups.items())


def cmd_match(args: argparse.Namespace) -> None:
    root = Path(args.folder).expanduser()
    if not root.is_dir():
        sys.exit(f"Not a folder: {root}")

    orders = fetch_orders(None if args.from_file else load_env(), args.from_file)
    idx = index_orders(orders)

    catalog = json.loads(CATALOG_PATH.read_text())
    known_codes = {
        p["baseCode"].upper()
        for c in catalog["categories"] for p in c["products"]
    }

    report = {"generatedAt": date.today().isoformat(), "folder": str(root),
              "matched": [], "ambiguous": [], "unmatched": []}

    overrides = load_overrides()
    for folder, files in scan_folder(root):
        candidates, how = match_folder_name(folder.name, idx, overrides)
        artwork = [f for f in files if f.suffix.lower() in ARTWORK_EXTS]
        previews = [f for f in files if f.suffix.lower() in PREVIEW_EXTS]

        record = {
            "folder": folder.name if folder != root else "(root)",
            "matchedBy": how,
            "artworkFiles": [str(f.relative_to(root)) for f in artwork],
            "previewFiles": [str(f.relative_to(root)) for f in previews],
            "otherFiles": [str(f.relative_to(root)) for f in files
                           if f.suffix.lower() not in ARTWORK_EXTS | PREVIEW_EXTS],
        }

        if len(candidates) != 1:
            record["candidates"] = [o["order_number"] for o in candidates]
            if not candidates:
                record["nearMisses"] = near_misses(folder.name, idx)
            (report["ambiguous"] if candidates else report["unmatched"]).append(record)
            continue

        order = candidates[0]
        record["orderNumber"] = order["order_number"]
        record["siteName"] = order.get("site_name")
        record["orderedCodes"] = sorted({
            (i.get("base_code") or i.get("code") or "").upper()
            for i in order.get("psp_order_items", []) or []
        })
        # The artwork in this folder was made at the sizes this order asked
        # for. Other sizes of the same sign are a different layout (portrait
        # vs landscape), so they are not covered by this file.
        variants_by_base: dict[str, list[str]] = {}
        for i in order.get("psp_order_items", []) or []:
            base = (i.get("base_code") or i.get("code") or "").upper()
            code = re.sub(r"-cf\d+$", "", i.get("code") or base)
            variants_by_base.setdefault(base, [])
            if code not in variants_by_base[base]:
                variants_by_base[base].append(code)
        record["orderedVariants"] = variants_by_base

        # Filenames here are sizes or just PRINT.pdf, so they identify nothing.
        # Read each PDF instead and recognise the sign from its own wording.
        order_codes = set(record["orderedCodes"])
        file_map: dict[str, list[str]] = {}
        pages, blank = [], 0
        for f in artwork:
            if f.suffix.lower() != ".pdf":
                continue
            # Record "<job folder>/<file>" rather than the full scan path, so
            # the library reads the same however deeply the folder was nested.
            rel = f"{folder.name}/{f.name}" if folder != root else f.name
            try:
                found = sign_reader.identify_pdf(f, order_codes)
            except Exception as exc:                      # a PDF we cannot parse
                pages.append({"file": rel, "page": None, "error": str(exc)[:120]})
                continue
            for hit in found:
                hit["file"] = rel
                pages.append(hit)
                if hit["code"] is None:
                    blank += 1
                elif hit["tier"] in ("confirmed", "likely"):
                    # Keep the page: a print sheet can hold twenty signs, and
                    # "it is somewhere in this PDF" is not a pick instruction.
                    file_map.setdefault(hit["code"], []).append(
                        {"file": rel, "page": hit["page"], "tier": hit["tier"]})

        # A personalised sign carries bespoke text, so it can never match a
        # catalogue name and would otherwise drop out entirely. Its layout is
        # still worth keeping: record the folder's artwork against it as a
        # template, flagged so nobody mistakes it for a finished file.
        # CUSTOM and CUSTOM-ITEM are billing placeholders for one-off work,
        # not sign designs -- there is no layout to reuse, so never template them.
        personalised = {
            (i.get("base_code") or i.get("code") or "").upper()
            for i in order.get("psp_order_items", []) or []
            if i.get("custom_data") is not None
        } - {"CUSTOM", "CUSTOM-ITEM"}
        pdfs = sorted({p["file"] for p in pages if p.get("file")})
        # Where a folder holds several PDFs and several personalised items,
        # giving every item every file makes the recorded template a coin
        # flip. These filenames are sizes, so prefer the file whose name
        # carries the size that item was ordered at.
        record["templateByCode"] = {}
        for code in sorted(personalised - set(file_map)):
            if not pdfs:
                continue
            sizes = {
                i.get("size") for i in order.get("psp_order_items", []) or []
                if (i.get("base_code") or i.get("code") or "").upper() == code
            }
            sized = [f for f in pdfs if any(sizes_match(f, sz) for sz in sizes if sz)]
            record["templateByCode"][code] = sized or pdfs

        record["pages"] = pages
        record["fileByCode"] = file_map
        record["unidentifiedPages"] = blank
        record["needsReview"] = [p for p in pages if p.get("tier") == "review"]
        record["codesWithoutFile"] = [
            c for c in record["orderedCodes"]
            if c not in file_map and c not in record["templateByCode"]
        ]
        record["codesWithoutFile"] = [
            c for c in record["orderedCodes"]
            if c not in file_map and c not in record["templateByCode"]
        ]
        report["matched"].append(record)

    out = Path(args.out) if args.out else REPO_ROOT / "scripts" / "artwork-match-report.json"
    out.write_text(json.dumps(report, indent=2) + "\n")

    print(f"Scanned {root}")
    print(f"  matched   {len(report['matched'])} folders to an order")
    print(f"  ambiguous {len(report['ambiguous'])} folders (more than one candidate)")
    print(f"  unmatched {len(report['unmatched'])} folders")
    print(f"  report -> {out}")

    for rec in report["matched"]:
        print(f"\n  {rec['folder']}  ->  {rec['orderNumber']}  ({rec['matchedBy']}, {rec['siteName']})")
        for code, hits in sorted(rec["fileByCode"].items()):
            where = ', '.join(f"{h['file']} p{h['page']}" for h in hits)
            print(f"      {code:<12} {where}")
        for code, files in sorted(rec["templateByCode"].items()):
            print(f"      {code:<12} {', '.join(files)}  (template, bespoke text)")
        if rec["codesWithoutFile"]:
            print(f"      no artwork found for: {', '.join(rec['codesWithoutFile'])}")
        for p in rec["needsReview"]:
            print(f"      ? {p['file']} p{p['page']} looks like {p['code']} "
                  f"(not on this order) -- \"{p['text'][:44]}\"")
        if rec["unidentifiedPages"]:
            print(f"      {rec['unidentifiedPages']} page(s) unidentified "
                  f"(blank, image-only, or bespoke custom text)")

    for rec in report["ambiguous"]:
        print(f"\n  ? {rec['folder']}  ->  {', '.join(rec['candidates'])}")
    for rec in report["unmatched"]:
        near = rec.get("nearMisses") or []
        hint = f"  (did you mean {', '.join(near)}?)" if near else ""
        print(f"\n  ! {rec['folder']}  ->  no order matched{hint}")

    if args.apply:
        apply_matches(report)


def apply_matches(report: dict) -> None:
    """Record matched files against their variants in the library."""
    if not LIBRARY_PATH.exists():
        sys.exit("No artwork-library.json -- run `seed` first")
    library = json.loads(LIBRARY_PATH.read_text())
    by_base = {e["baseCode"].upper(): e for e in library["entries"]}

    updated = 0
    for rec in report["matched"]:
        ordered_variants = rec.get("orderedVariants", {})
        for code, files in rec["fileByCode"].items():  # confirmed + likely only
            entry = by_base.get(code)
            if not entry:
                continue
            # Only the sizes this order actually asked for are covered.
            targets = set(ordered_variants.get(code, []))
            for variant in entry["variants"]:
                if targets and variant["code"] not in targets:
                    continue
                if variant["artwork"]["status"] == "ready" and variant["artwork"]["file"]:
                    continue
                # Several files can carry the same sign at different sizes.
                # Prefer the one whose name matches this variant's size.
                sized = [h for h in files
                         if sizes_match(h["file"], variant.get("size") or "")]
                # A sheet can match the same code on several pages, one of
                # them loosely. Take the strongest, or a wrong page gets
                # picked off the right file.
                pick = sorted(
                    sized or files,
                    key=lambda h: (h.get("tier") != "confirmed", -(h.get("page") or 0)),
                )[0]
                variant["artwork"] = {
                    "status": "ready",
                    "file": pick["file"],
                    "page": pick["page"],
                    "sourceOrder": rec["orderNumber"],
                    "capturedAt": report["generatedAt"],
                }
                updated += 1

    scaled = propagate_by_aspect(library, report["generatedAt"])

    templates = 0
    for rec in report["matched"]:
        ordered_variants = rec.get("orderedVariants", {})
        for code, files in rec.get("templateByCode", {}).items():
            entry = by_base.get(code)
            if not entry:
                continue
            targets = set(ordered_variants.get(code, []))
            for variant in entry["variants"]:
                if targets and variant["code"] not in targets:
                    continue
                if variant["artwork"]["status"] != "none":
                    continue
                variant["artwork"] = {
                    "status": "template",
                    "file": files[0],
                    "sourceOrder": rec["orderNumber"],
                    "capturedAt": report["generatedAt"],
                    "note": "layout only -- text is per order",
                }
                templates += 1


    library["updatedAt"] = report["generatedAt"]
    LIBRARY_PATH.write_text(json.dumps(library, indent=2) + "\n")
    codes = write_registry_from_library(library)
    print(f"\nApplied: {updated} variants marked ready, {scaled} covered by "
          f"scaling, {templates} recorded as templates; registry now {codes} codes")


def _aspect(size: str | None) -> float | None:
    """Aspect ratio of a size string like '300x400mm', or None."""
    if not size:
        return None
    m = re.search(r"(\d+)\s*[x\u00d7]\s*(\d+)", size, re.I)
    if not m:
        return None
    w, h = int(m.group(1)), int(m.group(2))
    return round(w / h, 3) if h else None


def propagate_by_aspect(library: dict, today: str, tol: float = 0.02) -> int:
    """Cover same-shape sizes from artwork we already hold.

    A 300x400 and a 600x800 are both 3:4 -- one artwork scales to the other
    with no redrawing. A 400x600 (2:3) does not, so it is left alone. These
    are marked "ready-scaled" rather than "ready" so it stays obvious that the
    file was drawn at another size.
    """
    count = 0
    for entry in library["entries"]:
        sources = [v for v in entry["variants"] if v["artwork"]["status"] == "ready"
                   and v["artwork"].get("file")]
        if not sources:
            continue
        for variant in entry["variants"]:
            if variant["artwork"]["status"] != "none":
                continue
            target = _aspect(variant.get("size"))
            if target is None:
                continue
            for src in sources:
                ratio = _aspect(src.get("size"))
                if ratio is None or abs(ratio - target) > tol:
                    continue
                variant["artwork"] = {
                    "status": "ready-scaled",
                    "file": src["artwork"]["file"],
                    "page": src["artwork"].get("page"),
                    "sourceOrder": src["artwork"]["sourceOrder"],
                    "scaledFrom": src["code"],
                    "capturedAt": today,
                }
                count += 1
                break
    return count


# --------------------------------------------------------------------------
# report
# --------------------------------------------------------------------------

def cmd_report(args: argparse.Namespace) -> None:
    if not LIBRARY_PATH.exists():
        sys.exit("No artwork-library.json -- run `seed` first")
    library = json.loads(LIBRARY_PATH.read_text())
    by_base = {e["baseCode"].upper(): e for e in library["entries"]}

    if not args.order:
        total = sum(len(e["variants"]) for e in library["entries"])
        ready = sum(1 for e in library["entries"] for v in e["variants"]
                    if v["artwork"]["status"].startswith("ready"))
        print(f"Library: {len(library['entries'])} base codes, {total} variants, "
              f"{ready} ready ({ready * 100 // max(total, 1)}%)")
        print("\nMost-ordered codes still without artwork:")
        gaps = [e for e in library["entries"]
                if not any(v["artwork"]["status"].startswith("ready") for v in e["variants"])]
        for e in gaps[:20]:
            print(f"  {e['baseCode']:<12} {e['history']['ordersUsedIn']:>2} orders  "
                  f"{e['history']['totalQty']:>4} made   {e['name'][:48]}")
        return

    orders = fetch_orders(None if args.from_file else load_env(), args.from_file)
    order = next((o for o in orders if o["order_number"].upper() == args.order.upper()), None)
    if not order:
        sys.exit(f"Order {args.order} not found")

    print(f"{order['order_number']} -- {order.get('site_name')} -- {order.get('contact_name')}")
    print(f"status: {order.get('status')}   PO: {order.get('po_number') or '(none)'}\n")

    from_library, to_make, templates = [], [], []
    for item in sorted(order.get("psp_order_items", []) or [], key=lambda i: i.get("code") or ""):
        base = (item.get("base_code") or item.get("code") or "").upper()
        code = re.sub(r"-cf\d+$", "", item.get("code") or base)
        entry = by_base.get(base)
        variant = next((v for v in entry["variants"] if v["code"] == code), None) if entry else None
        ready = bool(variant and variant["artwork"]["status"].startswith("ready"))
        row = (code, item.get("size"), item.get("quantity"), item.get("name"),
               (variant or {}).get("artwork", {}).get("file"))
        if item.get("custom_data") is not None:
            templates.append(row + (ready,))
        elif ready:
            from_library.append(row)
        else:
            to_make.append(row)

    def show(title: str, rows: list, extra: bool = False) -> None:
        if not rows:
            return
        print(f"{title} ({len(rows)})")
        for row in rows:
            code, size, qty, name, file = row[:5]
            suffix = f"   [{file}]" if file else ""
            print(f"  {code:<16} {str(size):<14} x{qty:<3} {str(name)[:44]}{suffix}")
        print()

    show("PULL FROM LIBRARY", from_library)
    show("PERSONALISED -- reuse template, merge this order's text", templates)
    show("MAKE FROM SCRATCH", to_make)

    total = len(from_library) + len(templates) + len(to_make)
    print(f"{len(from_library)}/{total} line items fully auto-fulfillable; "
          f"{len(templates)} need a text merge; {len(to_make)} need artworking.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_seed = sub.add_parser("seed", help="build the library from Supabase order history")
    p_seed.add_argument("--from-file", help="read orders from an exported JSON file "
                                            "instead of querying Supabase")

    p_match = sub.add_parser("match", help="map an artwork folder onto orders")
    p_match.add_argument("folder", help="path to the finished-artwork folder")
    p_match.add_argument("--out", help="where to write the JSON report")
    p_match.add_argument("--apply", action="store_true",
                         help="also record matched files in the library")
    p_match.add_argument("--from-file", help="read orders from an exported JSON file")

    p_report = sub.add_parser("report", help="library coverage, or one order's pick list")
    p_report.add_argument("--order", help="order number, e.g. PER-20260914-J5NO")
    p_report.add_argument("--from-file", help="read orders from an exported JSON file")

    args = parser.parse_args()
    {"seed": cmd_seed, "match": cmd_match, "report": cmd_report}[args.cmd](args)


if __name__ == "__main__":
    # Allow `... | head` without a BrokenPipeError traceback.
    try:
        import signal
        signal.signal(signal.SIGPIPE, signal.SIG_DFL)
    except (ImportError, AttributeError, ValueError):
        pass
    main()
