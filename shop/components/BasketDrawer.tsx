"use client";

import Image from "next/image";
import Link from "next/link";
import { useBasket } from "./BasketContext";
import { useEffect } from "react";

export default function BasketDrawer() {
  const { items, updateQuantity, removeItem, totalPrice, deliveryFee, totalItems, drawerOpen, setDrawerOpen } = useBasket();

  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  if (!drawerOpen) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        style={{ animation: "fade-in 0.2s ease-out" }}
        onClick={() => setDrawerOpen(false)}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl flex flex-col"
        style={{ animation: "drawer-in 0.3s ease-out" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-persimmon-navy">
            Your Basket ({totalItems})
          </h2>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">Your basket is empty</p>
            <button
              onClick={() => setDrawerOpen(false)}
              className="mt-4 text-persimmon-green text-sm font-medium hover:underline"
            >
              Continue browsing
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {items.map((item) => (
                <div key={item.code} className="flex gap-3">
                  <div className="w-14 h-14 bg-gray-50 rounded-lg shrink-0 flex items-center justify-center overflow-hidden">
                    {item.image ? (
                      <Image src={item.image} alt={item.name} width={56} height={56} className="object-contain" />
                    ) : (
                      <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.customSign ? `${item.customSign.signType.charAt(0).toUpperCase() + item.customSign.signType.slice(1).replace("-", " ")} Sign` : item.code}{item.size ? ` \u2022 ${item.size}` : ""}</p>
                    {item.customFieldValues && item.customFieldValues.length > 0 && (
                      <div className="mt-0.5">
                        {item.customFieldValues.map((f) => (
                          <p key={f.key} className="text-[11px] text-persimmon-green truncate">
                            {f.label}: <span className="text-gray-500">{f.value}</span>
                          </p>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQuantity(item.code, item.quantity - 1)}
                          className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-xs"
                        >
                          -
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.code, item.quantity + 1)}
                          className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-xs"
                        >
                          +
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.customSign || item.customSizeData?.requiresQuote || !!item.customQuote ? (
                          <span className="text-xs font-semibold text-amber-600">Quote</span>
                        ) : (
                          <span className="text-sm font-semibold text-persimmon-navy">
                            {"\u00A3"}{(item.price * item.quantity).toFixed(2)}
                          </span>
                        )}
                        <button
                          onClick={() => removeItem(item.code)}
                          className="text-gray-300 hover:text-red-500 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 px-6 py-4 space-y-3 bg-white">
              {deliveryFee > 0 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
                  </svg>
                  <p className="text-xs text-amber-800">
                    <span className="font-medium">Spend {"\u00A3"}{(Math.ceil((100 - totalPrice) * 100) / 100).toFixed(2)} more for free delivery.</span>
                    {" "}Orders over {"\u00A3"}100 qualify.
                  </p>
                </div>
              )}
              {deliveryFee === 0 && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-xs font-medium text-emerald-700">Free delivery!</p>
                </div>
              )}
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal (ex. VAT)</span>
                <span>{"\u00A3"}{totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Delivery</span>
                {deliveryFee > 0 ? (
                  <span>{"\u00A3"}{deliveryFee.toFixed(2)}</span>
                ) : (
                  <span className="text-persimmon-green font-medium">FREE</span>
                )}
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>VAT (20%)</span>
                <span>{"\u00A3"}{((totalPrice + deliveryFee) * 0.2).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-persimmon-navy pt-2 border-t border-gray-100">
                <span>Total</span>
                <span>{"\u00A3"}{((totalPrice + deliveryFee) * 1.2).toFixed(2)}</span>
              </div>
              {items.some((i) => i.customSign || i.customSizeData?.requiresQuote || !!i.customQuote) && (
                <p className="text-[11px] text-amber-600 leading-relaxed">
                  Custom sign items will be quoted separately.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  href="/basket"
                  onClick={() => setDrawerOpen(false)}
                  className="py-2.5 text-center rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  View Basket
                </Link>
                <Link
                  href="/checkout"
                  onClick={() => setDrawerOpen(false)}
                  className="py-2.5 text-center rounded-lg bg-persimmon-green text-white text-sm font-medium hover:bg-persimmon-green-dark transition"
                >
                  Checkout
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
