# Ready-made artwork library

## Why

Every sign we make gets artworked once and then, today, effectively forgotten.
The same `PCF465 Safe working load` has been drawn for seven different orders.
The library fixes that: once a sign has production artwork, the next order for
it is a pull from stock rather than a job for the studio.

`shop/data/artwork-library.json` is that record. It is built from the real order
history, so it lists every sign we have actually sold, how often, and whether we
hold artwork for it.

## The three kinds of sign

Not everything can be auto-fulfilled, and the library is explicit about it:

| Kind | Example | Auto-fulfillable? |
|---|---|---|
| Standard | `PCF465/F` Safe working load | Yes — one file, reused forever |
| Personalised | `PCFA107` compound board (site name, manager, phone) | Layout reusable, text merged per order |
| One-off | `CUSTOM-ITEM` | No — quoted and drawn each time |

Entries with `"personalised": true` carry order-specific text. Their artwork is a
template, never a finished file, so the fulfilment report lists them separately.

## Data model

One entry per base code, one variant per size/material we have actually sold:

```jsonc
{
  "baseCode": "PCF465",
  "name": "Safe working load",
  "personalised": false,
  "variants": [
    {
      "code": "PCF465/F",
      "size": "300x400mm",
      "material": "4mm Correx",
      "qty": 42,                     // total ever ordered at this size
      "artwork": {
        "status": "ready",           // "ready" | "ready-scaled" | "none"
        "file": "K3PA/PCF465.pdf",   // path within the artwork folder
        "sourceOrder": "PER-20260811-LC5Z",
        "capturedAt": "2026-09-22"
      }
    }
  ],
  "history": { "orderNumbers": [...], "ordersUsedIn": 7, "totalQty": 115, "lastOrdered": "2026-09-21" }
}
```

`"ready-scaled"` means we hold artwork for a different size of the same shape.
A 300x400 and a 600x800 are both 3:4, so one file scales to the other with no
redrawing; a 400x600 is 2:3 and does not. The `scaledFrom` field names the
variant the file was actually drawn at.

`shop/data/artwork-registry.json` is **generated** from this file. It is the flat
list of base codes that `lib/order-list-pdf.tsx` reads to print the artwork
column. Do not hand-edit it — edit the library and re-run `seed`.

## Usage

```bash
# 1. Rebuild the library from the live order history
python3 scripts/artwork_library.py seed

# 2. Point it at the finished-artwork folder to see what maps to what
python3 scripts/artwork_library.py match "/path/to/Persimmon App Jobs"

# 3. Happy with the mapping? Record it
python3 scripts/artwork_library.py match "/path/to/Persimmon App Jobs" --apply

# What have we got, and what is worth drawing next?
python3 scripts/artwork_library.py report

# What can this order be fulfilled from?
python3 scripts/artwork_library.py report --order PER-20260914-J5NO
```

All three accept `--from-file orders.json` to work from an export instead of
hitting Supabase, for machines without database credentials.

## How folder matching works

Job folders were named by hand, so `match` tries these in descending order of
confidence and **never guesses**:

1. A full order number in the folder name — `PER-20260914-J5NO`
2. A purchase order number — matched against `psp_orders.po_number`
3. An order-number suffix, the "last 4" — `J5NO`
4. A site name — `Fairways 351`
5. The same suffix allowing for O/0 and I/L/1 being mistyped — `ANCO` → `ANC0`

`shop/data/folder-overrides.json` is checked before all of these: it records
folder-to-order corrections settled by a human, such as `K1RA` →
`PER-20260511-K1R4`. Add an entry whenever `match` reports a folder unmatched
and you know where it belongs.

A folder matching more than one order is reported as *ambiguous*, one matching
none as *unmatched*, both for a human to settle. Unmatched folders get a
near-miss hint (`K1RA` → `PER-20260511-K1R4`) which is never applied
automatically: one wrong character is exactly how artwork ends up filed against
the wrong job.

> **Note on PO numbers.** Only 2 of 48 orders have `po_number` set, so strategy 2
> almost never fires. Folders are named by order number instead, which is why
> strategies 3 and 5 do the real work.

## How signs are identified

Filenames inside a job folder are sizes (`600x400.pdf`) or just `PRINT.pdf` —
they identify nothing. The artwork does: a print PDF holds one sign per page,
and the sign's own wording says which sign it is. `scripts/sign_reader.py`
extracts the text from each page and matches it against catalogue names.

These are Illustrator/InDesign exports with no `/ToUnicode` map, so the text is
font-encoded rather than Unicode and ligatures arrive as control codes. The text
is normalised hard and matched on distinctive words, which is plenty to
recognise a sign but not to reproduce it.

Every page lands in one of four buckets:

| Tier | Meaning | Written to the library? |
|---|---|---|
| `confirmed` | Near-exact match to an item on that order | Yes |
| `likely` | Looser match to an item on that order | Yes |
| `review` | No item on the order fits; a catalogue-wide guess | **No** |
| unidentified | Blank, image-only, or bespoke custom text | No |

Where a folder holds several PDFs, the file recorded against a variant is the
one whose filename carries that variant's size — print files are named by sheet
size (`2440x1220.pdf`) and the catalogue by sign size (`1220x2440mm`), the same
pair transposed. Without this a sign ordered at two sizes gets whichever file
sorted first. When no filename matches, every candidate is kept rather than one
picked arbitrarily.

The order's own line items always get first refusal, because matching
catalogue-wide first produces confident-looking wrong answers — a page reading
"HI VIZ MUST BE WORN BEYOND THIS POINT" scores higher against the PPE sign's
wording than against the hi-viz sign it actually is. Anything in `review` is
printed for a human and deliberately left out of the library.
