"""Generate the missing J5NO signs in the Persimmon house style.

Style taken from measured artwork, not invented:
  red #E72419, yellow #FFDB00, blue #005FB9, green #0D754C, black #231F20
  HelveticaNeue-CondensedBold (stand-in: Roboto Condensed Bold)
Catalogue sizes read "AxB mm" but print as B wide x A high.
"""
import base64, pathlib

# Fonts and the extracted vector logo band live alongside this module.
ASSETS = pathlib.Path(__file__).resolve().parent / "assets"

RED, YELLOW, BLUE, GREEN, BLACK = "#E72419", "#FFDB00", "#005FB9", "#0D754C", "#231F20"
LOGO_BAND = 0.1464          # logo band height as a fraction of sign width

def font_css():
    cond = base64.b64encode((ASSETS / "RobotoCondensed-Bold.woff2").read_bytes()).decode()
    reg = base64.b64encode((ASSETS / "Roboto-Bold.woff2").read_bytes()).decode()
    return f"""
@font-face {{ font-family:'SignCond'; font-weight:700;
  src:url(data:font/woff2;base64,{cond}) format('woff2'); }}
@font-face {{ font-family:'SignReg'; font-weight:700;
  src:url(data:font/woff2;base64,{reg}) format('woff2'); }}"""


LOGO_BG = ""          # proofs set this to the logo image; production leaves it
                      # empty and the real vector logo is stamped in afterwards.


def use_proof_logo():
    """Show the logo in HTML renders. Production PDFs get the vector stamp."""
    global LOGO_BG
    data = base64.b64encode((ASSETS / "logoband.png").read_bytes()).decode()
    LOGO_BG = f"background-image:url(data:image/png;base64,{data})"


def fit_size(lines, inner_w, inner_h, line_height=1.10, char_w=0.60, cap=None):
    """Largest font size (mm) at which these lines fit the box on both axes.

    char_w is the average glyph advance as a fraction of the font size:
    ~0.60 for Roboto Bold, ~0.52 for the condensed cut. Measured by eye against
    rendered output, so it is deliberately conservative -- text that is a shade
    small is a nuisance, text that overruns the keyline is a reprint.
    """
    longest = max((len(l) for l in lines), default=1)
    by_width = inner_w / max(longest * char_w, 0.001)
    by_height = inner_h / max(len(lines) * line_height, 0.001)
    return min(by_width, by_height, cap or 1e9)


def shell(w_mm, h_mm, body, pad=4.0):
    """Page shell: reserves the logo band at the top, body fills the rest."""
    band = w_mm * LOGO_BAND
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
{font_css()}
@page {{ size:{w_mm}mm {h_mm}mm; margin:0; }}
html,body {{ margin:0; padding:0; width:{w_mm}mm; height:{h_mm}mm;
  overflow:hidden; background:#fff;
  -webkit-print-color-adjust:exact; print-color-adjust:exact; }}
/* Absolute, so no stray line box can push the sheet past the page and make
   Chromium paginate a single sign onto two pages. */
.sheet {{ position:absolute; top:0; left:0; width:{w_mm}mm; height:{h_mm}mm;
  box-sizing:border-box; padding:{pad}mm; display:flex; flex-direction:column;
  overflow:hidden; }}
.logoband {{ height:{band}mm; flex:0 0 {band}mm; background-size:contain;
  background-repeat:no-repeat; background-position:center; }}
.body {{ flex:1 1 auto; display:flex; min-height:0; }}
.panel {{ border-radius:{w_mm*0.035}mm; }}
</style></head><body><div class="sheet">
<div class="logoband" style="{LOGO_BG}"></div>
<div class="body">{body}</div></div></body></html>"""


def pedestrians_ahead(w, h):
    """PCF144 -- solid blue directional panel, white text over a white arrow."""
    body = h - w * LOGO_BAND - 8            # height actually available
    return shell(w, h, f"""
<div class="panel" style="flex:1;background:{BLUE};display:flex;flex-direction:column;
     align-items:center;justify-content:center;gap:{body*0.05}mm;
     padding:{body*0.07}mm 0;box-sizing:border-box;overflow:hidden;">
  <div style="font-family:SignCond;color:#fff;font-size:{body*0.24}mm;line-height:0.96;
       letter-spacing:-0.01em;text-align:center;">PEDESTRIANS<br>AHEAD</div>
  <svg viewBox="0 0 100 100" style="width:{body*0.32}mm;height:{body*0.32}mm;flex:0 0 auto;">
    <path d="M50 6 L86 44 L66 44 L66 94 L34 94 L34 44 L14 44 Z" fill="#fff"/>
  </svg>
</div>""")


def parking_left(w, h):
    """PCF350 -- house parking treatment: blue keyline, white field,
    blue left arrow, blue P tile with a white P, black PARKING.

    Follows PCF316, the only parking sign we hold artwork for, rather than the
    solid directional panel: a solid panel bleeds to the sheet edge and leaves
    nowhere for the word to sit.

    Width is the binding constraint on a landscape sign, so the row is budgeted
    across the available width first and only then capped by height. Sizing the
    glyphs off height alone pushed the word through the keyline.

    The arrow tip is at x=6, the left edge of the viewBox. A right-hand variant
    mirrors this path; do not reuse this one for it.
    """
    frame, margin, padding = h*0.030, w*0.030, h*0.055
    inner_w = w - 2*margin - 2*frame - 2*padding
    inner_h = h - w*LOGO_BAND - 8 - 2*margin - 2*frame - 2*padding

    arrow_w = inner_w * 0.27
    tile_w = inner_w * 0.22
    word_w = inner_w * 0.39
    gap = inner_w * 0.05                      # two gaps: .27+.05+.22+.05+.39 = 0.98

    arrow = min(arrow_w, inner_h * 0.90)
    tile_pad = tile_w * 0.14
    tile_font = min((tile_w - 2*tile_pad) / 0.62, inner_h * 0.80 / 1.06)
    word = min(word_w / (len("PARKING") * 0.52), inner_h * 0.34)

    return shell(w, h, f"""
<div class="panel" style="flex:1;margin:0 {margin}mm {margin}mm;
     border:{frame}mm solid {BLUE};display:flex;align-items:center;
     justify-content:center;gap:{gap}mm;padding:{padding}mm;
     box-sizing:border-box;overflow:hidden;">
  <svg viewBox="0 0 100 100" style="width:{arrow}mm;height:{arrow}mm;flex:0 0 auto;">
    <path d="M6 50 L44 16 L44 34 L94 34 L94 66 L44 66 L44 84 Z" fill="{BLUE}"/>
  </svg>
  <div style="background:{BLUE};color:#fff;font-family:SignReg;font-size:{tile_font}mm;
       line-height:1.06;padding:{tile_pad*0.45}mm {tile_pad}mm;
       border-radius:{w*0.014}mm;flex:0 0 auto;">P</div>
  <div style="font-family:SignCond;color:{BLACK};font-size:{word}mm;line-height:1;
       white-space:nowrap;flex:0 0 auto;">PARKING</div>
</div>""")


def working_hours(w, h, rows, site):
    """PCF03 -- Security-class board: blue header, white body, black hours."""
    tr = "".join(
        f"""<div style="display:flex;justify-content:space-between;align-items:baseline;
        padding:{h*0.018}mm {w*0.045}mm;border-bottom:{h*0.006}mm solid #D8D8D8;">
        <span style="font-family:SignCond;color:{BLACK};font-size:{h*0.085}mm;">{d}</span>
        <span style="font-family:SignCond;color:{BLACK};font-size:{h*0.085}mm;">{t}</span></div>"""
        for d, t in rows)
    return shell(w, h, f"""
<div class="panel" style="flex:1;border:{h*0.022}mm solid {BLUE};display:flex;
     flex-direction:column;overflow:hidden;">
  <div style="background:{BLUE};color:#fff;font-family:SignCond;font-size:{h*0.115}mm;
       text-align:center;padding:{h*0.025}mm 0;line-height:1;">SITE WORKING HOURS</div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">{tr}</div>
  <div style="font-family:SignCond;color:{BLACK};font-size:{h*0.052}mm;text-align:center;
       padding:{h*0.018}mm 0;opacity:.75;">{site}</div>
</div>""")


def green_on_white(w, h, text):
    """PCF114 -- green keyline, green text, centred, with white breathing room.

    The reference keeps a clear white margin inside the keyline. Sizing the
    type off the sign rather than off that inner box is what pushed the last
    line through the frame.
    """
    frame = h * 0.030                      # keyline weight
    margin = w * 0.030                     # white margin outside the keyline
    padding = h * 0.075                    # white margin inside the keyline
    inner_w = w - 2*margin - 2*frame - 2*padding
    inner_h = h - w*LOGO_BAND - 8 - 2*margin - 2*frame - 2*padding
    size = fit_size(text, inner_w, inner_h, line_height=1.12, char_w=0.60)
    return shell(w, h, f"""
<div class="panel" style="flex:1;margin:0 {margin}mm {margin}mm;
     border:{frame}mm solid {GREEN};display:flex;align-items:center;
     justify-content:center;padding:{padding}mm;box-sizing:border-box;
     overflow:hidden;">
  <div style="font-family:SignReg;color:{GREEN};font-size:{size}mm;line-height:1.12;
       text-align:center;">{"<br>".join(text)}</div>
</div>""")


def compound_board(w, h, site, manager, phone):
    """PCFA107 -- Landscape Main Compound Board, Persimmon branded.

    Rebuilt from the Charles Church board we hold artwork for: same panels,
    same wording, same two fill-in fields. The source is 2440x1220 (2:1); this
    order's is narrower, so the two columns carry a little more depth.

    Every block is sized to its own column width and the column is then scaled
    to the height available, the same two-pass fit the site organisation board
    uses. Fixed sizes wrap and push the last row off the board.
    """
    margin = w * 0.030
    avail_h = h - w*LOGO_BAND - 8 - margin
    col_w = (w - 2*margin) / 2 - w*0.012
    gap = avail_h * 0.020
    pad_y, pad_x = avail_h * 0.022, col_w * 0.040

    def size_for(lines, width, cap):
        return fit_size(lines, width, 1e9, char_w=0.52, cap=cap)

    ICON = col_w * 0.145

    left_spec = [
        ("title", [site], 0.115),
        ("panel", ["WE APOLOGISE FOR ANY INCONVENIENCE",
                   "CAUSED DURING DEVELOPMENT WORKS"], 0.052, GREEN),
        ("icons", [(iso("M014", ICON), ["SAFETY HELMETS", "MUST BE WORN"]),
                   (iso("M015", ICON), ["HIGH VISIBILITY CLOTHING", "MUST BE WORN"]),
                   (iso("M008", ICON), ["PROTECTIVE FOOTWEAR", "MUST BE WORN"])],
         0.048, BLUE),
    ]
    right_spec = [
        ("icons", [(iso("P036", ICON),
                    ["PARENTS, BUILDING SITES ARE DANGEROUS",
                     "PLEASE KEEP YOUR CHILDREN AWAY"]),
                   (iso("P004", ICON),
                    ["ANY PERSON CAUGHT PILFERING OR CAUSING",
                     "DAMAGE WILL BE LIABLE FOR PROSECUTION"])],
         0.044, RED),
        ("firstaid", ["FIRST AID EQUIPMENT KEPT", "IN THE SITE OFFICE"], 0.048, GREEN),
        ("panel", ["ALL DRIVERS &amp; VISITORS PLEASE",
                   "REPORT TO THE SITE OFFICE"], 0.052, BLUE),
        ("field", ("SITE MANAGER", manager), 0.052, GREEN),
        ("field", ("EMERGENCY CONTACT", phone), 0.052, GREEN),
    ]

    def render(spec):
        out, est = [], gap * (len(spec) - 1)
        for item in spec:
            kind, payload, frac = item[0], item[1], item[2]
            bg = item[3] if len(item) > 3 else None
            if kind == "title":
                sz = size_for(payload, col_w, avail_h*frac)
                est += sz * 1.15
                out.append(f'<div style="font-family:SignCond;color:{BLACK};'
                           f'font-size:{sz}mm;line-height:1.05;white-space:nowrap;">'
                           f'{payload[0]}</div>')
            elif kind == "panel":
                sz = size_for(payload, col_w - 2*pad_x, avail_h*frac)
                est += len(payload)*sz*1.12 + 2*pad_y
                out.append(f'<div style="background:{bg};border-radius:{w*0.012}mm;'
                           f'padding:{pad_y}mm {pad_x}mm;font-family:SignCond;color:#fff;'
                           f'font-size:{sz}mm;line-height:1.12;text-align:center;'
                           f'white-space:nowrap;box-sizing:border-box;">'
                           f'{"<br>".join(payload)}</div>')
            elif kind == "icons":
                rows, inner = [], col_w - 2*pad_x - ICON - pad_x
                for svg, lines in payload:
                    sz = size_for(lines, inner, avail_h*frac)
                    est += max(len(lines)*sz*1.12, ICON) + pad_y
                    # disc on white, text on the colour: a blue disc inside a
                    # blue panel disappears.
                    rows.append(f'<div style="display:flex;align-items:center;'
                                f'gap:{pad_x*0.8}mm;">{svg}'
                                f'<div style="background:{bg};border-radius:{w*0.010}mm;'
                                f'flex:1;padding:{pad_y*0.55}mm {pad_x*0.6}mm;'
                                f'font-family:SignCond;color:#fff;font-size:{sz}mm;'
                                f'line-height:1.12;text-align:center;white-space:nowrap;'
                                f'box-sizing:border-box;">{"<br>".join(lines)}</div></div>')
                est += pad_y
                out.append(f'<div style="display:flex;flex-direction:column;gap:{gap*0.55}mm;'
                           f'background:#fff;border:{avail_h*0.009}mm solid {bg};'
                           f'border-radius:{w*0.013}mm;padding:{pad_y*0.6}mm;'
                           f'box-sizing:border-box;">{"".join(rows)}</div>')
            elif kind == "firstaid":
                sz = size_for(payload, col_w*0.68 - 2*pad_x, avail_h*frac)
                est += len(payload)*sz*1.12 + 2*pad_y
                out.append(f'<div style="display:flex;gap:{gap*0.6}mm;">'
                           f'<div style="background:{bg};border-radius:{w*0.012}mm;'
                           f'flex:0 0 26%;display:flex;align-items:center;justify-content:center;'
                           f'gap:{pad_x*0.6}mm;padding:{pad_y*0.7}mm;box-sizing:border-box;">'
                           f'{iso("E003", ICON*0.85)}'
                           f'<div style="font-family:SignCond;color:#fff;font-size:{sz}mm;'
                           f'line-height:1.05;">FIRST<br>AID</div></div>'
                           f'<div style="flex:1;background:{bg};border-radius:{w*0.012}mm;'
                           f'display:flex;align-items:center;justify-content:center;'
                           f'padding:{pad_y}mm {pad_x}mm;font-family:SignCond;color:#fff;'
                           f'font-size:{sz}mm;line-height:1.12;text-align:center;'
                           f'white-space:nowrap;box-sizing:border-box;">'
                           f'{"<br>".join(payload)}</div></div>')
            elif kind == "field":
                label, value = payload
                sz = size_for([label], col_w*0.38 - pad_x, avail_h*frac)
                vs = size_for([value], col_w*0.58 - pad_x, avail_h*frac*1.25)
                est += max(sz, vs)*1.30 + 2*pad_y
                out.append(f'<div style="display:flex;gap:{pad_x}mm;background:{bg};'
                           f'border-radius:{w*0.012}mm;padding:{pad_y*0.8}mm {pad_x}mm;'
                           f'box-sizing:border-box;">'
                           f'<div style="font-family:SignCond;color:#fff;font-size:{sz}mm;'
                           f'display:flex;align-items:center;flex:0 0 40%;'
                           f'white-space:nowrap;">{label}</div>'
                           f'<div style="background:#fff;border-radius:{w*0.006}mm;flex:1;'
                           f'display:flex;align-items:center;justify-content:center;'
                           f'font-family:SignCond;color:{BLACK};font-size:{vs}mm;'
                           f'padding:{pad_y*0.4}mm 0;white-space:nowrap;">{value}</div></div>')
        return "".join(out), est

    left_html, left_h = render(left_spec)
    right_html, right_h = render(right_spec)
    zoom = min(1.0, avail_h * 0.94 / max(left_h, right_h, 1))

    return shell(w, h, f"""
<div style="flex:1;display:flex;gap:{w*0.024}mm;margin:0 {margin}mm {margin}mm;
     overflow:hidden;zoom:{zoom:.4f};">
  <div style="flex:1;display:flex;flex-direction:column;gap:{gap}mm;">{left_html}</div>
  <div style="flex:1;display:flex;flex-direction:column;gap:{gap}mm;">{right_html}</div>
</div>""")

# --------------------------------------------------------------------------
# Safety pictograms
#
# The real ISO 7010 symbols, from @iso-safety-signs/assets (npm, MIT), rather
# than drawn by hand. Each file carries its own disc and the standard colour,
# so they are placed as they are and never wrapped in a background.
#
#   M001 general mandatory         M030 place trash in the bin
#   M008 protective footwear       E003 first aid
#   M014 head protection           P004 no access for pedestrians
#   M015 high-visibility clothing  P036 no children playing
#
# Embedded as data URIs: several inline SVGs on one page collide on element
# ids, and an <img> keeps each symbol in its own document.
# --------------------------------------------------------------------------

ISO_DIR = ASSETS / "iso7010"
_iso_cache: dict[str, str] = {}


def iso(code, size_mm):
    """An ISO 7010 symbol at a given size."""
    if code not in _iso_cache:
        _iso_cache[code] = base64.b64encode((ISO_DIR / f"{code}.svg").read_bytes()).decode()
    return (f'<img src="data:image/svg+xml;base64,{_iso_cache[code]}" alt="{code}" '
            f'style="width:{size_mm}mm;height:{size_mm}mm;flex:0 0 auto;'
            f'object-fit:contain;">')


def no_parking(size_mm):
    """No parking on site roads.

    Drawn rather than ISO: this is a road-traffic sign, outside the ISO 7010
    set, and the board it comes from uses the road version.
    """
    return (f'<svg viewBox="0 0 100 100" style="width:{size_mm}mm;height:{size_mm}mm;'
            f'flex:0 0 auto;">'
            f'<circle cx="50" cy="50" r="46" fill="{BLUE}"/>'
            f'<path d="M38 26h18a13 13 0 0 1 0 26h-9v22h-9z" fill="#fff"/>'
            f'<circle cx="50" cy="50" r="42" fill="none" stroke="{RED}" stroke-width="9"/>'
            f'<rect x="45" y="2" width="10" height="96" fill="{RED}"'
            f' transform="rotate(45 50 50)"/></svg>')


def site_organisation(w, h):
    """PCF151 -- Site Organisation board, Persimmon branded.

    Layout and wording follow the Charles Church board we hold artwork for.
    Only the branding changes: the board is the product, the logo is the
    housebuilder. "SKIES PROVIDED" in the original is a typo for SKIPS and is
    corrected here.

    Rows are laid out in two passes -- size each row to its own width, then
    scale the lot to the height available. Assuming line counts instead let
    the text wrap and pushed half the board off the bottom.
    """
    margin = w * 0.045
    avail_h = h - w*LOGO_BAND - 8 - margin
    avail_w = w - 2*margin

    # (background, lines, relative weight, icon, text colour)
    spec = [
        (None,   ["SITE ORGANISATION"],                       1.05, None, BLACK),
        (RED,    ["WE CARE"],                                 2.20, None, "#fff"),
        (RED,    ["TOP QUALITY IS WHAT CUSTOMERS",
                  "DESERVE AND WE PROVIDE IT."],              0.85, None, "#fff"),
        (RED,    ["THINK QUALITY.",
                  "GET IT RIGHT FIRST TIME"],                 0.85, None, "#fff"),
        (RED,    ["TAKE PRIDE IN YOUR WORK"],                 1.15, None, "#fff"),
        (BLUE,   ["PROTECT AND RE-COVER ALL",
                  "UNFIXED MATERIALS"],                       0.85, "M001", "#fff"),
        (BLUE,   ["PLEASE PLACE YOUR RUBBISH AND",
                  "PACKAGING IN THE SKIPS PROVIDED"],         0.85, "M030", "#fff"),
        (YELLOW, ["No Parking is permitted",
                  "on site roads"],                           0.85, "NOPARK", BLACK),
        (GREEN,  ["WE PROMOTE SITE SAFETY",
                  "AND TEAMWORK ON THIS SITE"],               0.95, None, "#fff"),
    ]

    gap = avail_h * 0.012
    pad_y, pad_x = avail_h * 0.016, avail_w * 0.035
    icon_frac = 0.95                       # icon height against the row's text block

    # pass 1: width-limited size for each row
    sizes = []
    for bg, lines, weight, icon, _fg in spec:
        text_w = avail_w - 2*pad_x - (avail_w * 0.16 if icon else 0)
        sizes.append(fit_size(lines, text_w, 1e9, char_w=0.52, cap=weight * avail_h * 0.10))

    # pass 2: shrink everything until the column fits the height
    def column_height(ss):
        total = gap * (len(spec) - 1)
        for (bg, lines, _w, _i, _f), size in zip(spec, ss):
            total += len(lines) * size * 1.10 + (2*pad_y if bg else 0)
        return total

    # 0.95 leaves headroom for the browser's line box being a shade taller
    # than line-height alone predicts; without it the column clips at both ends.
    # 0.88 leaves headroom: the browser's line box runs taller than
    # line-height alone predicts, and padding rounds up per row. Erring small
    # costs a little white space; erring large clips the last row off the board.
    scale = min(1.0, avail_h * 0.88 / column_height(sizes))
    sizes = [x * scale for x in sizes]

    rows = []
    for (bg, lines, _wt, icon, fg), size in zip(spec, sizes):
        body = (f'<div style="font-family:SignCond;color:{fg};font-size:{size}mm;'
                f'line-height:1.10;text-align:center;flex:1;white-space:nowrap;">'
                f'{"<br>".join(lines)}</div>')
        if bg is None:
            rows.append(body)
            continue
        panel = (f'<div style="background:{bg};border-radius:{w*0.020}mm;flex:1;'
                 f'display:flex;align-items:center;padding:{pad_y}mm {pad_x}mm;'
                 f'box-sizing:border-box;">{body}</div>')
        if icon is None:
            rows.append(panel)
            continue
        # The disc sits on white beside the panel, never inside it: a blue
        # mandatory disc on a blue row is invisible, which is exactly how the
        # first two rows here shipped.
        px = size * len(lines) * 1.10 * icon_frac
        glyph = no_parking(px) if icon == "NOPARK" else iso(icon, px)
        rows.append(f'<div style="display:flex;align-items:center;gap:{pad_x*0.7}mm;">'
                    f'{glyph}{panel}</div>')

    return shell(w, h, f"""
<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-start;
     gap:{gap}mm;margin:0 {margin}mm {margin}mm;overflow:hidden;">{"".join(rows)}</div>""")
