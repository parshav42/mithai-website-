"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import {
  addCartItem,
  dismissCartNotice,
  getCartSnapshot,
  getServerCartSnapshot,
  removeCartItem,
  setCartQuantity,
  subscribeToCart,
} from "@/lib/cart-store";
import { calculateSubtotal, countCartItems } from "@/lib/cart";
import { products } from "@/data/products";

type CartContextValue = {
  items: ReturnType<typeof getCartSnapshot>["items"];
  itemCount: number;
  subtotalInPaise: bigint;
  isReady: boolean;
  notice: string;
  addItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearNotice: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribeToCart,
    getCartSnapshot,
    getServerCartSnapshot,
  );
  const addItem = useCallback((productId: string) => addCartItem(productId), []);
  const setQuantity = useCallback(
    (productId: string, quantity: number) => setCartQuantity(productId, quantity),
    [],
  );
  const removeItem = useCallback((productId: string) => removeCartItem(productId), []);
  const clearNotice = useCallback(() => dismissCartNotice(), []);

  const value = useMemo<CartContextValue>(
    () => ({
      items: snapshot.items,
      itemCount: countCartItems(snapshot.items),
      subtotalInPaise: calculateSubtotal(snapshot.items, products),
      isReady: snapshot.isReady,
      notice: snapshot.notice,
      addItem,
      setQuantity,
      removeItem,
      clearNotice,
    }),
    [addItem, clearNotice, removeItem, setQuantity, snapshot],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      {snapshot.notice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-lg items-center justify-between gap-4 border border-gold bg-ivory px-4 py-3 text-sm text-brown shadow-lg"
        >
          <p>{snapshot.notice}</p>
          <button
            type="button"
            aria-label="Dismiss cart message"
            onClick={clearNotice}
            className="flex size-9 shrink-0 items-center justify-center text-maroon hover:bg-white"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
      )}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside CartProvider.");
  }
  return context;
}
