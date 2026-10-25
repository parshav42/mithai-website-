import { isPurchasable, type Product } from "../data/products";

export type CartItems = Record<string, number>;

export type CartAction =
  | { type: "add"; productId: string }
  | { type: "set-quantity"; productId: string; quantity: number }
  | { type: "remove"; productId: string };

export const MAX_CART_QUANTITY = 99;

export function normalizeCart(value: unknown, catalog: readonly Product[]): CartItems {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const validIds = new Set(catalog.map((product) => product.id));
  const normalized: CartItems = {};

  for (const [productId, quantity] of Object.entries(value)) {
    if (
      validIds.has(productId) &&
      Number.isInteger(quantity) &&
      quantity > 0 &&
      quantity <= MAX_CART_QUANTITY
    ) {
      normalized[productId] = quantity;
    }
  }

  return normalized;
}

export function updateCart(
  current: CartItems,
  action: CartAction,
  catalog: readonly Product[],
): CartItems {
  const product = catalog.find((item) => item.id === action.productId);
  if (!product) return current;

  if (action.type === "remove") {
    const next = { ...current };
    delete next[action.productId];
    return next;
  }

  if (!isPurchasable(product)) {
    return current;
  }

  if (action.type === "add") {
    const quantity = current[action.productId] ?? 0;
    if (quantity >= MAX_CART_QUANTITY) return current;
    return { ...current, [action.productId]: quantity + 1 };
  }

  if (
    !Number.isInteger(action.quantity) ||
    action.quantity < 1 ||
    action.quantity > MAX_CART_QUANTITY
  ) {
    return current;
  }

  return { ...current, [action.productId]: action.quantity };
}

export function calculateSubtotal(items: CartItems, catalog: readonly Product[]) {
  return catalog.reduce((subtotal, product) => {
    if (!isPurchasable(product)) return subtotal;
    const quantity = items[product.id] ?? 0;
    const lineTotal = product.priceInPaise * quantity;
    if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(subtotal + lineTotal)) {
      return subtotal;
    }
    return subtotal + lineTotal;
  }, 0);
}

export function countCartItems(items: CartItems) {
  return Object.values(items).reduce((count, quantity) => count + quantity, 0);
}
