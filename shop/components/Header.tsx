"use client";

import Link from "next/link";
import Image from "next/image";
import { useBasket } from "./BasketContext";
import { useState, useEffect } from "react";
import SearchBar from "./SearchBar";
import BasketDrawer from "./BasketDrawer";

export default function Header() {
  const { totalItems, totalPrice, setDrawerOpen } = useBasket();
  const [menuOpen, setMenuOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header className={`bg-white/95 backdrop-blur-md border-b sticky top-0 z-50 transition-[box-shadow,border-color] duration-300 ${scrolled ? "shadow-md border-gray-200/60" : "border-gray-200/80 shadow-none"}`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <Image
              src="/assets/persimmon_icon.svg"
              alt="Persimmon"
              width={28}
              height={27}
              className="shrink-0"
            />
            <div className="flex flex-col">
              <Image
                src="/assets/persimmon_wordmark.svg"
                alt="Persimmon"
                width={90}
                height={13}
                className="h-[13px] w-auto"
              />
              <span className="text-[10px] text-gray-400 leading-tight mt-0.5 tracking-wide">Signage Portal</span>
            </div>
          </Link>

          <div className="hidden md:block flex-1 max-w-lg mx-4">
            <SearchBar />
          </div>

          <div className="flex items-center gap-2">
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

            <Link
              href="/orders"
              className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 hover:text-persimmon-navy px-3 py-2 rounded-lg hover:bg-gray-50 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Orders
            </Link>

            <button
              onClick={() => setDrawerOpen(true)}
              className="relative flex items-center gap-2 text-sm font-medium text-persimmon-navy bg-persimmon-gray hover:bg-persimmon-gray-dark rounded-lg px-4 py-2.5 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              {totalItems > 0 && (
                <>
                  <span className="text-persimmon-navy">{totalItems}</span>
                  <span className="text-gray-300">|</span>
                  <span className="text-persimmon-green font-semibold">
                    {"\u00A3"}{totalPrice.toFixed(2)}
                  </span>
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-persimmon-green rounded-full" />
                </>
              )}
            </button>

            <button
              className="md:hidden p-2 hover:bg-gray-50 rounded-lg transition"
              onClick={() => {
                const next = !menuOpen;
                setMenuOpen(next);
                if (!next) setCustomOpen(false);
              }}
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden px-4 pb-3 border-t border-gray-100 pt-3">
            <SearchBar />
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
            <Link
              href="/orders"
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-persimmon-navy mt-3 px-1"
              onClick={() => setMenuOpen(false)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Orders
            </Link>
          </div>
        )}
      </header>
      <BasketDrawer />
    </>
  );
}
