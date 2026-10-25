import {
  formatPrice,
  isPurchasable,
  type Product,
} from "../data/products.ts";
import { MAX_CART_QUANTITY } from "./cart.ts";

export type FulfillmentMethod = "delivery" | "pickup";
export type CheckoutField =
  | "customerName"
  | "phone"
  | "fulfillment"
  | "address"
  | "instructions"
  | "items";

export type CheckoutSubmission = {
  customerName: string;
  phone: string;
  fulfillment: FulfillmentMethod;
  address: string;
  instructions: string;
  items: Array<{ productId: string; quantity: number }>;
};

export type CheckoutFieldErrors = Partial<Record<CheckoutField, string>>;

export type ValidatedCheckout = {
  customerName: string;
  phone: string;
  fulfillment: FulfillmentMethod;
  address: string;
  instructions: string;
  lines: Array<{ product: Product & { priceInPaise: number }; quantity: number }>;
  subtotalInPaise: bigint;
};

export type CheckoutValidationResult =
  | { success: true; checkout: ValidatedCheckout }
  | { success: false; errors: CheckoutFieldErrors };

export type WhatsAppPreparationResult =
  | {
      success: true;
      whatsappUrl: string;
      message: string;
      subtotalInPaise: bigint;
    }
  | { success: false; status: 400 | 422 | 503; error: string; errors?: CheckoutFieldErrors };

const MAX_NAME_LENGTH = 100;
const MAX_PHONE_LENGTH = 24;
const MAX_ADDRESS_LENGTH = 500;
const MAX_INSTRUCTIONS_LENGTH = 500;
const MAX_CHECKOUT_LINES = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateCheckoutSubmission(
  value: unknown,
  catalog: readonly Product[],
): CheckoutValidationResult {
  if (!isRecord(value)) {
    return {
      success: false,
      errors: { items: "Checkout details are invalid. Please review your information." },
    };
  }

  const customerName =
    typeof value.customerName === "string" ? value.customerName.trim() : "";
  const phone = typeof value.phone === "string" ? value.phone.trim() : "";
  const fulfillment = value.fulfillment;
  const address = typeof value.address === "string" ? value.address.trim() : "";
  const instructions =
    typeof value.instructions === "string" ? value.instructions.trim() : "";
  const errors: CheckoutFieldErrors = {};

  if (customerName.length < 2 || customerName.length > MAX_NAME_LENGTH) {
    errors.customerName = "Enter a name between 2 and 100 characters.";
  }

  const phoneDigits = phone.replace(/\D/g, "");
  if (
    phone.length > MAX_PHONE_LENGTH ||
    !/^\+?[\d\s().-]+$/.test(phone) ||
    phoneDigits.length < 7 ||
    phoneDigits.length > 15
  ) {
    errors.phone = "Enter a valid phone number, including country code if needed.";
  }

  if (fulfillment !== "delivery" && fulfillment !== "pickup") {
    errors.fulfillment = "Choose delivery or pickup.";
  }

  if (
    fulfillment === "delivery" &&
    (address.length < 5 || address.length > MAX_ADDRESS_LENGTH)
  ) {
    errors.address = "Enter a delivery address between 5 and 500 characters.";
  }
  if (address.length > MAX_ADDRESS_LENGTH) {
    errors.address = "The delivery address must be 500 characters or fewer.";
  }
  if (instructions.length > MAX_INSTRUCTIONS_LENGTH) {
    errors.instructions = "Instructions must be 500 characters or fewer.";
  }

  const rawItems = value.items;
  if (
    !Array.isArray(rawItems) ||
    rawItems.length === 0 ||
    rawItems.length > MAX_CHECKOUT_LINES
  ) {
    errors.items = "Your cart is empty or contains too many items.";
  }

  const lines: ValidatedCheckout["lines"] = [];
  let subtotalInPaise = 0n;
  const seenProductIds = new Set<string>();

  if (Array.isArray(rawItems) && rawItems.length <= MAX_CHECKOUT_LINES) {
    for (const rawItem of rawItems) {
      if (
        !isRecord(rawItem) ||
        typeof rawItem.productId !== "string" ||
        typeof rawItem.quantity !== "number" ||
        !Number.isInteger(rawItem.quantity) ||
        rawItem.quantity < 1 ||
        rawItem.quantity > MAX_CART_QUANTITY
      ) {
        errors.items = "One or more cart quantities are invalid.";
        continue;
      }

      if (seenProductIds.has(rawItem.productId)) {
        errors.items = "A product appears more than once in your cart.";
        continue;
      }
      seenProductIds.add(rawItem.productId);

      const product = catalog.find((item) => item.id === rawItem.productId);
      if (!product || !isPurchasable(product)) {
        errors.items =
          "Your cart contains a product whose price or availability is not confirmed by the shop.";
        continue;
      }

      const quantity = rawItem.quantity;
      if (
        product.stockQuantity !== undefined &&
        quantity > product.stockQuantity
      ) {
        errors.items = `${product.name} does not have enough stock for that quantity.`;
        continue;
      }
      lines.push({ product, quantity });
      subtotalInPaise += BigInt(product.priceInPaise) * BigInt(quantity);
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    checkout: {
      customerName,
      phone,
      fulfillment: fulfillment === "pickup" ? "pickup" : "delivery",
      address: fulfillment === "delivery" ? address : "",
      instructions,
      lines,
      subtotalInPaise,
    },
  };
}

export function normalizeWhatsAppNumber(value: string | undefined) {
  if (!value) return null;
  const number = value.trim();
  if (!/^[\d\s()+.-]+$/.test(number)) return null;

  const digits = number.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export function isWhatsAppConfigured(value: string | undefined) {
  return normalizeWhatsAppNumber(value) !== null;
}

export function prepareWhatsAppMessage(
  value: unknown,
  catalog: readonly Product[],
  configuredNumber: string | undefined,
): WhatsAppPreparationResult {
  const number = normalizeWhatsAppNumber(configuredNumber);
  if (!number) {
    return {
      success: false,
      status: 503,
      error: "WhatsApp ordering is not configured yet. Please contact the shop directly.",
    };
  }

  const validation = validateCheckoutSubmission(value, catalog);
  if (!validation.success) {
    return {
      success: false,
      status: 422,
      error: "Some checkout details need attention before you can prepare a message.",
      errors: validation.errors,
    };
  }

  const { checkout } = validation;
  const lines = checkout.lines.map(({ product, quantity }) => {
    const lineTotal = BigInt(product.priceInPaise) * BigInt(quantity);
    return `• ${product.name} × ${quantity} — ${formatPrice(lineTotal)}`;
  });
  const fulfillmentDetails =
    checkout.fulfillment === "delivery"
      ? `Delivery address: ${checkout.address}`
      : "Pickup requested";
  const message = [
    "Order enquiry — not confirmed",
    `Name: ${checkout.customerName}`,
    `Phone: ${checkout.phone}`,
    `Fulfilment: ${fulfillmentDetails}`,
    "",
    "Requested items:",
    ...lines,
    `Subtotal: ${formatPrice(checkout.subtotalInPaise)}`,
    "Delivery charges and final availability require confirmation from the shop.",
    ...(checkout.instructions ? [`Instructions: ${checkout.instructions}`] : []),
    "",
    "Please confirm availability and the final order details.",
  ].join("\n");

  return {
    success: true,
    whatsappUrl: `https://wa.me/${number}?text=${encodeURIComponent(message)}`,
    message,
    subtotalInPaise: checkout.subtotalInPaise,
  };
}
