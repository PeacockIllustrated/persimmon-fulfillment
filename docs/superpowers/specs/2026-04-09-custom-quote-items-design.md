# Custom (Non-Sign) Quote Items + Unified PO Gate

**Date:** 2026-04-09
**Status:** Draft — awaiting user review

## Problem

Users occasionally need to order items that don't appear in the catalogue and aren't signs (so the existing `/custom-sign` flow doesn't apply). Today there's no way to request these — users either fudge an existing product or contact the team out-of-band.

Additionally, orders containing unpriced custom items (custom signs and custom sizes) are currently sent to the PO officer (Nest) immediately on submission via the Make.com webhook in `shop/app/api/orders/route.ts`. The PO officer ends up raising POs for items that don't yet have a price, which creates rework. These need to stay internal until admin has priced every custom item on the order.

## Goals

1. Let users request a custom non-sign item with: optional code, description, size, material, quantity, and additional notes.
2. Any order containing any unpriced custom item (regardless of type — custom sign, custom size, or custom non-sign) must **not** be auto-sent to the PO officer. It must stay internal until admin prices all custom items.
3. Reuse the existing "Send to Nest" admin button as the manual release point — no new buttons.
4. Reuse the existing admin inline pricing UI and "Requires Pricing" filter tab — no new admin surfaces.

## Non-Goals

- Changing how custom signs or custom sizes are requested on the shop side.
- Changing the admin inline pricing UI (it's already generic over `custom_data`).
- Changing the Make.com scenario downstream of the webhook.
- Modifying the customer confirmation email or internal team notification email behaviour — those still fire on every order.
- Any DB migration. The `psp_order_items.custom_data` column is already JSONB and is the natural home for the new variant.

## Design

### 1. New `custom_data` variant

The `custom_data` JSONB column on `psp_order_items` already holds a discriminated union with `type: "custom_sign" | "custom_fields" | "custom_size"` (see `shop/app/api/orders/route.ts:52-80`). Add a fourth variant:

```ts
{
  type: "custom_quote",
  code: string | null,        // optional user-supplied code
  description: string,        // required, what the item is
  size: string,               // required, free text (e.g. "600x400mm")
  material: string,           // required, free text (e.g. "Aluminium")
  additionalNotes: string     // optional free text
}
```

No DB migration. No changes to the admin inline pricing endpoint at `shop/app/api/orders/[orderNumber]/items/[itemId]/route.ts` — it already accepts any item where `custom_data != null` (line 46).

### 2. New shop page: `/custom-item`

A new page at `shop/app/(shop)/custom-item/page.tsx` modelled on the existing `/custom-sign` page. Fields:

- **Product code** (optional, free text)
- **Description** (required, textarea)
- **Size** (required, free text — e.g. "600×400mm")
- **Material** (required, free text — e.g. "Aluminium composite")
- **Quantity** (required, numeric stepper, min 1)
- **Additional notes** (optional, textarea)

On "Add to Basket", the page calls `useBasket().addItem(...)` with:
- `code: CUSTOM-ITEM-${Date.now()}`
- `baseCode: "CUSTOM-ITEM"`
- `name: "Custom Item (Quote on Request)"`
- `size: <user size>`
- `material: <user material>`
- `description: <description> — <size> — <material>`
- `price: 0`
- `image: <placeholder icon data URI or static asset>`
- A new `customQuote` field on the basket item shape carrying `{ code, description, size, material, additionalNotes }`.

The **Add to Basket** button is disabled until `description`, `size`, and `material` are all non-empty.

The page's layout mirrors `/custom-sign`: branded hero, left-column form, right-column summary card with "Quote on request" price label, and the same green CTA button style.

### 3. Basket item type extension

`shop/components/BasketContext.tsx` (or wherever the basket item type lives) gains an optional `customQuote` field on the item shape, parallel to the existing `customSign`, `customSizeData`, and `customFieldValues` fields. It carries the fields described in section 1.

### 4. Orders API accepts `customQuote`

In `shop/app/api/orders/route.ts`:

- Widen the inline `item` type on line 38 to include `customQuote?: { code: string | null; description: string; size: string; material: string; additionalNotes: string }`.
- Widen the `isQuoteItem` check on line 41: `const isQuoteItem = !!item.customSign || !!item.customSizeData?.requiresQuote || !!item.customQuote;`
- Add a branch to the `custom_data` builder (between lines 60 and 80):

```ts
} else if (item.customQuote) {
  custom_data = {
    type: "custom_quote" as const,
    code: item.customQuote.code ? String(item.customQuote.code) : null,
    description: String(item.customQuote.description),
    size: String(item.customQuote.size),
    material: String(item.customQuote.material),
    additionalNotes: String(item.customQuote.additionalNotes || ""),
  };
}
```

Validation: description, size, and material must be non-empty strings; otherwise throw `"Invalid custom quote item"` to be caught by the existing error handler.

### 5. PO gate — server side

Create a small helper in `shop/lib/delivery.ts` or a new `shop/lib/order-gating.ts`:

```ts
export function orderHasUnpricedCustomItems(
  items: Array<{ price: number | string; custom_data: unknown }>
): boolean {
  return items.some(
    (i) => i.custom_data != null && Number(i.price) === 0
  );
}
```

Apply it at two enforcement points:

**5a. `POST /api/orders`** (`shop/app/api/orders/route.ts`, around line 171):

Wrap the Make webhook fire in a check. If `orderHasUnpricedCustomItems(itemsWithOrderId)` is true:
- Skip the Make webhook call entirely.
- Still await `sendOrderConfirmation` (customer receipt) and `sendTeamNotification` (internal).
- Log `Order ${orderNumber} held for pricing — Make webhook skipped`.

If false, behave exactly as today.

**5b. `POST /api/orders/[orderNumber]/send-to-nest`** (`shop/app/api/orders/[orderNumber]/send-to-nest/route.ts`):

After the existing status check (line 29), add:

```ts
if (orderHasUnpricedCustomItems(items || [])) {
  return NextResponse.json(
    { error: "Order has unpriced custom items — price them before sending to Nest" },
    { status: 400 }
  );
}
```

This is the defence-in-depth layer in case the UI is bypassed.

### 6. PO gate — admin UI

In `shop/app/(shop)/admin/page.tsx`:

**6a. Widen `isQuoteItem`** (line 225-226). Today:
```ts
const isQuoteItem = (item: OrderItem) =>
  (item.customData?.signType || (item.customData?.type === "custom_size" && item.customData?.requiresQuote)) && item.price === 0;
```
Becomes:
```ts
const isQuoteItem = (item: OrderItem) =>
  !!item.customData && item.price === 0;
```
This single change brings `custom_quote` items under the existing **Requires Pricing** tab and the `orderNeedsPricing` gate automatically. It also tightens the gate for `custom_sign` items that might otherwise have slipped through (previously only detected via `signType`).

**6b. Disable the "Send to Nest" button** (lines 688-696). Wrap in `orderNeedsPricing(order)`:
```tsx
{(order.status === "new" || order.status === "awaiting_po") && (
  <button
    onClick={(e) => { e.stopPropagation(); sendToNest(order.orderNumber); }}
    disabled={sendingToNest === order.orderNumber || orderNeedsPricing(order)}
    title={orderNeedsPricing(order) ? "Price all custom items first" : undefined}
    className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 text-sm font-medium rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {sendingToNest === order.orderNumber ? "Sending..." : order.status === "awaiting_po" ? "Re-send to Nest" : "Send to Nest"}
  </button>
)}
```

**6c. Render `custom_quote` details in the admin item list.** Find the block that renders `customData` for sign/size items and add a branch for `type === "custom_quote"` that displays code (if present), description, size, material, and additional notes. Follow the existing visual treatment used for custom sign details.

### 7. Header toolbar — Custom dropdown

`shop/components/Header.tsx` changes:

**Desktop (≥sm):** Replace the single Custom Sign link (lines 51-59) with two adjacent links: **Custom Sign** and **Custom Item**. Both use the same visual style (`hidden sm:flex items-center gap-1.5 text-sm ...`). Custom Item gets a distinct icon — an outlined box icon rather than the current plus.

**Mobile (hamburger menu, `md:hidden` block, lines 101-125):** Replace the single Custom Sign link with a collapsible "Custom" group labelled **Custom ▾**. Tapping it expands a sub-list containing **Custom Sign** and **Custom Item**. Both sub-links close the drawer on click (existing `onClick={() => setMenuOpen(false)}` pattern). Expansion state is a local `useState` inside Header.

The sub-links sit visually indented under the Custom header, matching the existing mobile menu spacing.

### 8. Customer-facing copy

- Shop page title: **Request a Custom Item**
- Hero subtitle: "Need something we don't stock and it isn't a sign? Describe it here and we'll price it up."
- Summary card price label: **Quote on request** (amber, same style as custom-sign)
- Basket line label: `Custom Item (Quote on Request)`
- Add-to-basket button text: **Add to Basket — Quote on Request**

## Data Flow

1. User fills `/custom-item` form → adds item to basket with `price: 0` and `customQuote: {...}`.
2. User checks out → `POST /api/orders` receives items including the `customQuote` payload.
3. Orders API builds `custom_data` with `type: "custom_quote"`, inserts order + items.
4. Orders API runs `orderHasUnpricedCustomItems` → true → **skips Make webhook**. Team notification + customer confirmation still fire.
5. Order appears in admin queue, flagged **Requires Pricing**. "Send to Nest" button is disabled.
6. Admin opens order, sets a price via the existing inline pricer on each zero-price item. Prices and totals recalculate via `items/[itemId]` PATCH (unchanged).
7. Once all custom items are priced, `orderNeedsPricing(order)` flips to false → "Send to Nest" button un-disables.
8. Admin clicks **Send to Nest** → existing `send-to-nest` endpoint passes its new unpriced-items guard → fires Make webhook with `isPO: true`.

## Error Handling

- **Missing required fields on `/custom-item`:** Add-to-basket button stays disabled until description/size/material are non-empty. No server call possible.
- **Invalid custom_quote payload at `POST /api/orders`:** Existing try/catch returns 500 with "Internal server error" — match existing behaviour. Consider a tighter 400 with a clearer message as a follow-up; out of scope for this change.
- **Admin attempts to send unpriced order via UI:** Button is disabled. If somehow bypassed (e.g. stale client), server guard in `send-to-nest` returns 400 with a descriptive error that the existing `sendToNest` function displays via `setNestError`.
- **Admin prices one item but another remains unpriced:** `orderNeedsPricing` still true, button stays disabled. Existing inline pricer already recalculates totals per save.

## Testing

Not automated (this project has no test suite in `shop/`). Manual verification:

1. Submit an order with only catalogue items → webhook fires, order goes to Nest immediately. (Regression check.)
2. Submit an order with one catalogue item + one custom-quote item → order lands in admin with **Requires Pricing**, no Nest webhook fired (check Vercel logs for `held for pricing`). Team notification email still arrives.
3. Submit an order with one custom-sign item → same held-for-pricing behaviour (new behaviour — previously auto-sent).
4. In admin, price the custom-quote item → "Send to Nest" button un-disables, clicking it fires the webhook (check logs for webhook-fired line).
5. Try calling `POST /api/orders/<num>/send-to-nest` directly while items are still unpriced → 400 with descriptive error.
6. Header: desktop ≥sm shows two links (Custom Sign, Custom Item). Mobile hamburger shows expandable "Custom" group.

## File Touch List

- **Create:** `shop/app/(shop)/custom-item/page.tsx`
- **Create:** `shop/lib/order-gating.ts` (or add helper to existing `shop/lib/delivery.ts`)
- **Modify:** `shop/components/Header.tsx` — two-link desktop, expandable mobile group
- **Modify:** `shop/components/BasketContext.tsx` — add `customQuote` to item shape
- **Modify:** `shop/app/api/orders/route.ts` — accept `customQuote`, gate webhook
- **Modify:** `shop/app/api/orders/[orderNumber]/send-to-nest/route.ts` — defence-in-depth guard
- **Modify:** `shop/app/(shop)/admin/page.tsx` — widen `isQuoteItem`, disable "Send to Nest" button, render custom_quote details

## Open Questions

None — all clarifications resolved in brainstorming.
