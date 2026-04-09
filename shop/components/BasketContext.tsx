"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import type { CustomSizeData } from "@/lib/custom-size-pricing";
import { calculateDeliveryFee } from "@/lib/delivery";

export interface CustomSignData {
  signType: string;
  textContent: string;
  shape: string;
  additionalNotes: string;
}

export interface CustomFieldValue {
  label: string;
  key: string;
  value: string;
}

export interface CustomQuoteData {
  code: string | null;
  description: string;
  size: string;
  material: string;
  additionalNotes: string;
}

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
  customSizeData?: CustomSizeData;
  customQuote?: CustomQuoteData;
}

interface BasketContextType {
  items: BasketItem[];
  addItem: (item: Omit<BasketItem, "quantity">, quantity?: number) => void;
  removeItem: (code: string) => void;
  updateQuantity: (code: string, quantity: number) => void;
  clearBasket: () => void;
  totalItems: number;
  totalPrice: number;
  deliveryFee: number;
  toast: string | null;
  showToast: (message: string) => void;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

const BasketContext = createContext<BasketContextType | undefined>(undefined);

export function BasketProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BasketItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("persimmon-basket");
    if (stored) {
      try {
        setItems(JSON.parse(stored));
      } catch {}
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem("persimmon-basket", JSON.stringify(items));
    }
  }, [items, loaded]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const addItem = (item: Omit<BasketItem, "quantity">, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.code === item.code);
      if (existing) {
        return prev.map((i) =>
          i.code === item.code ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { ...item, quantity }];
    });
    showToast(`${quantity}x added to basket`);
  };

  const removeItem = (code: string) => {
    setItems((prev) => prev.filter((i) => i.code !== code));
  };

  const updateQuantity = (code: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(code);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.code === code ? { ...i, quantity } : i))
    );
  };

  const clearBasket = () => setItems([]);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const deliveryFee = calculateDeliveryFee(totalPrice);

  return (
    <BasketContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearBasket, totalItems, totalPrice, deliveryFee, toast, showToast, drawerOpen, setDrawerOpen }}
    >
      {children}
    </BasketContext.Provider>
  );
}

export function useBasket() {
  const context = useContext(BasketContext);
  if (!context) throw new Error("useBasket must be used within BasketProvider");
  return context;
}
