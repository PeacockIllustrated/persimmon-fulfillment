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
    """PCF350 -- solid blue directional panel: LEFT arrow, P tile, PARKING.

    The arrow tip is at x=6 (left edge of the viewBox). A right-pointing
    variant mirrors this path; do not reuse this one for it.
    """
    body = h - w * LOGO_BAND - 8
    return shell(w, h, f"""
<div class="panel" style="flex:1;background:{BLUE};display:flex;align-items:center;
     justify-content:center;gap:{w*0.045}mm;padding:{body*0.08}mm {w*0.05}mm;
     box-sizing:border-box;overflow:hidden;">
  <svg viewBox="0 0 100 100" style="width:{body*0.52}mm;height:{body*0.52}mm;flex:0 0 auto;">
    <path d="M6 50 L44 12 L44 32 L94 32 L94 68 L44 68 L44 88 Z" fill="#fff"/>
  </svg>
  <div style="display:flex;flex-direction:column;align-items:center;flex:0 0 auto;">
    <div style="background:#fff;color:{BLUE};font-family:SignReg;font-size:{body*0.42}mm;
         line-height:1.06;padding:0 {body*0.10}mm;border-radius:{w*0.018}mm;">P</div>
    <div style="font-family:SignCond;color:#fff;font-size:{body*0.17}mm;line-height:1;
         margin-top:{body*0.06}mm;">PARKING</div>
  </div>
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
    """PCF114 -- green keyline, green text, centred."""
    n = max(len(l) for l in text)
    size = min(h * 0.30, w * 1.55 / n)
    lines = "<br>".join(text)
    return shell(w, h, f"""
<div class="panel" style="flex:1;border:{h*0.030}mm solid {GREEN};display:flex;
     align-items:center;justify-content:center;padding:{h*0.05}mm {w*0.04}mm;">
  <div style="font-family:SignReg;color:{GREEN};font-size:{size}mm;line-height:1.08;
       text-align:center;">{lines}</div>
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
