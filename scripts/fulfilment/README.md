# Order fulfilment from the artwork library

Turns an order into a print-ready artwork pack: pulls what the library holds,
merges this order's text into personalised templates, and draws anything still
missing in the house style.

## What it produces

One PDF, one page per line item, each page at that sign's true print size.

Every page is labelled by how it was obtained:

| Provenance | Meaning |
|---|---|
| `LIBRARY` | Lifted straight from artwork we already hold |
| `MERGED` | Personalised template with this order's text merged in |
| `GENERATED` | Drawn to the house style because we hold nothing |
| `BLOCKED` | We hold artwork but it must not be used — see below |
| `UNRESOLVED` | Nothing to work from |

## The brand check

Persimmon and Charles Church sites share sign codes but not branding, and the
library indexes by code alone. Pulling `PCF151` for a Persimmon order returned a
Charles Church board — correct sign, wrong company.

`brand.mjs` classifies a page by sampling its logo band. Persimmon's mid and
light greens and Charles Church's crest navy separate cleanly; the near-black
both use does not, so it is ignored. A page whose brand does not match the
order's is `BLOCKED` rather than packed. Shipping another housebuilder's board
to site is the one failure worth stopping the line for.

## House style

**`shop/public/images/products/<CODE>.png` is the spec.** There is a catalogue
image for every product and it is what Persimmon orders against: it settles the
colour, the layout and often the wording. Look at it before drawing anything.
Skipping this step produced a blue `PCF03` and `PCF144` when both are red, and
a `PCF350` that bore no relation to the catalogue one.

Palette measured from those images:

- red `#C22033`, blue `#1E509E`, green `#0D764A`, yellow `#FADC05`, black `#231F20`
- ISO 7010 symbols ship in their own safety colours and are recoloured to these
  on load, so a mandatory disc and the panel it sits on are the same blue
- HelveticaNeue-CondensedBold for sign text, HelveticaNeue-Bold for regular width
- Hazard class sets the colour: prohibition/info red, warning yellow on black,
  mandatory and directional blue, site labels green on white
- The logo is the real vector lockup, cropped from production artwork as the top
  band of a sign and stamped on with pypdf. It is never redrawn.

Catalogue sizes read `AxB mm` but print as **B wide x A high**.

## Safety symbols

The real ISO 7010 set, from [`@iso-safety-signs/assets`](https://karlnorling.github.io/iso-safety-signs/)
(npm, MIT). Each symbol already carries its own disc and the standard colour,
so they are placed as they are rather than wrapped in a background.

| Code | Symbol | Used on |
|---|---|---|
| `M001` | General mandatory | Site organisation — protect unfixed materials |
| `M030` | Place trash in the bin | Site organisation — rubbish in skips |
| `M014` | Head protection | Compound board |
| `M015` | High-visibility clothing | Compound board |
| `M008` | Protective footwear | Compound board |
| `E003` | First aid | Compound board |
| `P036` | No children playing | Compound board |
| `P004` | No access for pedestrians | Compound board |

Only the eight in use are committed, in `assets/iso7010/`. The full 332-symbol
set covers emergency, fire, mandatory, prohibition and warning classes; pull it
from npm when another sign needs one.

Symbols are embedded as data URIs, because several inline SVGs on one page
collide on element ids.

## Fonts

Roboto Condensed Bold and Roboto Bold stand in for Helvetica Neue, which is not
redistributable. They are close but not identical — swap in the real faces before
anything goes to plate.

## Running it

Needs `pypdf` and, for rendering, node with `playwright`, `pdfjs-dist` and
`@napi-rs/canvas`. Chromium comes from `PLAYWRIGHT_BROWSERS_PATH`.

```bash
python3 scripts/fulfilment/build_pack.py PER-20260914-J5NO
```

## Page fitting

A library page is the sheet **as it was printed**, which is not always one sign
at the ordered size. `page_fit.py` handles the two cases that come up:

- **n-up sheet** — `PCF29/F` was printed two-up on a 400x600 sheet. Crop to one cell.
- **wrong size** — `PCF961/F` is covered by the 600x800 artwork of the same
  shape. Scale it down rather than ship a sign twice the size ordered.

Geometry alone cannot tell these apart: an 800x600 page for a 400x300 sign is
both "2x2 up" and "twice the size". The library records whether an entry was
matched directly or covered by scaling, and that decides. Anything that fits
neither is passed through and flagged `MISMATCH`.

## Known gaps

- `PCF03` had no artwork and no close relative, so its layout is a judgement
  call. The hours are confirmed: 08:00-17:30 weekdays, 08:00-13:00 Saturday.
- `PCF151` and `PCFA107` are rebuilt from the Charles Church artwork in the
  1UVU job, panel for panel and word for word, with Persimmon branding. The
  boards are the product; the logo is the housebuilder.
- The **no parking on site roads** symbol is drawn, not ISO: it is a
  road-traffic sign, outside the ISO 7010 set, and the board it came from uses
  the road version.
