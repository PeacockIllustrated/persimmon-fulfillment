#!/usr/bin/env python3
"""Bring a library page to the size the order actually asked for.

A library page is the sheet as it was printed, which is not always one sign at
the ordered size. Two cases come up:

  n-up sheet   PCF29/F was printed two-up on a 400x600 sheet. The artwork is
               right, but the page carries two signs. Crop to one cell.
  wrong size   PCF961/F is covered by the 600x800 artwork of the same shape.
               Scale it down rather than ship a sign twice the size ordered.

Which one applies is not guessed from the geometry alone -- a 800x600 page for
a 400x300 sign is both "2x2 up" and "twice the size". The library records
whether the entry was matched directly or covered by scaling, and that decides.
"""

from __future__ import annotations

import re
from pypdf import PageObject, Transformation

MM = 72 / 25.4
TOL = 2.0          # mm


def target_mm(size: str | None) -> tuple[float, float] | None:
    """Catalogue sizes read 'AxB mm' but print as B wide by A high."""
    if not size:
        return None
    m = re.search(r"(\d+)\s*[x×]\s*(\d+)", size, re.I)
    if not m:
        return None
    a, b = int(m.group(1)), int(m.group(2))
    return float(b), float(a)


def page_mm(page: PageObject) -> tuple[float, float]:
    box = page.mediabox
    return float(box.width) / MM, float(box.height) / MM


def fit(page: PageObject, size: str | None, scaled: bool) -> tuple[PageObject, str]:
    """Return (page, note). The page is cropped or scaled to the ordered size."""
    want = target_mm(size)
    if not want:
        return page, "no target size"
    tw, th = want
    pw, ph = page_mm(page)

    if abs(pw - tw) <= TOL and abs(ph - th) <= TOL:
        return page, "as printed"

    if scaled:
        k = min(tw / pw, th / ph)
        page.add_transformation(Transformation().scale(k, k))
        page.mediabox.lower_left = (0, 0)
        page.mediabox.upper_right = (tw * MM, th * MM)
        page.cropbox = page.mediabox
        return page, f"scaled {k:.3f} from {pw:.0f}x{ph:.0f}mm"

    cols = round(pw / tw) if tw else 0
    rows = round(ph / th) if th else 0
    if cols >= 1 and rows >= 1 and (cols > 1 or rows > 1) \
            and abs(cols * tw - pw) <= TOL and abs(rows * th - ph) <= TOL:
        # take the top-left cell; PDF y runs from the bottom
        left = float(page.mediabox.left)
        top = float(page.mediabox.top)
        page.mediabox.lower_left = (left, top - th * MM)
        page.mediabox.upper_right = (left + tw * MM, top)
        page.cropbox = page.mediabox
        return page, f"cropped 1 of {cols*rows} from {pw:.0f}x{ph:.0f}mm"

    return page, f"MISMATCH page {pw:.0f}x{ph:.0f}mm vs ordered {tw:.0f}x{th:.0f}mm"
