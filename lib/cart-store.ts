import { isPurchasable, type Product } from "../data/products";
import { normalizeCart, updateCart, type CartItems } from "./cart";

const STORAGE_KEY = "mithai-house-cart-v1";

export type CartSnapshot = {
  items: CartItems;
  isReady: boolean;
  notice: string;
};

const EMPTY_SNAPSHOT: CartSnapshot = {
  items: {},
  isReady: false,
  notice: "",
};

let snapshot = EMPTY_SNAPSHOT;
let hasReadStorage = false;
let catalogSignature = "";
let activeCatalog: readonly Product[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function readStorage(catalog: readonly Product[]) {
  if (typeof window === "undefined") return;
  const signature = catalog.map((product) => product.id).join("|");
  if (hasReadStorage && signature === catalogSignature) return;
  hasReadStorage = true;
  catalogSignature = signature;

  try {
    const serialized = window.localStorage.getItem(STORAGE_KEY);
    if (!serialized) {
      snapshot = { items: {}, isReady: true, notice: "" };
      return;
    }

    try {
      const saved: unknown = JSON.parse(serialized);
      const items = normalizeCart(saved, catalog);
      const invalidEntries =
        typeof saved === "object" &&
        saved !== null &&
        !Array.isArray(saved) &&
        Object.keys(saved).length !== Object.keys(items).length;
      snapshot = {
        items,
        isReady: true,
        notice: invalidEntries
          ? "Some invalid saved cart items were removed."
          : "",
      };
    } catch {
      snapshot = {
        items: {},
        isReady: true,
        notice: "Saved cart data was unreadable. Your cart has been started fresh.",
      };
    }
  } catch {
    snapshot = {
      items: {},
      isReady: true,
      notice: "Browser storage is unavailable. Cart changes may not persist.",
    };
  }
}

export function getCartSnapshot() {
  return snapshot;
}

export function getServerCartSnapshot() {
  return EMPTY_SNAPSHOT;
}

export function configureCartCatalog(catalog: readonly Product[]) {
  activeCatalog = catalog;
  hasReadStorage = false;
  readStorage(catalog);
  notify();
}

export function subscribeToCart(listener: () => void) {
  listeners.add(listener);
  readStorage(activeCatalog);

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    hasReadStorage = false;
    readStorage(activeCatalog);
    notify();
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function persist(items: CartItems, notice = "") {
  let nextNotice = notice;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    nextNotice = "Cart changes could not be saved in this browser.";
  }
  snapshot = { items, isReady: true, notice: nextNotice };
  notify();
}

export function addCartItem(productId: string, catalog: readonly Product[]) {
  if (!snapshot.isReady) {
    snapshot = { ...snapshot, notice: "Your saved cart is still loading. Please try again." };
    notify();
    return;
  }

  const product = catalog.find((item) => item.id === productId);
  if (!product || !isPurchasable(product)) {
    snapshot = {
      ...snapshot,
      notice:
        "This example product cannot be purchased until its price and availability are confirmed.",
    };
    notify();
    return;
  }
  if ((snapshot.items[productId] ?? 0) >= 99) {
    snapshot = { ...snapshot, notice: "The maximum quantity for this item is 99." };
    notify();
    return;
  }

  persist(
    updateCart(snapshot.items, { type: "add", productId }, catalog),
    `${product.name} added to your cart.`,
  );
}

export function setCartQuantity(productId: string, quantity: number, catalog: readonly Product[]) {
  const nextItems = updateCart(
    snapshot.items,
    { type: "set-quantity", productId, quantity },
    catalog,
  );
  if (nextItems !== snapshot.items) persist(nextItems);
}

export function removeCartItem(productId: string, catalog: readonly Product[]) {
  if (!Object.hasOwn(snapshot.items, productId)) return;
  persist(
    updateCart(snapshot.items, { type: "remove", productId }, catalog),
    "Item removed from your cart.",
  );
}

export function dismissCartNotice() {
  if (!snapshot.notice) return;
  snapshot = { ...snapshot, notice: "" };
  notify();
}
