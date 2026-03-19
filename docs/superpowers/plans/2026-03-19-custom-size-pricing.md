# Custom Size Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to enter custom sign dimensions on the product page and get automatically priced based on the nearest fitting standard variant size.

**Architecture:** A pure pricing engine (`custom-size-pricing.ts`) handles size parsing and waterfall matching. A client component (`CustomSizeSection.tsx`) renders the UI below variant cards on the product page. Custom-sized items flow through the existing basket/checkout/order pipeline using the `custom_data` JSONB column with `type: "custom_size"`.

**Tech Stack:** Next.js 16, React, TypeScript, Tailwind CSS, Supabase (PostgreSQL)

**Spec:** `docs/superpowers/specs/2026-03-19-custom-size-pricing-design.md`

---

## File Structure

| File | Role |
|------|------|
| `shop/lib/custom-size-pricing.ts` | **Create** — Pure pricing engine: size parsing, waterfall matching, constants |
| `shop/components/CustomSizeSection.tsx` | **Create** — Client component: dimension inputs, results display, add-to-basket |
| `shop/components/BasketContext.tsx` | **Modify** — Add `customSizeData` to `BasketItem` interface |
| `shop/app/(shop)/product/[code]/page.tsx` | **Modify** — Import and render `CustomSizeSection` below variant cards |
| `shop/app/(shop)/basket/page.tsx` | **Modify** — Display custom size info and quote badges |
| `shop/app/(shop)/checkout/page.tsx` | **Modify** — Add `customSizeData` to order submission payload |
| `shop/app/api/orders/route.ts` | **Modify** — Accept `customSizeData`, refactor validation, map to `custom_data` |
| `shop/app/(shop)/admin/page.tsx` | **Modify** — Display custom size details in order expansion |

---

## Task 1: Pricing Engine

**Files:**
- Create: `shop/lib/custom-size-pricing.ts`

- [ ] **Step 1: Create the pricing engine with size parser, constants, and matching logic**

```ts
// shop/lib/custom-size-pricing.ts
import type { Product, Category, Variant } from "./catalog";

export const MIN_CUSTOM_SIZE_MM = 1;
export const MAX_CUSTOM_SIZE_MM = 5000;

interface ParsedSize {
  width: number;
  height: number;
}

export interface CustomSizeRequest {
  widthMm: number;
  heightMm: number;
  product: Product;
  category: Category;
}

export interface CustomSizeResult {
  material: string;
  matchedVariant: {
    code: string;
    size: string;
    price: number;
  } | null;
  matchedFromProduct: string | null;
  requiresQuote: boolean;
}

export interface CustomSizeData {
  type: "custom_size";
  requestedWidth: number;
  requestedHeight: number;
  matchedVariantCode: string | null;
  matchedSize: string | null;
  matchedFromProduct: string | null;
  requiresQuote: boolean;
}

/**
 * Parse a size string like "400x600mm" into { width, height }.
 * Returns null if the string is not parseable.
 */
export function parseSize(size: string | null): ParsedSize | null {
  if (!size) return null;
  const match = size.match(/^(\d+)\s*x\s*(\d+)\s*mm$/i);
  if (!match) return null;
  return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
}

/**
 * Check if a variant's parsed size can fit the requested dimensions.
 * Checks both orientations (the sign can be rotated).
 */
function fitsRequest(
  variantSize: ParsedSize,
  reqWidth: number,
  reqHeight: number
): boolean {
  const normalFit =
    variantSize.width >= reqWidth && variantSize.height >= reqHeight;
  const rotatedFit =
    variantSize.height >= reqWidth && variantSize.width >= reqHeight;
  return normalFit || rotatedFit;
}

/**
 * Find the best matching variant from a list of candidates.
 * Picks the one with the lowest price; breaks ties by smallest area.
 */
function findBestMatch(
  candidates: { variant: Variant; parsed: ParsedSize; fromProduct: string | null }[],
  reqWidth: number,
  reqHeight: number
): { variant: Variant; fromProduct: string | null } | null {
  const fitting = candidates.filter((c) =>
    fitsRequest(c.parsed, reqWidth, reqHeight)
  );
  if (fitting.length === 0) return null;

  fitting.sort((a, b) => {
    if (a.variant.price !== b.variant.price) {
      return a.variant.price - b.variant.price;
    }
    const areaA = a.parsed.width * a.parsed.height;
    const areaB = b.parsed.width * b.parsed.height;
    return areaA - areaB;
  });

  return { variant: fitting[0].variant, fromProduct: fitting[0].fromProduct };
}

/**
 * Calculate custom size pricing for a product.
 * Returns one result per material the product offers.
 *
 * Pricing waterfall:
 * 1. Same product, same material — cheapest fitting variant
 * 2. Same category, same material — cheapest fitting variant from sibling products
 * 3. No match — requiresQuote: true
 */
export function calculateCustomSizePricing(
  request: CustomSizeRequest
): CustomSizeResult[] {
  const { widthMm, heightMm, product, category } = request;

  // Collect all sized variants from the product, grouped by material
  const productVariantsByMaterial = new Map<
    string,
    { variant: Variant; parsed: ParsedSize }[]
  >();

  for (const v of product.variants) {
    if (!v.material) continue;
    const parsed = parseSize(v.size);
    if (!parsed) continue;
    const list = productVariantsByMaterial.get(v.material) || [];
    list.push({ variant: v, parsed });
    productVariantsByMaterial.set(v.material, list);
  }

  // If this product has no sized variants at all, return empty
  if (productVariantsByMaterial.size === 0) return [];

  // Collect category sibling variants by material (excluding this product)
  const categoryVariantsByMaterial = new Map<
    string,
    { variant: Variant; parsed: ParsedSize; fromProduct: string }[]
  >();

  for (const p of category.products) {
    if (p.baseCode === product.baseCode) continue;
    for (const v of p.variants) {
      if (!v.material) continue;
      const parsed = parseSize(v.size);
      if (!parsed) continue;
      const list = categoryVariantsByMaterial.get(v.material) || [];
      list.push({ variant: v, parsed, fromProduct: p.baseCode });
      categoryVariantsByMaterial.set(v.material, list);
    }
  }

  const results: CustomSizeResult[] = [];

  for (const [material, ownVariants] of productVariantsByMaterial) {
    // Step 1: Try own product variants
    const ownCandidates = ownVariants.map((v) => ({
      ...v,
      fromProduct: null as string | null,
    }));
    const ownMatch = findBestMatch(ownCandidates, widthMm, heightMm);

    if (ownMatch) {
      results.push({
        material,
        matchedVariant: {
          code: ownMatch.variant.code,
          size: ownMatch.variant.size!,
          price: ownMatch.variant.price,
        },
        matchedFromProduct: null,
        requiresQuote: false,
      });
      continue;
    }

    // Step 2: Try category sibling variants of same material
    const siblingVariants = categoryVariantsByMaterial.get(material);
    if (siblingVariants) {
      const siblingMatch = findBestMatch(siblingVariants, widthMm, heightMm);
      if (siblingMatch) {
        results.push({
          material,
          matchedVariant: {
            code: siblingMatch.variant.code,
            size: siblingMatch.variant.size!,
            price: siblingMatch.variant.price,
          },
          matchedFromProduct: siblingMatch.fromProduct,
          requiresQuote: false,
        });
        continue;
      }
    }

    // Step 3: No match — requires manual quote
    results.push({
      material,
      matchedVariant: null,
      matchedFromProduct: null,
      requiresQuote: true,
    });
  }

  return results;
}

/**
 * Check if a product has any variants with parseable dimensions.
 * Used to determine whether to show the custom size section.
 */
export function productHasSizedVariants(product: Product): boolean {
  return product.variants.some(
    (v) => v.material !== null && parseSize(v.size) !== null
  );
}
```

- [ ] **Step 2: Verify the module compiles**

Run: `cd shop && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `custom-size-pricing.ts`

- [ ] **Step 3: Commit**

```bash
git add shop/lib/custom-size-pricing.ts
git commit -m "feat: add custom size pricing engine"
```

---

## Task 2: BasketItem Interface Update

**Files:**
- Modify: `shop/components/BasketContext.tsx:17-30`

- [ ] **Step 1: Import `CustomSizeData` and add it to `BasketItem`**

In `shop/components/BasketContext.tsx`, add the import and extend the interface:

```ts
// Add import at top (after existing imports)
import type { CustomSizeData } from "@/lib/custom-size-pricing";
```

Add `customSizeData` field to the `BasketItem` interface after line 29:

```ts
export interface BasketItem {
  code: string;
  baseCode: string;
  name: string;
  size: string | null;
  material: string | null;
  description: string;
  price: number;
  quantity: number;
  image: string | null;
  customSign?: CustomSignData;
  customFieldValues?: CustomFieldValue[];
  customSizeData?: CustomSizeData;  // <-- add this line
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd shop && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add shop/components/BasketContext.tsx
git commit -m "feat: add customSizeData to BasketItem interface"
```

---

## Task 3: Custom Size Section Component

**Files:**
- Create: `shop/components/CustomSizeSection.tsx`

- [ ] **Step 1: Create the client component**

```tsx
// shop/components/CustomSizeSection.tsx
"use client";

import { useState, useMemo } from "react";
import { useBasket } from "./BasketContext";
import type { Product, Category } from "@/lib/catalog";
import {
  calculateCustomSizePricing,
  MIN_CUSTOM_SIZE_MM,
  MAX_CUSTOM_SIZE_MM,
  type CustomSizeResult,
  type CustomSizeData,
} from "@/lib/custom-size-pricing";

interface Props {
  product: Product;
  category: Category;
}

export default function CustomSizeSection({ product, category }: Props) {
  const { addItem } = useBasket();
  const [open, setOpen] = useState(false);
  const [widthStr, setWidthStr] = useState("");
  const [heightStr, setHeightStr] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const width = parseInt(widthStr, 10);
  const height = parseInt(heightStr, 10);
  const validWidth =
    !isNaN(width) && width >= MIN_CUSTOM_SIZE_MM && width <= MAX_CUSTOM_SIZE_MM;
  const validHeight =
    !isNaN(height) &&
    height >= MIN_CUSTOM_SIZE_MM &&
    height <= MAX_CUSTOM_SIZE_MM;
  const hasInput = widthStr.length > 0 && heightStr.length > 0;

  const results: CustomSizeResult[] = useMemo(() => {
    if (!validWidth || !validHeight) return [];
    return calculateCustomSizePricing({
      widthMm: width,
      heightMm: height,
      product,
      category,
    });
  }, [validWidth, validHeight, width, height, product, category]);

  const getQty = (material: string) => quantities[material] || 1;
  const setQty = (material: string, q: number) =>
    setQuantities((prev) => ({ ...prev, [material]: Math.max(1, q) }));

  const handleAdd = (result: CustomSizeResult) => {
    const qty = getQty(result.material);
    const customSizeData: CustomSizeData = {
      type: "custom_size",
      requestedWidth: width,
      requestedHeight: height,
      matchedVariantCode: result.matchedVariant?.code || null,
      matchedSize: result.matchedVariant?.size || null,
      matchedFromProduct: result.matchedFromProduct,
      requiresQuote: result.requiresQuote,
    };

    const baseCode = result.matchedVariant?.code || product.baseCode;
    addItem(
      {
        code: `${baseCode}-cs${Date.now()}`,
        baseCode: product.baseCode,
        name: product.name,
        size: `Custom: ${width}\u00d7${height}mm`,
        material: result.material,
        description: `${product.name} (Custom ${width}\u00d7${height}mm, ${result.material})`,
        price: result.matchedVariant?.price || 0,
        image: product.image,
        customSizeData,
      },
      qty
    );

    // Reset quantity for this material
    setQuantities((prev) => ({ ...prev, [result.material]: 1 }));
  };

  return (
    <div className="mt-6 border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 transition"
      >
        <span className="text-sm font-semibold text-persimmon-navy">
          Need a custom size?
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-2 border-t border-gray-100 space-y-4">
          <p className="text-xs text-gray-400">
            Enter your required dimensions and we&apos;ll find the closest
            standard size pricing.
          </p>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Width (mm)
              </label>
              <input
                type="number"
                value={widthStr}
                onChange={(e) => setWidthStr(e.target.value)}
                placeholder="e.g. 350"
                min={MIN_CUSTOM_SIZE_MM}
                max={MAX_CUSTOM_SIZE_MM}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-persimmon-green/15 focus:border-persimmon-green outline-none transition bg-white"
              />
            </div>
            <span className="text-gray-300 mt-5">&times;</span>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Height (mm)
              </label>
              <input
                type="number"
                value={heightStr}
                onChange={(e) => setHeightStr(e.target.value)}
                placeholder="e.g. 500"
                min={MIN_CUSTOM_SIZE_MM}
                max={MAX_CUSTOM_SIZE_MM}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-persimmon-green/15 focus:border-persimmon-green outline-none transition bg-white"
              />
            </div>
          </div>

          {hasInput && !validWidth && (
            <p className="text-xs text-red-500">
              Width must be a whole number between {MIN_CUSTOM_SIZE_MM} and{" "}
              {MAX_CUSTOM_SIZE_MM}mm
            </p>
          )}
          {hasInput && !validHeight && (
            <p className="text-xs text-red-500">
              Height must be a whole number between {MIN_CUSTOM_SIZE_MM} and{" "}
              {MAX_CUSTOM_SIZE_MM}mm
            </p>
          )}

          {validWidth && validHeight && results.length === 0 && (
            <p className="text-sm text-gray-400">
              No sized variants available for this product.
            </p>
          )}

          {results.map((result) => (
            <div
              key={result.material}
              className="bg-white border border-gray-100 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-400">{result.material}</p>
                  {result.requiresQuote ? (
                    <p className="text-amber-600 font-semibold text-sm mt-1">
                      This size requires a manual quote
                    </p>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-persimmon-navy mt-1">
                        {"\u00A3"}
                        {result.matchedVariant!.price.toFixed(2)}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        ex. VAT &middot; priced as{" "}
                        {result.matchedVariant!.size}
                        {result.matchedFromProduct && (
                          <span>
                            {" "}
                            (from {result.matchedFromProduct})
                          </span>
                        )}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center bg-persimmon-gray rounded-xl overflow-hidden">
                  <button
                    onClick={() =>
                      setQty(result.material, getQty(result.material) - 1)
                    }
                    className="px-3 py-2.5 hover:bg-persimmon-gray-dark text-gray-500 font-medium transition"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={getQty(result.material)}
                    onChange={(e) =>
                      setQty(
                        result.material,
                        Math.max(1, parseInt(e.target.value) || 1)
                      )
                    }
                    className="w-12 text-center py-2.5 bg-transparent text-sm font-medium text-persimmon-navy"
                    min={1}
                  />
                  <button
                    onClick={() =>
                      setQty(result.material, getQty(result.material) + 1)
                    }
                    className="px-3 py-2.5 hover:bg-persimmon-gray-dark text-gray-500 font-medium transition"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => handleAdd(result)}
                  className={`flex-1 py-2.5 px-6 rounded-xl font-medium transition-all text-white flex items-center justify-center gap-2 active:scale-[0.98] ${
                    result.requiresQuote
                      ? "bg-amber-500 hover:bg-amber-600"
                      : "bg-persimmon-green hover:bg-persimmon-green-dark"
                  }`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  {result.requiresQuote ? "Add for Quote" : "Add to Basket"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd shop && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add shop/components/CustomSizeSection.tsx
git commit -m "feat: add CustomSizeSection client component"
```

---

## Task 4: Product Page Integration

**Files:**
- Modify: `shop/app/(shop)/product/[code]/page.tsx:1-120`

- [ ] **Step 1: Import `CustomSizeSection` and `productHasSizedVariants`, render below variant cards**

Add imports at top of file (after line 5):

```ts
import CustomSizeSection from "@/components/CustomSizeSection";
import { productHasSizedVariants } from "@/lib/custom-size-pricing";
```

After the closing `</div>` of the `space-y-3` div (after line 115), add:

```tsx
            {productHasSizedVariants(product) && (
              <CustomSizeSection product={product} category={category} />
            )}
```

This goes inside the right-column `<div>` (the one starting at line 74), after the variant cards section.

- [ ] **Step 2: Verify compilation**

Run: `cd shop && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add shop/app/\(shop\)/product/\[code\]/page.tsx
git commit -m "feat: render CustomSizeSection on product page"
```

---

## Task 5: Basket Page — Custom Size Display

**Files:**
- Modify: `shop/app/(shop)/basket/page.tsx`

**Note:** Steps below reference original line numbers. After Step 1 inserts new lines, subsequent line numbers shift — use the Change/To code blocks to match edits by content, not line number.

- [ ] **Step 1: Add custom size info display after the size/material lines**

In `shop/app/(shop)/basket/page.tsx`, after the `customFieldValues` display block (after line 68), add a block for custom size info:

```tsx
              {item.customSizeData && !item.customSizeData.requiresQuote && (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Priced as {item.customSizeData.matchedSize}
                  {item.customSizeData.matchedFromProduct && (
                    <span> from {item.customSizeData.matchedFromProduct}</span>
                  )}
                </p>
              )}
```

- [ ] **Step 2: Update the price/quote display to handle custom size quote items**

Replace the `customSign` price conditional (lines 69-75) with one that also handles custom size quotes:

Change:
```tsx
              {item.customSign ? (
                <p className="text-amber-600 font-semibold mt-1.5 text-sm">Quote on request</p>
              ) : (
                <p className="text-persimmon-navy font-semibold mt-1.5 text-sm">
                  {"\u00A3"}{item.price.toFixed(2)} each
                </p>
              )}
```

To:
```tsx
              {item.customSign || item.customSizeData?.requiresQuote ? (
                <p className="text-amber-600 font-semibold mt-1.5 text-sm">Quote on request</p>
              ) : (
                <p className="text-persimmon-navy font-semibold mt-1.5 text-sm">
                  {"\u00A3"}{item.price.toFixed(2)} each
                </p>
              )}
```

- [ ] **Step 3: Update the line total display to handle custom size quote items**

Replace the line total conditional (lines 106-112):

Change:
```tsx
              {item.customSign ? (
                <p className="font-bold text-amber-600 text-xs">Quote</p>
              ) : (
                <p className="font-bold text-persimmon-navy text-sm">
                  {"\u00A3"}{(item.price * item.quantity).toFixed(2)}
                </p>
              )}
```

To:
```tsx
              {item.customSign || item.customSizeData?.requiresQuote ? (
                <p className="font-bold text-amber-600 text-xs">Quote</p>
              ) : (
                <p className="font-bold text-persimmon-navy text-sm">
                  {"\u00A3"}{(item.price * item.quantity).toFixed(2)}
                </p>
              )}
```

- [ ] **Step 4: Update the footer quote notice to include custom size quotes**

Replace the `customSign` notice (lines 136-140):

Change:
```tsx
        {items.some((i) => i.customSign) && (
          <p className="text-xs text-amber-600 mb-4 leading-relaxed">
            This order includes custom sign requests. Final pricing for those items will be confirmed after review.
          </p>
        )}
```

To:
```tsx
        {items.some((i) => i.customSign || i.customSizeData?.requiresQuote) && (
          <p className="text-xs text-amber-600 mb-4 leading-relaxed">
            This order includes items requiring a quote. Final pricing for those items will be confirmed after review.
          </p>
        )}
```

- [ ] **Step 5: Verify compilation**

Run: `cd shop && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add shop/app/\(shop\)/basket/page.tsx
git commit -m "feat: display custom size info and quote badges in basket"
```

---

## Task 6: Checkout Page — Payload Serialisation

**Files:**
- Modify: `shop/app/(shop)/checkout/page.tsx:325-326`

- [ ] **Step 1: Add `customSizeData` to the order submission payload**

In `shop/app/(shop)/checkout/page.tsx`, find the item mapping in the order submission (around line 325-326):

```ts
            ...(item.customSign ? { customSign: item.customSign } : {}),
            ...(item.customFieldValues ? { customFieldValues: item.customFieldValues } : {}),
```

Add after line 326:

```ts
            ...(item.customSizeData ? { customSizeData: item.customSizeData } : {}),
```

- [ ] **Step 2: Update the checkout sidebar to show quote for custom size items**

Find the customSign conditional in the order summary sidebar (around line 495-501):

Change:
```tsx
                      {item.customSign ? "Custom Sign" : item.code} x{item.quantity}
```

To:
```tsx
                      {item.customSign ? "Custom Sign" : item.customSizeData?.requiresQuote ? "Custom Size (Quote)" : item.code} x{item.quantity}
```

And find the price display (around line 497-502):

Change:
```tsx
                    {item.customSign ? (
                      <span className="font-medium text-amber-600 shrink-0 text-xs">Quote</span>
                    ) : (
```

To:
```tsx
                    {item.customSign || item.customSizeData?.requiresQuote ? (
                      <span className="font-medium text-amber-600 shrink-0 text-xs">Quote</span>
                    ) : (
```

- [ ] **Step 3: Update the footer quote notice**

Find the quote notice (around line 551-554):

Change:
```tsx
            {items.some((i) => i.customSign) && (
              <p className="text-[11px] text-amber-600 mt-2 text-center leading-relaxed">
                Custom sign items will be quoted separately after review.
              </p>
```

To:
```tsx
            {items.some((i) => i.customSign || i.customSizeData?.requiresQuote) && (
              <p className="text-[11px] text-amber-600 mt-2 text-center leading-relaxed">
                Items requiring a quote will be priced separately after review.
              </p>
```

- [ ] **Step 4: Verify compilation**

Run: `cd shop && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add shop/app/\(shop\)/checkout/page.tsx
git commit -m "feat: pass customSizeData through checkout and show quote badges"
```

---

## Task 7: Order API — Validation & Storage

**Files:**
- Modify: `shop/app/api/orders/route.ts:37-82`

- [ ] **Step 1: Add `customSizeData` to the item type, refactor validation to use `isQuoteItem`**

In `shop/app/api/orders/route.ts`, update the item type in the `validatedItems` map (line 37). Find the end of the type annotation and add `customSizeData` after `customFieldValues`:

Change:
```ts
customFieldValues?: Array<{ label: string; key: string; value: string }> }) => {
```

To:
```ts
customFieldValues?: Array<{ label: string; key: string; value: string }>; customSizeData?: { type: string; requestedWidth: number; requestedHeight: number; matchedVariantCode: string | null; matchedSize: string | null; matchedFromProduct: string | null; requiresQuote: boolean } }) => {
```

Then replace the validation logic:

Change:
```ts
      const isCustomSign = !!item.customSign;
      if (!isCustomSign && (price <= 0 || price > 100000)) {
        throw new Error(`Invalid price for item ${item.code}`);
      }
      if (isCustomSign && price !== 0) {
        throw new Error(`Custom sign items must have price 0`);
      }
```

To:
```ts
      const isQuoteItem = !!item.customSign || !!item.customSizeData?.requiresQuote;
      if (!isQuoteItem && (price <= 0 || price > 100000)) {
        throw new Error(`Invalid price for item ${item.code}`);
      }
      if (isQuoteItem && price !== 0) {
        throw new Error(`Quote items must have price 0`);
      }
```

- [ ] **Step 2: Add `custom_size` branch to the `custom_data` construction**

Find the end of the `customFieldValues` else-if block and its closing brace. Change:

```ts
      } else if (item.customFieldValues && item.customFieldValues.length > 0) {
        custom_data = {
          type: "custom_fields" as const,
          fields: item.customFieldValues.map((f) => ({
            label: String(f.label),
            key: String(f.key),
            value: String(f.value),
          })),
        };
      }
```

To:

```ts
      } else if (item.customFieldValues && item.customFieldValues.length > 0) {
        custom_data = {
          type: "custom_fields" as const,
          fields: item.customFieldValues.map((f) => ({
            label: String(f.label),
            key: String(f.key),
            value: String(f.value),
          })),
        };
      } else if (item.customSizeData) {
        custom_data = {
          type: "custom_size" as const,
          requestedWidth: Number(item.customSizeData.requestedWidth),
          requestedHeight: Number(item.customSizeData.requestedHeight),
          matchedVariantCode: item.customSizeData.matchedVariantCode ? String(item.customSizeData.matchedVariantCode) : null,
          matchedSize: item.customSizeData.matchedSize ? String(item.customSizeData.matchedSize) : null,
          matchedFromProduct: item.customSizeData.matchedFromProduct ? String(item.customSizeData.matchedFromProduct) : null,
          requiresQuote: !!item.customSizeData.requiresQuote,
        };
      }
```

- [ ] **Step 3: Verify compilation**

Run: `cd shop && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add shop/app/api/orders/route.ts
git commit -m "feat: accept customSizeData in order API with quote validation"
```

---

## Task 8: Admin Dashboard — Custom Size Display

**Files:**
- Modify: `shop/app/(shop)/admin/page.tsx:13-18` and `shop/app/(shop)/admin/page.tsx:678-711` and `shop/app/(shop)/admin/page.tsx:522-526`

- [ ] **Step 1: Add custom size fields to the order item type**

In `shop/app/(shop)/admin/page.tsx`, extend the `customData` type on the `OrderItem` interface.

Change:
```ts
  customData?: {
    type?: string;
    signType?: string;
    textContent?: string;
    shape?: string;
    additionalNotes?: string;
    fields?: Array<{ label: string; key: string; value: string }>;
  } | null;
```

To:
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
  } | null;
```

- [ ] **Step 2: Add a badge for custom size items on the order card**

Find the custom sign badge (around line 522-526):

```tsx
                    {order.items.some((i) => i.customData?.signType) && (
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-semibold rounded-full">
                        Custom Sign
                      </span>
                    )}
```

Add after that block:

```tsx
                    {order.items.some((i) => i.customData?.type === "custom_size") && (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-semibold rounded-full">
                        Custom Size
                      </span>
                    )}
```

- [ ] **Step 3: Add custom size rendering in the order items table**

In the order items rendering (around line 678-711), add a new condition before the standard item fallthrough. After the `if (item.customData?.signType)` block closes (around line 711), add:

```tsx
                              // Custom size request
                              if (item.customData?.type === "custom_size") {
                                const imgCode = (item.baseCode || item.code.replace(/\/.*$/, "").replace(/-cs\d+$/, "")).replace(/\//g, "_");
                                return (
                                  <tr key={i} className="border-b border-gray-50">
                                    <td className="py-2 pr-2">
                                      <img
                                        src={`/images/products/${imgCode}.png`}
                                        alt=""
                                        className="w-9 h-9 object-contain rounded"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = "none";
                                        }}
                                      />
                                    </td>
                                    <td className="py-2.5">
                                      <p className="font-medium text-gray-900 text-xs">{item.name}</p>
                                      <p className="text-xs text-gray-500">{item.size} &middot; {item.customData.matchedSize ? `Priced as ${item.customData.matchedSize}` : "Requires quote"}</p>
                                      {item.customData.matchedFromProduct && (
                                        <p className="text-[10px] text-gray-400">(price from {item.customData.matchedFromProduct})</p>
                                      )}
                                    </td>
                                    <td className="py-2.5 text-center text-gray-500">{item.quantity}</td>
                                    <td className="py-2.5 text-right font-medium text-xs">
                                      {item.customData.requiresQuote ? (
                                        <span className="text-amber-600">Quote</span>
                                      ) : (
                                        <span className="text-gray-700">{"\u00A3"}{(item.price * item.quantity).toFixed(2)}</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              }
```

- [ ] **Step 4: Verify compilation**

Run: `cd shop && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add shop/app/\(shop\)/admin/page.tsx
git commit -m "feat: display custom size details in admin order view"
```

---

## Task 9: Build Verification & Manual Testing

- [ ] **Step 1: Run full TypeScript check**

Run: `cd shop && npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 2: Run production build**

Run: `cd shop && npx next build 2>&1 | tail -30`
Expected: Build succeeds with no errors

- [ ] **Step 3: Manual test checklist**

Start dev server: `cd shop && npm run dev`

Test the following:

1. Navigate to a product with multiple sized variants (e.g. `/product/PCF29`)
2. Verify "Need a custom size?" section appears below variant cards
3. Expand it, enter width: 350, height: 500
4. Verify results appear per material with correct pricing
5. Add a custom-sized item to basket
6. Navigate to basket — verify custom size info displays correctly
7. Navigate to a product with no sized variants — verify custom size section does NOT appear
8. Test a size that exceeds all variants — verify "requires manual quote" message
9. Proceed through checkout — verify custom size items appear in order summary
10. Submit an order — verify it saves correctly and appears in admin dashboard with custom size details

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```
