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
