"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  calculateSubtotal,
  countCartItems,
  normalizeCart,
  updateCart,
  type CartItems,
} from "@/lib/cart";
import { getProductById, isPurchasable, products } from "@/data/products";

const STORAGE_KEY = "mithai-house-cart-v1";

type CartContextValue = {
  items: CartItems;
  itemCount: number;
  subtotalInPaise: number;
  isReady: boolean;
  notice: string;
  addItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearNotice: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItems>({});
  const [isReady, setIsReady] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          setItems(normalizeCart(JSON.parse(stored), products));
        } catch {
          setNotice("Saved cart data was unreadable. Your cart has been started fresh.");
        }
      }
    } catch {
      setNotice("Browser storage is unavailable. Cart changes may not persist.");
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      setNotice("Cart changes could not be saved in this browser.");
    }
  }, [isReady, items]);

  const addItem = useCallback((productId: string) => {
    const product = getProductById(productId);
    if (!product || !isPurchasable(product)) {
      setNotice("This example product cannot be purchased until its price and availability are confirmed.");
      return;
    }

    setItems((current) => {
      if ((current[productId] ?? 0) >= 99) {
        setNotice("The maximum quantity for this item is 99.");
        return current;
      }
      setNotice(`${product.name} added to your cart.`);
      return updateCart(current, { type: "add", productId }, products);
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setItems((current) =>
      updateCart(current, { type: "set-quantity", productId, quantity }, products),
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((current) => updateCart(current, { type: "remove", productId }, products));
    setNotice("Item removed from your cart.");
  }, []);
  const clearNotice = useCallback(() => setNotice(""), []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      itemCount: countCartItems(items),
      subtotalInPaise: calculateSubtotal(items, products),
      isReady,
      notice,
      addItem,
      setQuantity,
      removeItem,
      clearNotice,
    }),
    [addItem, clearNotice, isReady, items, notice, removeItem, setQuantity],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside CartProvider.");
  }
  return context;
}
