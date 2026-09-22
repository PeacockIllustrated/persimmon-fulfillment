#!/usr/bin/env python3
"""Fold approved artwork back into the library.

    write_back.py PER-20260914-J5NO --artwork-root ~/"Persimmon App Jobs"
    write_back.py PER-20260914-J5NO --artwork-root ... --apply

This is the half that compounds. A sign drawn from scratch and then approved is
artwork we own: the next order for that code should be a library pull that
needs no drawing and no review. Without this step the library stops growing and
every new code is drawn again, order after order -- which is how `PCF465 Safe
working load` came to be artworked seven separate times.

The source is the pack stored against the order, not a file left on disk. A
pack built in an agent session goes away with the container, so reading it back
from the database is what makes this runnable anywhere, at any later date.

What gets written back, and as what:

    GENERATED -> ready       carries no order-specific text, so it is reusable
                             exactly as drawn
    MERGED    -> template    the layout is reusable, the text is this order's
                             site, manager and phone number -- recording it as
                             `ready` would ship one site's board to another
    LIBRARY   -> nothing     it came from the library

A rejected page is never written back, and neither is a pending one: the whole
point of the approval is that a human looked at it.
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import sys
from datetime import date
from pathlib import Path

from pypdf import PdfReader, PdfWriter

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from artwork_library import (  # noqa: E402
    LIBRARY_PATH,
    load_env,
    write_registry_from_library,
)

REUSE_AS = {"GENERATED": "ready", "MERGED": "template"}


def supabase_get(env: dict[str, str], table: str, params: dict) -> list[dict]:
    import requests
    resp = requests.get(
        f"{env['SUPABASE_URL']}/rest/v1/{table}",
        headers={
            "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
            "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}",
        },
        params=params,
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()


def supabase_patch(env: dict[str, str], table: str, params: dict, body: dict) -> None:
    import requests
    resp = requests.patch(
        f"{env['SUPABASE_URL']}/rest/v1/{table}",
        headers={
            "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
            "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        params=params,
        json=body,
        timeout=60,
    )
    resp.raise_for_status()


def load_pack(env: dict[str, str], order_number: str) -> PdfReader | None:
    rows = supabase_get(env, "psp_artwork_packs", {
        "select": "pack_document",
        "order_number": f"eq.{order_number}",
    })
    if not rows or not rows[0].get("pack_document"):
        return None
    return PdfReader(io.BytesIO(base64.b64decode(rows[0]["pack_document"])))


def find_variant(library: dict, code: str) -> tuple[dict | None, dict | None]:
    """The entry and variant for a code, if the library already knows it."""
    for entry in library["entries"]:
        for variant in entry["variants"]:
            if variant["code"] == code:
                return entry, variant
    return None, None


def find_entry(library: dict, base_code: str) -> dict | None:
    for entry in library["entries"]:
        if entry["baseCode"] == base_code:
            return entry
    return None


def write_back(order_number: str, artwork_root: Path, apply: bool) -> int:
    env = load_env()

    pages = supabase_get(env, "psp_artwork_pages", {
        "select": "page_no,code,base_code,name,size,provenance,decision",
        "order_number": f"eq.{order_number}",
        "order": "page_no.asc",
    })
    if not pages:
        print(f"{order_number}: no proof recorded -- nothing to write back")
        return 0

    undecided = [p for p in pages if p["decision"] == "pending"]
    if undecided:
        print(f"{order_number}: {len(undecided)} page(s) still awaiting a decision; "
              f"approve the pack first")
        return 0

    candidates = [p for p in pages
                  if p["decision"] == "approved" and p["provenance"] in REUSE_AS]
    if not candidates:
        print(f"{order_number}: nothing new to keep -- "
              f"every approved page came from the library already")
        if apply:
            supabase_patch(env, "psp_orders",
                           {"order_number": f"eq.{order_number}"},
                           {"fulfilment_status": "packed"})
        return 0

    pack = load_pack(env, order_number)
    if pack is None:
        print(f"{order_number}: the pack PDF was never uploaded, so there is no "
              f"artwork to file. Rebuild with --publish.")
        return 0

    library = json.loads(LIBRARY_PATH.read_text())
    today = date.today().isoformat()
    folder = artwork_root / order_number
    written = 0

    for page in candidates:
        code = page["code"]
        page_no = page["page_no"]
        if not 1 <= page_no <= len(pack.pages):
            print(f"  ! {code}: pack has no page {page_no}")
            continue

        safe = code.replace("/", "-")
        relative = f"{order_number}/{safe}.pdf"
        status = REUSE_AS[page["provenance"]]

        entry, variant = find_variant(library, code)
        if variant is None:
            base_code = page.get("base_code") or code.split("/")[0].split("-")[0]
            entry = find_entry(library, base_code)
            if entry is None:
                entry = {
                    "baseCode": base_code,
                    "name": page.get("name", ""),
                    "personalised": status == "template",
                    "variants": [],
                }
                library["entries"].append(entry)
            variant = {"code": code, "size": page.get("size"), "material": None,
                       "qty": 0, "artwork": {"status": "none", "file": None}}
            entry["variants"].append(variant)

        artwork = {
            "status": status,
            "file": relative,
            "page": 1,
            "sourceOrder": order_number,
            "capturedAt": today,
            "approvedFrom": "proof approval",
        }
        if status == "template":
            artwork["note"] = "layout only -- text is per order"

        if apply:
            folder.mkdir(parents=True, exist_ok=True)
            writer = PdfWriter()
            writer.add_page(pack.pages[page_no - 1])
            with open(artwork_root / relative, "wb") as fh:
                writer.write(fh)
            variant["artwork"] = artwork

        print(f"  {code:28} {page['provenance']:10} -> {status:8} {relative}")
        written += 1

    if not apply:
        print(f"\n{written} page(s) would be filed. Re-run with --apply to write them.")
        return written

    library["updatedAt"] = today
    LIBRARY_PATH.write_text(json.dumps(library, indent=2) + "\n")
    codes = write_registry_from_library(library)
    supabase_patch(env, "psp_orders",
                   {"order_number": f"eq.{order_number}"},
                   {"fulfilment_status": "packed"})

    print(f"\n{written} page(s) filed under {folder}")
    print(f"library updated; registry now lists {codes} codes")
    print("commit shop/data/artwork-library.json and artwork-registry.json")
    return written


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("orders", nargs="+", help="order numbers whose proof was approved")
    parser.add_argument("--artwork-root", required=True,
                        help="folder holding the job folders")
    parser.add_argument("--apply", action="store_true",
                        help="actually write the files and update the library")
    args = parser.parse_args()

    root = Path(args.artwork_root).expanduser()
    if not root.is_dir():
        raise SystemExit(f"{root} is not a directory")

    total = 0
    for number in args.orders:
        print(f"\n{number}")
        total += write_back(number.upper(), root, args.apply)

    if len(args.orders) > 1:
        print(f"\n{total} page(s) across {len(args.orders)} orders")


if __name__ == "__main__":
    main()
