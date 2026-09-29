"use client";

import { useState } from "react";
import { useBasket, BasketItem } from "./BasketContext";
import CustomFieldInputs from "./CustomFieldInputs";
import { Variant, Product } from "@/lib/catalog";

interface Props {
  product: Product;
  variant: Variant;
}

export default function AddToBasketButton({ product, variant }: Props) {
  const { addItem } = useBasket();
  const [qty, setQty] = useState(1);
  const customFields = product.customFields || [];
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(customFields.map((f) => [f.key, ""]))
  );

  const allFieldsFilled = customFields.every(
    (f) => fieldValues[f.key]?.trim()
  );

  const handleAdd = () => {
    const cfValues = customFields.length
      ? customFields.map((f) => ({
          label: f.label,
          key: f.key,
          value: fieldValues[f.key].trim(),
        }))
      : undefined;

    const item: Omit<BasketItem, "quantity"> = {
      // Use unique code when custom fields are filled to prevent basket merging
      code: cfValues ? `${variant.code}-cf${Date.now()}` : variant.code,
      baseCode: product.baseCode,
      name: product.name,
      size: variant.size,
      material: variant.material,
      description: variant.description,
      price: variant.price,
      image: product.image,
      ...(cfValues ? { customFieldValues: cfValues } : {}),
    };
    addItem(item, qty);
    setQty(1);
    // Reset custom field inputs after adding
    if (customFields.length) {
      setFieldValues(
        Object.fromEntries(customFields.map((f) => [f.key, ""]))
      );
    }
  };

  return (
    <div className="space-y-3">
      {customFields.length > 0 && (
        <CustomFieldInputs
          fields={customFields}
          values={fieldValues}
          onChange={(key, value) =>
            setFieldValues((prev) => ({ ...prev, [key]: value }))
          }
        />
      )}

      <div className="flex items-center gap-3">
        <div className="flex items-center bg-persimmon-gray rounded-xl overflow-hidden">
          <button
            onClick={() => setQty(Math.max(1, qty - 1))}
            className="px-3 py-2.5 hover:bg-persimmon-gray-dark text-gray-500 font-medium transition"
          >
            -
          </button>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-12 text-center py-2.5 bg-transparent text-sm font-medium text-persimmon-navy"
            min={1}
          />
          <button
            onClick={() => setQty(qty + 1)}
            className="px-3 py-2.5 hover:bg-persimmon-gray-dark text-gray-500 font-medium transition"
          >
            +
          </button>
        </div>
        <button
          onClick={handleAdd}
          disabled={customFields.length > 0 && !allFieldsFilled}
          className="flex-1 py-2.5 px-6 rounded-xl font-medium transition-all text-white bg-persimmon-green hover:bg-persimmon-green-dark active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add to Basket
        </button>
      </div>
    </div>
  );
}
