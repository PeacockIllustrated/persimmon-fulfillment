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

```bash
# what would this order take? -- no browser, no renderer, no credentials
build_pack.py PER-20260914-J5NO --resolve-only

# build the pack
build_pack.py PER-20260914-J5NO --artwork-root ~/"Persimmon App Jobs"

# everything still outstanding, moving each order's state as it goes
build_pack.py --outstanding --artwork-root ~/"Persimmon App Jobs" --apply
```

Each order gets a folder under `--out` (default `out/`) holding the pack PDF,
the proof sheet and a manifest recording every page's provenance, brand verdict,
fit note and palette substitutions.

`--from-file` takes an orders JSON export and runs with no database at all.
`--apply` is refused alongside it: it writes, and the export is a copy.

Needs `pypdf`, plus node for rendering and the brand check:

```bash
cd scripts/fulfilment && npm install
```

Node resolves an ESM import by walking up from the **script's own directory**,
so the dependencies have to sit beside these scripts or above them — anywhere
else is invisible to it, which surfaces as `ERR_MODULE_NOT_FOUND` on a path that
plainly contains `node_modules`. Chromium is found via `PLAYWRIGHT_CHROMIUM_PATH`,
then playwright's own resolution, then the newest build under
`PLAYWRIGHT_BROWSERS_PATH`.

## Order of operations

The stages are separable on purpose, and their order is load-bearing:

1. **Resolve** every line item — reads nothing but the library JSON.
2. **Build library pages** — lift, then crop or scale to the size ordered.
3. **Brand check** — needs pages to look at, so it cannot run earlier.
4. **Redraw what it blocked** — a blocked page is still a sign the site needs.
   `PCF151` is the case: the only board we hold is Charles Church branded, so
   it is blocked and then drawn in Persimmon branding. Blocking is about never
   *shipping* another housebuilder's board, not refusing to supply the sign.
5. **Draw everything else** — one browser launch for the lot.
6. **Palette, then size** — and the pack is assembled.

A line item is only ever `UNRESOLVED` when there is nothing to work from and no
house template. It is named in the manifest's `needsAttention` and left out of
the pack: a missing sign is a phone call, a wrong sign on a hoarding is a
reprint and a site visit.

## Fulfilment state

`psp_orders.status` tracks the order as the customer sees it. It says nothing
about whether the artwork exists, so there was no way to ask what still needs
artworking — which is the question `--outstanding` has to answer.

`fulfilment_status` is that second axis and only that:

| State | Meaning |
|---|---|
| `pending` | nobody has resolved this order's line items yet |
| `resolving` | the pack builder is working on it |
| `proof_ready` | a pack and proof sheet exist, waiting on a human |
| `approved` | signed off, page by page |
| `packed` | released to print |

Added in `shop/supabase-setup.sql`, which backfills delivered orders to `packed`
— their artwork was made, even though no row records how — so the first
`--outstanding` run does not try to redo all 42 of them.

Under `--apply` the builder only reaches `proof_ready` when every line item made
it into the pack with nothing flagged. Anything short of that stays `pending`,
because claiming a proof is ready when a sign is missing is worse than saying
nothing.

## One palette across the pack

Library artwork was drawn for litho and its flat brand areas are Pantone spot
colours — **PANTONE 485 C** red, **300 C** blue, **Yellow C** — while pages we
generate are built to the house hex values above. Dropped into one pack the
mismatch shows: `PCF963` rendered `#DE241B` two pages after `PCF144` rendered
`#C22033`.

`palette.py` snaps every page onto the house palette on the way into the pack.
It rewrites two things and nothing else:

- **spot separations** — the flat brand areas. The separation keeps its Pantone
  name, so a RIP still sees one plate; what changes is the alternate space it
  converts through.
- **near-blacks** — rich, registration and flat blacks all become `#231F20`.

Everything else is left as drawn and *reported*. Inline fills are where the
illustration lives: on `PCF963` the figure's jeans are a CMYK blue that
classifies as brand blue and its hi-vis vest as brand yellow, and snapping
either would repaint the drawing. The Persimmon logo is the same trap — its
three greens sit within 35 of house green in plain RGB distance. So a chromatic
inline fill that looks like a brand colour is flagged for a human, never
changed on a guess.

Two things this got wrong first time, both worth keeping in mind:

- **The naive CMYK formula is not what you see.** `255*(1-c)*(1-k)` put the
  colours tens of points out and made the offending red look as though it were
  not in the content stream at all. `cmyk_to_rgb` is the polynomial pdf.js
  uses, which is what the proof renders through.
- **The alternate space is read from its numbers, not its name.** Illustrator
  writes Pantone alternates as an ICCBased Lab profile as often as a plain
  `/Lab` array. Matching on the name caught `Yellow C` and missed `485 C` and
  `300 C`, and the pack came back with two pages still off-palette and nothing
  in the log to say why.

Print note: this redefines a spot, it does not remove it. If a job is going to
litho against a Pantone book, leave the spots alone — matching ink is the
printer's job, and `#C22033` is a screen sample of a catalogue image, not an
ink spec.

## Approval, and the flywheel

A pack is built, proofed, approved page by page, and what was approved becomes
library artwork. That last step is the one that compounds: without it the
library stops growing and every new code is drawn again, order after order,
which is how `PCF465 Safe working load` came to be artworked seven times.

```bash
# build and hand the proof to the admin side
build_pack.py PER-20260914-J5NO --artwork-root ~/"Persimmon App Jobs" --publish

# ... a human approves it at /admin/artwork/PER-20260914-J5NO ...

# file what was approved back into the library
write_back.py PER-20260914-J5NO --artwork-root ~/"Persimmon App Jobs" --apply
```

`--publish` needs `SITE_URL` and `ADMIN_AUTH_TOKEN`, from the environment or
`shop/.env`.

### Admin only

Everything here is behind admin auth, and nothing a Persimmon buyer touches
changed. The approval page lives under `app/(shop)/admin/`, whose layout
redirects anyone without the admin cookie; every route under
`app/api/fulfilment/` checks `isAdminAuthed()` and returns 403 otherwise.

Two decisions were made specifically to keep it that way:

- **Fulfilment state is not on `GET /api/orders`.** That route is reachable
  with shop auth as well as admin auth, so anything added to its response goes
  out to Persimmon's own buyers. The admin page fetches `GET /api/fulfilment`
  alongside it and merges the two client-side, leaving the customer payload
  exactly as it was.
- **The pack is not a column on `psp_orders`.** The admin orders API does
  `select("*")` over every order, so a base64 pack PDF there would be pulled
  into memory on every admin page load. `psp_artwork_packs` and
  `psp_artwork_pages` keep that query the size it is today.

### Decided per page, not per order

Approving a whole order in one click is what keeps a human reviewing all of it
forever. A straight library pull that passed every gate is not the same risk as
a sign drawn from scratch, and only per-page decisions let the second kind
eventually be the only kind that needs eyes.

A rejection has to say what is wrong with it — a rejection with no reason is a
page that gets rebuilt into the same problem. The pack can only be signed off
once every page is decided and none is rejected: an order that goes to print a
sign short is worse than one that waits.

### What gets kept, and as what

| Provenance | Written back as | Why |
|---|---|---|
| `GENERATED` | `ready` | carries no order-specific text, so it is reusable exactly as drawn |
| `MERGED` | `template` | the layout is reusable, the text is this order's site, manager and phone — recording it as `ready` would ship one site's board to another |
| `LIBRARY` | nothing | it came from the library |

`write_back.py` takes its artwork from the pack stored against the order, not
from a file left on disk. A pack built in an agent session goes away with the
container, so reading it back from the database is what makes this runnable
anywhere, at any later date.

It leaves `shop/data/artwork-library.json` and `artwork-registry.json` changed
in the working tree; commit them.

**Measured on J5NO.** Before: 4 `GENERATED`, 2 `MERGED`, 3 `LIBRARY`. Approve
and write back, and the same order rebuilds as 7 `LIBRARY`, 2 `MERGED`, nothing
drawn — including `PCF151`, which had been blocked as Charles Church and is now
our own Persimmon board. The registry went 77 to 80 codes. The two that stay
`MERGED` stay that way permanently, and should: their text is the site's.

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
