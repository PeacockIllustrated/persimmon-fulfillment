# Custom (Non-Sign) Quote Items + Unified PO Gate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users request custom non-sign items (optional code, description, size, material, quantity, notes) via a new `/custom-item` page, and hold any order containing any unpriced custom item (sign, size, or new quote type) out of the Make.com PO webhook until admin has priced everything via the existing inline pricer and the existing "Send to Nest" button.

**Architecture:** Adds a fourth variant (`type: "custom_quote"`) to the existing `psp_order_items.custom_data` JSONB discriminated union — no DB migration. Introduces one small server helper (`orderHasUnpricedCustomItems`) used at two enforcement points in the orders API. Reuses the existing admin "Send to Nest" button (disabled when items are unpriced) and the existing generic inline pricer endpoint. Adds a new shop page modelled on `/custom-sign` and turns the Header's single "Custom Sign" link into two desktop links + a mobile "Custom" dropdown.

**Tech Stack:** Next.js 16 (App Router, webpack), TypeScript 5.9, React 19, Tailwind v4, Supabase (PostgreSQL JSONB), Make.com webhook.

**Testing note:** This project has no automated test suite. Each task uses `npm run lint` (from `shop/`) as the mechanical verification step. Task 9 is a manual end-to-end verification checklist.

**Spec:** `docs/superpowers/specs/2026-04-09-custom-quote-items-design.md`

---

## Task 1: Create `orderHasUnpricedCustomItems` helper

**Files:**
- Create: `shop/lib/order-gating.ts`

- [ ] **Step 1: Create the helper file**

Write `shop/lib/order-gating.ts`:

```ts
/**
 * Returns true if any item has custom_data set AND price === 0 — i.e. it is a
 * custom/quote item that has not yet been priced by an admin. Used by the
 * orders API and the send-to-nest endpoint to hold orders back from the
 * PO-officer webhook until every custom item has a price.
 *
 * Accepts the DB row shape (`custom_data`, snake_case) from Supabase.
 */
export function orderHasUnpricedCustomItems(
  items: Array<{ price: number | string; custom_data: unknown }>
): boolean {
  return items.some(
    (i) => i.custom_data != null && Number(i.price) === 0
  );
}
```

- [ ] **Step 2: Lint check**

Run from `shop/`: `npm run lint`
Expected: exits 0, no new warnings for `lib/order-gating.ts`.

- [ ] **Step 3: Commit**

```bash
git add shop/lib/order-gating.ts
git commit -m "feat: add orderHasUnpricedCustomItems helper for PO gating"
```

---

## Task 2: Gate Make webhook in `POST /api/orders`

**Files:**
- Modify: `shop/app/api/orders/route.ts` (add import + gate the webhook fire around lines 171-220)

- [ ] **Step 1: Add the import**

At the top of `shop/app/api/orders/route.ts`, after the other `@/lib/*` imports (currently lines 3-5), add:

```ts
import { orderHasUnpricedCustomItems } from "@/lib/order-gating";
```

- [ ] **Step 2: Gate the Make webhook fire**

In `shop/app/api/orders/route.ts`, find the `await Promise.all([...])` block that fires emails and the Make webhook (currently lines 171-220). Replace the `makeWebhookUrl ? (() => { ... })() : Promise.resolve()` third element with a conditional that skips the webhook when items are unpriced.

Current shape (abridged) at line 174:

```ts
makeWebhookUrl
  ? (() => {
      const token = generateRaisePoToken(orderNumber);
      // ... builds webhook payload and calls fetch(makeWebhookUrl, ...)
    })()
  : Promise.resolve(),
```

Replace with:

```ts
makeWebhookUrl && !orderHasUnpricedCustomItems(itemsWithOrderId)
  ? (() => {
      const token = generateRaisePoToken(orderNumber);
      // ... unchanged webhook fire body
    })()
  : Promise.resolve(),
```

Then, immediately after the `await Promise.all([...])` closes (currently around line 220, before the `console.log(\`Order ${orderNumber} saved...\`)` on line 222), add a log line noting when the webhook was skipped:

```ts
if (makeWebhookUrl && orderHasUnpricedCustomItems(itemsWithOrderId)) {
  console.log(`Order ${orderNumber} held for pricing — Make webhook skipped`);
}
```

Do **not** touch `sendOrderConfirmation` or `sendTeamNotification` — the customer receipt and internal team notification must still fire on every order.

- [ ] **Step 3: Lint check**

Run from `shop/`: `npm run lint`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add shop/app/api/orders/route.ts
git commit -m "feat: hold orders with unpriced custom items back from Make webhook"
```

---

## Task 3: Defence-in-depth guard on `send-to-nest`

**Files:**
- Modify: `shop/app/api/orders/[orderNumber]/send-to-nest/route.ts` (add import + guard after line 40)

- [ ] **Step 1: Add the import**

At the top of `shop/app/api/orders/[orderNumber]/send-to-nest/route.ts`, after the existing `@/lib/*` imports (currently lines 2-4), add:

```ts
import { orderHasUnpricedCustomItems } from "@/lib/order-gating";
```

- [ ] **Step 2: Add the guard after the items fetch**

Find the block that fetches items (currently lines 37-40):

```ts
const { data: items } = await supabase
  .from("psp_order_items")
  .select("*")
  .eq("order_id", order.id);
```

Immediately after it, add:

```ts
if (orderHasUnpricedCustomItems(items || [])) {
  return NextResponse.json(
    { error: "Order has unpriced custom items — price them before sending to Nest" },
    { status: 400 }
  );
}
```

- [ ] **Step 3: Lint check**

Run from `shop/`: `npm run lint`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add shop/app/api/orders/\[orderNumber\]/send-to-nest/route.ts
git commit -m "feat: reject send-to-nest when order has unpriced custom items"
```

---

## Task 4: Accept `customQuote` payload in `POST /api/orders`

**Files:**
- Modify: `shop/app/api/orders/route.ts` (widen item type on line 38, widen quote check on line 41, add custom_data branch between lines 60-80)

- [ ] **Step 1: Widen the inline item parameter type**

In `shop/app/api/orders/route.ts`, find the `validatedItems = items.map(...)` callback parameter at line 38. Add `customQuote?: { code: string | null; description: string; size: string; material: string; additionalNotes: string }` to the existing inline item type. The parameter annotation should now end `...; customSizeData?: {...}; customQuote?: { code: string | null; description: string; size: string; material: string; additionalNotes: string } }`.

- [ ] **Step 2: Widen the `isQuoteItem` check**

Line 41 currently reads:

```ts
const isQuoteItem = !!item.customSign || !!item.customSizeData?.requiresQuote;
```

Change to:

```ts
const isQuoteItem = !!item.customSign || !!item.customSizeData?.requiresQuote || !!item.customQuote;
```

- [ ] **Step 3: Add the `custom_quote` branch to the custom_data builder**

The current chain (lines 52-80) looks like:

```ts
let custom_data = null;
if (item.customSign) {
  custom_data = { type: "custom_sign" as const, ... };
} else if (item.customFieldValues && item.customFieldValues.length > 0) {
  custom_data = { type: "custom_fields" as const, ... };
} else if (item.customSizeData) {
  custom_data = { type: "custom_size" as const, ... };
}
```

Add a new branch **before** the `customSizeData` branch so `customQuote` wins if both somehow appear:

```ts
} else if (item.customQuote) {
  const description = String(item.customQuote.description || "").trim();
  const size = String(item.customQuote.size || "").trim();
  const material = String(item.customQuote.material || "").trim();
  if (!description || !size || !material) {
    throw new Error("Custom item is missing description, size, or material");
  }
  custom_data = {
    type: "custom_quote" as const,
    code: item.customQuote.code ? String(item.customQuote.code) : null,
    description,
    size,
    material,
    additionalNotes: String(item.customQuote.additionalNotes || ""),
  };
}
```

- [ ] **Step 4: Lint check**

Run from `shop/`: `npm run lint`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add shop/app/api/orders/route.ts
git commit -m "feat: accept customQuote items in orders API"
```

---

## Task 5: Add `customQuote` field to `BasketItem` type

**Files:**
- Modify: `shop/components/BasketContext.tsx` (add interface near existing `CustomSignData`, add optional field on `BasketItem`)

- [ ] **Step 1: Add the interface**

In `shop/components/BasketContext.tsx`, after the existing `CustomFieldValue` interface (currently lines 14-18), add:

```ts
export interface CustomQuoteData {
  code: string | null;
  description: string;
  size: string;
  material: string;
  additionalNotes: string;
}
```

- [ ] **Step 2: Add the optional field on `BasketItem`**

In the `BasketItem` interface (currently lines 20-33), after `customSizeData?: CustomSizeData;`, add:

```ts
customQuote?: CustomQuoteData;
```

- [ ] **Step 3: Lint check**

Run from `shop/`: `npm run lint`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add shop/components/BasketContext.tsx
git commit -m "feat: add CustomQuoteData field to BasketItem"
```

---

## Task 6: Create `/custom-item` shop page

**Files:**
- Create: `shop/app/(shop)/custom-item/page.tsx`

- [ ] **Step 1: Create the page**

Write `shop/app/(shop)/custom-item/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useBasket } from "@/components/BasketContext";

export default function CustomItemPage() {
  const { addItem } = useBasket();
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [form, setForm] = useState({
    code: "",
    description: "",
    size: "",
    material: "",
    additionalNotes: "",
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const canSubmit =
    form.description.trim() !== "" &&
    form.size.trim() !== "" &&
    form.material.trim() !== "";

  const handleAddToBasket = () => {
    if (!canSubmit) return;
    const code = `CUSTOM-ITEM-${Date.now()}`;
    const description = form.description.trim();
    const size = form.size.trim();
    const material = form.material.trim();
    const userCode = form.code.trim() || null;

    addItem(
      {
        code,
        baseCode: "CUSTOM-ITEM",
        name: "Custom Item (Quote on Request)",
        size,
        material,
        description: `${description} — ${size} — ${material}`,
        price: 0,
        image: null,
        customQuote: {
          code: userCode,
          description,
          size,
          material,
          additionalNotes: form.additionalNotes.trim(),
        },
      },
      quantity
    );

    setAdded(true);
    setTimeout(() => setAdded(false), 3000);
  };

  const inputClass =
    "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-persimmon-green/15 focus:border-persimmon-green outline-none transition bg-white";

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-6 overflow-x-auto whitespace-nowrap">
        <Link href="/" className="hover:text-persimmon-green transition">
          All Categories
        </Link>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-persimmon-navy font-medium">Request a Custom Item</span>
      </div>

      {/* Branded hero header */}
      <div
        className="rounded-2xl p-6 sm:p-8 mb-8 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, var(--persimmon-navy) 0%, var(--persimmon-navy-light) 50%, var(--persimmon-green-dark) 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 text-persimmon-green-light"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 7L9 18l-5-5" />
              </svg>
            </div>
            <span className="text-persimmon-green-light text-xs font-semibold uppercase tracking-wider">
              Custom Order
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Request a Custom Item
          </h1>
          <p className="text-white/50 text-sm max-w-lg">
            Need something we don&apos;t stock and it isn&apos;t a sign? Describe it here
            and we&apos;ll price it up.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Form - 3 cols */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 relative overflow-hidden">
            <div
              className="absolute top-0 left-0 w-full h-[3px]"
              style={{
                background:
                  "linear-gradient(90deg, var(--persimmon-green), var(--persimmon-green-light), transparent)",
              }}
            />
            <h2 className="text-base font-semibold text-persimmon-navy mb-5">Item Details</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  Product Code <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => updateField("code", e.target.value)}
                  className={inputClass}
                  placeholder="e.g. the manufacturer's part number, if known"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  Description *
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  rows={3}
                  className={inputClass}
                  placeholder="What is the item? Be as specific as you can."
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">
                    Size *
                  </label>
                  <input
                    type="text"
                    value={form.size}
                    onChange={(e) => updateField("size", e.target.value)}
                    className={inputClass}
                    placeholder="e.g. 600×400mm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">
                    Material *
                  </label>
                  <input
                    type="text"
                    value={form.material}
                    onChange={(e) => updateField("material", e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Aluminium composite"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  Quantity *
                </label>
                <div className="inline-flex items-center border border-gray-200 rounded-xl bg-white">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-persimmon-green transition text-lg font-medium"
                  >
                    &minus;
                  </button>
                  <span className="w-12 text-center text-sm font-semibold text-persimmon-navy tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-persimmon-green transition text-lg font-medium"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 relative overflow-hidden">
            <div
              className="absolute top-0 left-0 w-full h-[3px]"
              style={{
                background:
                  "linear-gradient(90deg, var(--persimmon-navy), var(--persimmon-navy-light), transparent)",
              }}
            />
            <h2 className="text-base font-semibold text-persimmon-navy mb-5">Additional Notes</h2>
            <textarea
              value={form.additionalNotes}
              onChange={(e) => updateField("additionalNotes", e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Anything else we should know — colour, finish, delivery constraints..."
            />
          </div>
        </div>

        {/* Summary - 2 cols */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 lg:sticky lg:top-24 relative overflow-hidden">
            <div
              className="absolute top-0 left-0 w-full h-[3px]"
              style={{
                background:
                  "linear-gradient(90deg, var(--persimmon-green), var(--persimmon-green-dark))",
              }}
            />
            <h2 className="text-base font-semibold text-persimmon-navy mb-5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-persimmon-green animate-pulse" />
              Summary
            </h2>

            <div className="space-y-2 text-sm mb-5">
              <div className="flex justify-between">
                <span className="text-gray-400">Code</span>
                <span className="font-medium text-gray-700 text-right max-w-[60%] truncate">
                  {form.code.trim() || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Size</span>
                <span className="font-medium text-gray-700 text-right max-w-[60%] truncate">
                  {form.size.trim() || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Material</span>
                <span className="font-medium text-gray-700 text-right max-w-[60%] truncate">
                  {form.material.trim() || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Quantity</span>
                <span className="font-medium text-gray-700">{quantity}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <span className="text-gray-400">Price</span>
                <span className="font-semibold text-amber-600">Quote on request</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddToBasket}
              disabled={!canSubmit || added}
              className="w-full text-white py-3 rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-sm"
              style={{
                background: added
                  ? "var(--persimmon-green)"
                  : "linear-gradient(135deg, var(--persimmon-green) 0%, var(--persimmon-green-dark) 100%)",
              }}
            >
              {added ? "Added to Basket" : "Add to Basket — Quote on Request"}
            </button>

            {added && (
              <div className="mt-3 flex gap-2">
                <Link
                  href="/basket"
                  className="flex-1 text-center text-sm font-medium text-persimmon-green border border-persimmon-green rounded-xl py-2 hover:bg-persimmon-green/5 transition"
                >
                  View Basket
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setAdded(false);
                    setQuantity(1);
                    setForm({
                      code: "",
                      description: "",
                      size: "",
                      material: "",
                      additionalNotes: "",
                    });
                  }}
                  className="flex-1 text-center text-sm font-medium text-gray-500 border border-gray-200 rounded-xl py-2 hover:bg-gray-50 transition"
                >
                  Add Another
                </button>
              </div>
            )}

            <p className="text-[11px] text-gray-400 mt-4 text-center leading-relaxed">
              Our team will review your request and price it up before the order is sent for
              fulfilment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint check**

Run from `shop/`: `npm run lint`
Expected: exits 0.

- [ ] **Step 3: Dev-server smoke test**

Run `npm run dev` from `shop/`, visit `http://localhost:3000/custom-item`, log in with the shop password if prompted.
Expected: the page renders without runtime errors, the Add to Basket button is disabled until description/size/material are all filled, filling them enables the button.
Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add shop/app/\(shop\)/custom-item/page.tsx
git commit -m "feat: add /custom-item page for custom non-sign quote requests"
```

---

## Task 7: Admin — widen `isQuoteItem` and disable "Send to Nest"

**Files:**
- Modify: `shop/app/(shop)/admin/page.tsx` (two `isQuoteItem` sites and the Send-to-Nest button)

- [ ] **Step 1: Widen the top `isQuoteItem` at line ~138**

In `shop/app/(shop)/admin/page.tsx`, find line 138 (inside the `orderFilteredItems` filter or equivalent). Current:

```ts
(item.customData?.signType || (item.customData?.type === "custom_size" && item.customData?.requiresQuote)) && item.price === 0
```

Replace with:

```ts
!!item.customData && item.price === 0
```

- [ ] **Step 2: Widen the `isQuoteItem` helper at line ~225**

Find lines 225-226:

```ts
const isQuoteItem = (item: OrderItem) =>
  (item.customData?.signType || (item.customData?.type === "custom_size" && item.customData?.requiresQuote)) && item.price === 0;
```

Replace with:

```ts
const isQuoteItem = (item: OrderItem) =>
  !!item.customData && item.price === 0;
```

- [ ] **Step 3: Widen the third site at line ~532**

Find line 532 (same predicate as step 1). Replace with the same `!!item.customData && item.price === 0` form.

- [ ] **Step 4: Disable the "Send to Nest" button when unpriced**

Find the button block at lines 688-696:

```tsx
{(order.status === "new" || order.status === "awaiting_po") && (
  <button
    onClick={(e) => { e.stopPropagation(); sendToNest(order.orderNumber); }}
    disabled={sendingToNest === order.orderNumber}
    className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 text-sm font-medium rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {sendingToNest === order.orderNumber ? "Sending..." : order.status === "awaiting_po" ? "Re-send to Nest" : "Send to Nest"}
  </button>
)}
```

Replace with:

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

- [ ] **Step 5: Lint check**

Run from `shop/`: `npm run lint`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add shop/app/\(shop\)/admin/page.tsx
git commit -m "feat: gate Send to Nest button on unpriced custom items"
```

---

## Task 8: Admin — render `custom_quote` item row with inline pricer

**Files:**
- Modify: `shop/app/(shop)/admin/page.tsx` (extend `OrderItem.customData` type, add render branch alongside the existing custom_sign / custom_size branches)

- [ ] **Step 1: Extend the `OrderItem.customData` type**

Find the `OrderItem.customData` interface (currently lines 14-27). Add the new optional fields used by `custom_quote` alongside the existing ones:

```ts
customData?: {
  type?: string;
  signType?: string;
  textContent?: string;
  shape?: string;
  additionalNotes?: string;
  fields?: Array<{ label: string; key: string; value: string }>;
  requestedWidth?: number;
  requestedHeight?: number;
  matchedVariantCode?: string;
  matchedSize?: string;
  matchedFromProduct?: string;
  requiresQuote?: boolean;
  // custom_quote
  code?: string | null;
  description?: string;
  material?: string;
} | null;
```

- [ ] **Step 2: Add the `custom_quote` render branch**

Find the item-row renderer. The existing chain (around lines 778-913) goes:

```tsx
{order.items.map((item, i) => {
  // Custom sign request (price 0, quote)
  if (item.customData?.signType) { ... }
  // Custom size request
  if (item.customData?.type === "custom_size") { ... }
  // Standard item (with optional custom field values)
  ...
});
```

Add a new branch **after** the custom_size branch and **before** the "Standard item" fallback (insert before line ~915 which starts `// Standard item`):

```tsx
// Custom quote request (non-sign)
if (item.customData?.type === "custom_quote") {
  return (
    <tr key={i} className="border-b border-gray-50">
      <td className="py-2 pr-2">
        <div className="w-9 h-9 rounded bg-amber-100 flex items-center justify-center">
          <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
      </td>
      <td className="py-2.5">
        <p className="font-medium text-amber-600 text-xs">CUSTOM ITEM</p>
        <p className="text-xs text-gray-700 mt-0.5">{item.customData.description}</p>
        <p className="text-xs text-gray-500">
          {item.customData.code ? `${item.customData.code} · ` : ""}
          {item.size || item.customData.size || ""} · {item.customData.material || ""}
        </p>
        {item.customData.additionalNotes && (
          <p className="text-[10px] text-gray-400 mt-0.5">Notes: {item.customData.additionalNotes}</p>
        )}
      </td>
      <td className="py-2.5 text-center text-gray-500">{item.quantity}</td>
      <td className="py-2.5 text-right font-medium text-xs">
        {item.price === 0 || editingPrices[item.id] !== undefined ? (
          <div className="flex items-center justify-end gap-1">
            <span className="text-gray-400 text-xs">{"\u00A3"}</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={editingPrices[item.id] ?? ""}
              onChange={(e) => setEditingPrices((prev) => ({ ...prev, [item.id]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") saveItemPrice(order.orderNumber, item.id); }}
              className="w-20 px-2 py-1 text-right text-sm border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-persimmon-green/30 focus:border-persimmon-green"
            />
            <button
              onClick={() => saveItemPrice(order.orderNumber, item.id)}
              disabled={savingPrice === item.id || !editingPrices[item.id]}
              className="px-2 py-1 text-[10px] font-semibold bg-persimmon-green text-white rounded-lg hover:bg-persimmon-green/90 transition disabled:opacity-40"
            >
              {savingPrice === item.id ? "..." : "Save"}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <span className="text-gray-700">{"\u00A3"}{(item.price * item.quantity).toFixed(2)}</span>
            <button
              onClick={() => setEditingPrices((prev) => ({ ...prev, [item.id]: "" }))}
              className="text-gray-300 hover:text-persimmon-green transition ml-0.5"
              title="Edit price"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
```

Note: the admin `OrderItem` interface (lines 6-28) does not expose `material`, so the render branch above reads it from `item.customData.material` rather than from `item.material`. `size` does exist on `OrderItem`, so `item.size` is used first with `item.customData.size` as fallback.

- [ ] **Step 3: Lint check**

Run from `shop/`: `npm run lint`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add shop/app/\(shop\)/admin/page.tsx
git commit -m "feat: render custom_quote items in admin order detail"
```

---

## Task 9: Header — two desktop links + mobile "Custom" group

**Files:**
- Modify: `shop/components/Header.tsx`

- [ ] **Step 1: Add local state for mobile expand**

In `shop/components/Header.tsx`, find the existing `useState` for `menuOpen` (near the top of the component). Add a sibling state:

```ts
const [customOpen, setCustomOpen] = useState(false);
```

- [ ] **Step 2: Replace the desktop Custom Sign link with two adjacent links**

Find lines 51-59 (current single link). Replace with:

```tsx
<Link
  href="/custom-sign"
  className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 hover:text-persimmon-navy px-3 py-2 rounded-lg hover:bg-gray-50 transition"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
  </svg>
  Custom Sign
</Link>

<Link
  href="/custom-item"
  className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 hover:text-persimmon-navy px-3 py-2 rounded-lg hover:bg-gray-50 transition"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8 8-4-4M4 6h16v12H4z" />
  </svg>
  Custom Item
</Link>
```

- [ ] **Step 3: Replace the mobile Custom Sign link with an expandable "Custom" group**

Find the mobile menu block (currently lines 101-125). Replace the Custom Sign `<Link>` (lines 104-113) with an expandable group. Leave the Search bar, the Orders link, and the rest of the block untouched.

New mobile "Custom" group (insert where the old Custom Sign link was):

```tsx
<button
  type="button"
  onClick={() => setCustomOpen((v) => !v)}
  className="w-full flex items-center justify-between text-sm text-gray-500 hover:text-persimmon-navy mt-3 px-1"
>
  <span className="flex items-center gap-2">
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
    </svg>
    Custom
  </span>
  <svg
    className={`w-4 h-4 transition-transform ${customOpen ? "rotate-180" : ""}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
  </svg>
</button>
{customOpen && (
  <div className="mt-2 ml-6 flex flex-col gap-2">
    <Link
      href="/custom-sign"
      className="text-sm text-gray-500 hover:text-persimmon-navy px-1"
      onClick={() => {
        setMenuOpen(false);
        setCustomOpen(false);
      }}
    >
      Custom Sign
    </Link>
    <Link
      href="/custom-item"
      className="text-sm text-gray-500 hover:text-persimmon-navy px-1"
      onClick={() => {
        setMenuOpen(false);
        setCustomOpen(false);
      }}
    >
      Custom Item
    </Link>
  </div>
)}
```

- [ ] **Step 4: Lint check**

Run from `shop/`: `npm run lint`
Expected: exits 0.

- [ ] **Step 5: Dev-server smoke test**

Run `npm run dev` from `shop/`, visit `http://localhost:3000/`.
- Desktop width (≥640px): confirm two adjacent links "Custom Sign" and "Custom Item" appear in the toolbar, and each navigates correctly.
- Mobile width (<768px): open the hamburger menu, confirm the "Custom ▾" button expands to reveal both Custom Sign and Custom Item sub-links, and tapping either closes the drawer and navigates.
Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add shop/components/Header.tsx
git commit -m "feat: Header Custom Sign / Custom Item split with mobile dropdown"
```

---

## Task 10: End-to-end manual verification

No code changes in this task — it verifies the full feature works together.

**Prerequisite:** `MAKE_WEBHOOK_URL` is set in `shop/.env` (or it's acceptable to leave unset and verify the skip-log still fires). A Supabase connection is live.

- [ ] **Step 1: Catalogue-only regression test**

Run `npm run dev` from `shop/`. As a shop user, add one catalogue product to the basket, check out with valid contact/site details, and submit.

Expected:
- Order succeeds.
- Vercel (or local) log shows `Make webhook fired for PER-... — 200` (or similar success log from `route.ts:216`).
- Log does **not** show `held for pricing`.
- In admin, the order appears without a "Requires Pricing" badge. The "Send to Nest" button is enabled.

- [ ] **Step 2: Custom item held-for-pricing test**

Add one custom item via `/custom-item` (fill description/size/material). Also add a catalogue product. Check out and submit.

Expected:
- Order succeeds (confirmation page shown).
- Log shows `Order PER-... held for pricing — Make webhook skipped`.
- Log does **not** show `Make webhook fired`.
- Customer confirmation email and internal team notification email still arrive (check Make.com inbox / Nodemailer destination).
- In admin, the order is visible, has the "Requires Pricing" badge, and shows the custom item row with the description/code/size/material rendered correctly.
- The "Send to Nest" button is **disabled** with tooltip "Price all custom items first".

- [ ] **Step 3: Price the custom item**

Still in admin, click the edit pencil (or the already-open inline input) next to the custom item's £0.00, type a price (e.g. `45.00`), click Save.

Expected:
- Price saves, order totals refresh with VAT + delivery recalculated.
- "Requires Pricing" badge disappears.
- "Send to Nest" button un-disables.

- [ ] **Step 4: Manual "Send to Nest"**

Click "Send to Nest".

Expected:
- Button spinner briefly appears.
- Log shows `Send to Nest webhook fired for PER-... — 200`.
- Order status flips to "Awaiting PO" (if it was "new") or remains "Awaiting PO" (if a re-send).

- [ ] **Step 5: Server guard defence-in-depth test**

Pick any existing order containing an unpriced custom item (create one if necessary). From a terminal with admin cookies, POST to `/api/orders/<ORDER_NUMBER>/send-to-nest` directly (or use the browser devtools Network tab to replay the request while the button is visually disabled — browsers honour disabled so use curl/PowerShell):

```bash
curl -X POST http://localhost:3000/api/orders/PER-YYYYMMDD-XXXX/send-to-nest \
  -H "Cookie: admin-auth=<value from your browser>" \
  -H "Content-Type: application/json"
```

Expected: `HTTP 400` with body `{"error":"Order has unpriced custom items — price them before sending to Nest"}`.

- [ ] **Step 6: Existing custom-sign flow still held**

Submit an order containing a custom sign (via `/custom-sign`).

Expected: same held-for-pricing behaviour as step 2. This is the behaviour change that closes the pre-existing loophole.

- [ ] **Step 7: Final commit (if any fixups were made during verification)**

If any small tweaks were needed during manual verification, commit them now. Otherwise skip.

```bash
git status
# if clean, nothing to commit
```
