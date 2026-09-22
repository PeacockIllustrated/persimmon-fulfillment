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
        "status": "ready",           // "ready" | "none"
        "file": "K3PA/PCF465.pdf",   // path within the artwork folder
        "sourceOrder": "PER-20260811-LC5Z",
        "capturedAt": "2026-09-22"
      }
    }
  ],
  "history": { "orderNumbers": [...], "ordersUsedIn": 7, "totalQty": 115, "lastOrdered": "2026-09-21" }
}
```

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

Job folders were named by hand, so `match` tries four things in descending order
of confidence and **never guesses**:

1. A full order number in the folder name — `PER-20260914-J5NO`
2. A purchase order number — matched against `psp_orders.po_number`
3. An order-number suffix, the "last 4" — `J5NO`
4. A site name — `Fairways 351`

A folder that resolves to more than one order is reported as *ambiguous* and one
that resolves to none as *unmatched*, both for a human to settle. Within a
matched folder, files are tied to line items by the product code in the
filename. A file naming a code that is not on that order is flagged as likely
mis-filed rather than silently attached.

> **Note on PO numbers.** Only 2 of 48 orders currently have `po_number` set, so
> strategy 2 almost never fires. If job folders are named by PO number, that
> field needs backfilling before the cross-reference can be complete.
