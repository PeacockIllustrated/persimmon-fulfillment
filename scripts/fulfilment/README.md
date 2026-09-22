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

Measured from real artwork, not invented:

- red `#E72419`, yellow `#FFDB00`, blue `#005FB9`, green `#0D754C`, black `#231F20`
- HelveticaNeue-CondensedBold for sign text, HelveticaNeue-Bold for regular width
- Hazard class sets the colour: prohibition/info red, warning yellow on black,
  mandatory and directional blue, site labels green on white
- The logo is the real vector lockup, cropped from production artwork as the top
  band of a sign and stamped on with pypdf. It is never redrawn.

Catalogue sizes read `AxB mm` but print as **B wide x A high**.

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

## Known gaps

- A library page is the sheet **as it was printed**, not the sign trimmed to the
  size this order wants. A 300x400 pull can arrive as a 400x600 two-up sheet, and
  a scaled entry points at the artwork of a different size. Both need rescaling
  and trimming before plate.
- `PCF03` had no artwork and no close relative, so its layout is a judgement
  call and its hours are placeholders.
- `PCFA107` is drawn as a welcome/compound board carrying the merged fields. It
  is not a reproduction of the real multi-panel board, which we hold no artwork
  for.
