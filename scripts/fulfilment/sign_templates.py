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
    """PCFA107 -- main compound board carrying this order's merged fields."""
    body = h - w * LOGO_BAND - 8
    def row(label, value, big=False):
        return f"""<div style="display:flex;flex-direction:column;align-items:center;
          padding:{body*0.02}mm 0;">
          <div style="font-family:SignCond;color:#fff;font-size:{body*0.055}mm;
               letter-spacing:.08em;opacity:.85;line-height:1.2;">{label}</div>
          <div style="font-family:SignCond;color:#fff;font-size:{body*(0.145 if big else 0.110)}mm;
               line-height:1.08;text-align:center;">{value}</div></div>"""
    return shell(w, h, f"""
<div class="panel" style="flex:1;background:{BLUE};display:flex;flex-direction:column;
     align-items:stretch;justify-content:center;padding:{body*0.05}mm {w*0.05}mm;
     box-sizing:border-box;overflow:hidden;">
  <div style="font-family:SignCond;color:#fff;font-size:{body*0.085}mm;text-align:center;
       letter-spacing:.06em;opacity:.9;line-height:1.2;">WELCOME TO</div>
  {row("SITE", site, True)}
  <div style="height:{body*0.008}mm;background:rgba(255,255,255,.45);
       margin:{body*0.025}mm 0;flex:0 0 auto;"></div>
  {row("SITE MANAGER", manager)}
  {row("IN AN EMERGENCY CALL", phone)}
</div>""")
