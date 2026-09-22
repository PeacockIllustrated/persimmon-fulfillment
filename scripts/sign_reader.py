#!/usr/bin/env python3
"""
Read finished artwork PDFs and work out which catalogue sign each page carries.

Job folders name their files by size or just PRINT.pdf -- almost never by
product code -- so the filename tells us nothing. The artwork itself does: a
print PDF holds one sign per page, and the sign's own wording identifies it.

These are Illustrator/InDesign exports with no /ToUnicode map, so the bytes in
the content stream are font-encoded rather than Unicode, and ligatures arrive
as control codes. We do not need exact text, only enough to recognise the sign,
so the text is normalised hard and matched on distinctive words.

Matching is deliberately ordered by how much we can trust it:

  confirmed  the page matches an item on that order, near-exactly. Trustworthy.
  likely     matches an item on that order, but loosely. Worth a glance.
  review     no item on the order fits, so this is a catalogue-wide guess.
             Frequently wrong -- never write one into the library unchecked.

Matching against the whole catalogue first produces confident-looking wrong
answers (a "HI VIZ MUST BE WORN" page scores higher against PPE wording than
against the hi-viz sign it actually is), which is why the order's own items
always get first refusal.
"""

from __future__ import annotations

import json
import re
import zlib
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CATALOG_PATH = REPO_ROOT / "shop" / "data" / "catalog.json"

# Words too common to identify a sign by.
STOP = {"THE", "AND", "FOR", "THIS", "THAT", "WITH", "MUST", "BE", "ON", "IN",
        "OF", "TO", "AT", "AN", "IS", "ARE", "YOUR", "YOU", "CORREX",
        "DIBOND", "FOAMEX", "VINYL", "SIGN", "BOARD"}

CONFIRMED_AT = 0.9    # near-exact match against an item on the order
ORDER_FLOOR = 0.35    # weakest match we will still credit to the order
CATALOG_AT = 0.75     # bar for a catalogue-wide guess


# --------------------------------------------------------------------------
# PDF parsing
# --------------------------------------------------------------------------

def _objects(data: bytes) -> dict[int, bytes]:
    """Object number -> body, including objects packed inside /ObjStm streams."""
    objs: dict[int, bytes] = {}
    for m in re.finditer(rb'(\d+)\s+(\d+)\s+obj\b', data):
        end = data.find(b'endobj', m.end())
        if end != -1:
            objs[int(m.group(1))] = data[m.end():end]

    for body in list(objs.values()):
        if b'/ObjStm' not in body:
            continue
        sm = re.search(rb'stream\r?\n', body)
        if not sm:
            continue
        try:
            dec = zlib.decompress(body[sm.end():body.rfind(b'endstream')])
        except Exception:
            continue
        n = re.search(rb'/N\s+(\d+)', body)
        first = re.search(rb'/First\s+(\d+)', body)
        if not (n and first):
            continue
        n, first = int(n.group(1)), int(first.group(1))
        header = dec[:first].split()
        for i in range(0, min(len(header) - 1, n * 2), 2):
            try:
                num, off = int(header[i]), int(header[i + 1])
            except ValueError:
                continue
            nxt = int(header[i + 3]) + first if i + 3 < len(header) else len(dec)
            objs.setdefault(num, dec[first + off:nxt])
    return objs


def _stream_of(body: bytes) -> bytes:
    sm = re.search(rb'stream\r?\n', body)
    if not sm:
        return b''
    raw = body[sm.end():body.rfind(b'endstream')]
    try:
        return zlib.decompress(raw)
    except Exception:
        return raw if (b'Tj' in raw or b'TJ' in raw) else b''


def _decode(content: bytes) -> str:
    """Literal strings out of a content stream, in drawing order."""
    parts: list[bytes] = []
    for m in re.finditer(rb'\((?:[^()\\]|\\.)*\)|<([0-9A-Fa-f\s]+)>\s*Tj', content):
        tok = m.group(0)
        if tok.startswith(b'('):
            s = tok[1:-1]
            s = re.sub(rb'\\([()\\])', rb'\1', s)
            s = re.sub(rb'\\[0-7]{1,3}', b' ', s)      # ligatures, specials
            parts.append(s)
        else:
            try:
                parts.append(bytes.fromhex(m.group(1).decode().replace(' ', '')))
            except Exception:
                pass
    text = b''.join(parts).decode('latin-1', 'replace')
    text = re.sub(r"[^A-Za-z0-9&/'\- ]+", ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def _page_order(objs: dict[int, bytes], data: bytes) -> list[int]:
    """Page object numbers in document order, by walking the page tree.

    Object numbers are NOT page order -- a PDF writer emits objects in
    whatever order suits it. Sorting by object number silently scrambles
    which text belongs to which page, so the tree is the only safe source.
    """
    root = re.search(rb'/Root\s+(\d+)\s+\d+\s+R', data)
    pages_ref = None
    if root:
        cat = objs.get(int(root.group(1)), b'')
        m = re.search(rb'/Pages\s+(\d+)\s+\d+\s+R', cat)
        if m:
            pages_ref = int(m.group(1))
    if pages_ref is None:  # no catalogue we can follow: find the tree root
        for num, body in objs.items():
            if re.search(rb'/Type\s*/Pages', body) and b'/Parent' not in body:
                pages_ref = num
                break
    if pages_ref is None:
        return []

    order: list[int] = []
    seen: set[int] = set()

    def walk(num: int) -> None:
        if num in seen or len(order) > 10000:
            return
        seen.add(num)
        body = objs.get(num, b'')
        if re.search(rb'/Type\s*/Page(?![s])', body):
            order.append(num)
            return
        kids = re.search(rb'/Kids\s*\[(.*?)\]', body, re.S)
        if kids:
            for kid in re.findall(rb'(\d+)\s+\d+\s+R', kids.group(1)):
                walk(int(kid))

    walk(pages_ref)
    return order


def page_texts(path: str | Path) -> list[str]:
    """One normalised text string per page, in document order."""
    data = Path(path).read_bytes()
    objs = _objects(data)

    order = _page_order(objs, data)
    if order:
        pages = [(num, objs[num]) for num in order if num in objs]
    else:  # unreadable tree -- fall back, and accept the order may be off
        pages = sorted(
            (num, body) for num, body in objs.items()
            if re.search(rb'/Type\s*/Page(?![s])', body)
        )

    out: list[str] = []
    for _num, body in pages:
        cm = re.search(rb'/Contents\s+(\d+)\s+\d+\s+R', body)
        if cm:
            refs = [int(cm.group(1))]
        else:
            am = re.search(rb'/Contents\s*\[(.*?)\]', body, re.S)
            refs = [int(x) for x in re.findall(rb'(\d+)\s+\d+\s+R', am.group(1))] if am else []
        out.append(_decode(b''.join(_stream_of(objs.get(r, b'')) for r in refs)))

    if not out:  # not a page tree we understand -- treat the file as one blob
        out = [_decode(b''.join(_stream_of(b) for b in objs.values()))]
    return out


# --------------------------------------------------------------------------
# Sign identification
# --------------------------------------------------------------------------

def _compact(s: str) -> str:
    return re.sub(r'[^A-Z0-9]', '', (s or '').upper())


def _tokens(s: str) -> list[str]:
    return [t for t in re.findall(r'[A-Z0-9]+', (s or '').upper())
            if len(t) >= 3 and t not in STOP]


def build_index() -> dict[str, dict]:
    """Base code -> the strings we match a page against."""
    catalog = json.loads(CATALOG_PATH.read_text())
    return {
        p["baseCode"]: {
            "name": p["name"],
            "compact": _compact(p["name"]),
            "tokens": _tokens(p["name"]),
        }
        for c in catalog["categories"] for p in c["products"]
    }


_INDEX: dict[str, dict] | None = None


def index() -> dict[str, dict]:
    global _INDEX
    if _INDEX is None:
        _INDEX = build_index()
    return _INDEX


def _score(page_compact: str, entry: dict) -> float:
    """How much of this sign's wording appears on the page, by weight."""
    if not entry["tokens"]:
        return 0.0
    if entry["compact"] and entry["compact"] in page_compact:
        return 1.0
    hit = sum(len(t) for t in entry["tokens"] if t in page_compact)
    total = sum(len(t) for t in entry["tokens"])
    return hit / total if total else 0.0


def rank(text: str, pool=None, threshold: float = CATALOG_AT) -> list[tuple[str, float]]:
    """Best-matching base codes for a page, strongest first."""
    pc = _compact(text)
    if not pc:
        return []
    scored = []
    for code in (pool if pool is not None else index().keys()):
        entry = index().get(code)
        if not entry:
            continue
        s = _score(pc, entry)
        if s >= threshold:
            scored.append((s, len(entry["compact"]), code))
    scored.sort(reverse=True)
    return [(code, round(s, 2)) for s, _, code in scored]


def identify_page(text: str, order_codes: set[str] | None = None) -> dict | None:
    """Identify one page, preferring the order's own items over the catalogue.

    Returns {code, confidence, tier, alternatives}, or None for a blank page
    or one whose wording matches nothing (a bespoke custom-text sign).
    """
    if not text.strip():
        return None

    pool = (order_codes & index().keys()) if order_codes else None

    if pool:
        hits = rank(text, pool, CONFIRMED_AT)
        if hits:
            tier = "confirmed"
        else:
            hits = rank(text, pool, ORDER_FLOOR)
            tier = "likely" if hits else None
        if hits:
            return {"code": hits[0][0], "confidence": hits[0][1], "tier": tier,
                    "alternatives": [h[0] for h in hits[1:4]]}

    hits = rank(text, None, CATALOG_AT)
    if not hits:
        return None
    return {"code": hits[0][0], "confidence": hits[0][1], "tier": "review",
            "alternatives": [h[0] for h in hits[1:4]]}


def identify_pdf(path: str | Path, order_codes: set[str] | None = None) -> list[dict]:
    """One record per page: its text and what sign it appears to be."""
    out = []
    for i, text in enumerate(page_texts(path), 1):
        result = identify_page(text, order_codes)
        out.append({"page": i, "text": text[:120], **(result or {
            "code": None, "confidence": None, "tier": None, "alternatives": []})})
    return out
