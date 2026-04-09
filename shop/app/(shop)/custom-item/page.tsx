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
