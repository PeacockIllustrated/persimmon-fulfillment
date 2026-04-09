"use client";

import Link from "next/link";
import Image from "next/image";
import { useBasket } from "@/components/BasketContext";

export default function BasketPage() {
  const { items, updateQuantity, removeItem, totalPrice, deliveryFee } = useBasket();

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 bg-persimmon-gray rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-persimmon-navy mb-2">Your basket is empty</h1>
        <p className="text-gray-400 mb-8">Browse our signage range and add items to get started.</p>
        <Link
          href="/"
          className="inline-block bg-persimmon-green text-white px-8 py-3 rounded-xl font-medium hover:bg-persimmon-green-dark transition"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-persimmon-navy mb-6">Your Basket</h1>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.code}
            className="flex gap-4 bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-200 transition"
          >
            <div className="w-20 h-20 bg-persimmon-gray rounded-xl shrink-0 flex items-center justify-center overflow-hidden">
              {item.image ? (
                <Image
                  src={item.image}
                  alt={item.name}
                  width={80}
                  height={80}
                  className="object-contain"
                />
              ) : (
                <svg className="w-8 h-8 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 truncate">{item.name}</h3>
              {item.size && <p className="text-sm text-gray-400 mt-0.5">{item.size}</p>}
              {item.material && <p className="text-xs text-gray-300">{item.material}</p>}
              {item.customFieldValues && item.customFieldValues.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {item.customFieldValues.map((f) => (
                    <p key={f.key} className="text-xs text-persimmon-green">
                      {f.label}: <span className="text-gray-600">{f.value}</span>
                    </p>
                  ))}
                </div>
              )}
              {item.customSizeData && !item.customSizeData.requiresQuote && (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Priced as {item.customSizeData.matchedSize}
                  {item.customSizeData.matchedFromProduct && (
                    <span> from {item.customSizeData.matchedFromProduct}</span>
                  )}
                </p>
              )}
              {item.customSign || item.customSizeData?.requiresQuote || !!item.customQuote ? (
                <p className="text-amber-600 font-semibold mt-1.5 text-sm">Quote on request</p>
              ) : (
                <p className="text-persimmon-navy font-semibold mt-1.5 text-sm">
                  {"\u00A3"}{item.price.toFixed(2)} each
                </p>
              )}
            </div>

            <div className="flex flex-col items-end justify-between">
              <button
                onClick={() => removeItem(item.code)}
                className="text-gray-300 hover:text-red-500 transition p-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="flex items-center bg-persimmon-gray rounded-lg overflow-hidden">
                <button
                  onClick={() => updateQuantity(item.code, item.quantity - 1)}
                  className="px-2.5 py-1.5 hover:bg-persimmon-gray-dark text-sm text-gray-500 transition"
                >
                  -
                </button>
                <span className="px-3 py-1.5 text-sm font-medium text-persimmon-navy">
                  {item.quantity}
                </span>
                <button
                  onClick={() => updateQuantity(item.code, item.quantity + 1)}
                  className="px-2.5 py-1.5 hover:bg-persimmon-gray-dark text-sm text-gray-500 transition"
                >
                  +
                </button>
              </div>

              {item.customSign || item.customSizeData?.requiresQuote || !!item.customQuote ? (
                <p className="font-bold text-amber-600 text-xs">Quote</p>
              ) : (
                <p className="font-bold text-persimmon-navy text-sm">
                  {"\u00A3"}{(item.price * item.quantity).toFixed(2)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Free delivery nudge */}
      {deliveryFee > 0 && (() => {
        const remaining = Math.ceil((100 - totalPrice) * 100) / 100;
        return (
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800">
                Spend {"\u00A3"}{remaining.toFixed(2)} more to get free delivery!
              </p>
              <p className="text-xs text-amber-600 mt-0.5">Free delivery on all orders over {"\u00A3"}100.</p>
              <Link href="/" className="inline-block mt-2 text-xs font-semibold text-persimmon-green hover:underline">
                Continue shopping &rarr;
              </Link>
            </div>
          </div>
        );
      })()}

      {deliveryFee === 0 && (
        <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm font-medium text-emerald-700">Your order qualifies for free delivery!</p>
        </div>
      )}

      <div className="mt-4 bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-3">
          <span className="text-gray-500">Subtotal (ex. VAT)</span>
          <span className="text-xl font-bold text-persimmon-navy">
            {"\u00A3"}{totalPrice.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between items-center mb-3 text-sm">
          <span className="text-gray-500">Delivery</span>
          {deliveryFee > 0 ? (
            <span className="text-gray-700">{"\u00A3"}{deliveryFee.toFixed(2)}</span>
          ) : (
            <span className="text-persimmon-green font-medium">FREE</span>
          )}
        </div>
        <div className="flex justify-between items-center mb-4 text-sm text-gray-400">
          <span>VAT (20%)</span>
          <span>{"\u00A3"}{((totalPrice + deliveryFee) * 0.2).toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center mb-6 border-t border-gray-100 pt-4">
          <span className="text-lg font-bold text-persimmon-navy">Total (inc. VAT)</span>
          <span className="text-2xl font-bold text-persimmon-green">
            {"\u00A3"}{((totalPrice + deliveryFee) * 1.2).toFixed(2)}
          </span>
        </div>

        {items.some((i) => i.customSign || i.customSizeData?.requiresQuote || !!i.customQuote) && (
          <p className="text-xs text-amber-600 mb-4 leading-relaxed">
            This order includes items requiring a quote. Final pricing for those items will be confirmed after review.
          </p>
        )}

        <div className="flex gap-3">
          <Link
            href="/"
            className="px-6 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition font-medium text-sm"
          >
            Continue Shopping
          </Link>
          <Link
            href="/checkout"
            className="flex-1 bg-persimmon-green text-white px-6 py-3 rounded-xl font-medium hover:bg-persimmon-green-dark transition text-center"
          >
            Proceed to Checkout
          </Link>
        </div>
      </div>
    </div>
  );
}
