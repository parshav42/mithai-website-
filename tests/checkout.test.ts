import assert from "node:assert/strict";
import test from "node:test";
import { products, type Product } from "../data/products.ts";
import {
  isWhatsAppConfigured,
  normalizeWhatsAppNumber,
  prepareWhatsAppMessage,
  validateCheckoutSubmission,
} from "../lib/checkout.ts";
import { getPaymentSetupStatus } from "../lib/payments/provider.ts";

const confirmedProduct: Product = {
  ...products[0],
  id: "shop-kaju-katli",
  availability: "available",
  priceInPaise: 12_500,
  isDemonstration: false,
};
const catalog = [...products, confirmedProduct];

function submission(overrides: Record<string, unknown> = {}) {
  return {
    customerName: "Asha Rao",
    phone: "+91 98765 43210",
    fulfillment: "delivery",
    address: "12 Mithai Lane, Jaipur",
    instructions: "",
    items: [{ productId: confirmedProduct.id, quantity: 2 }],
    ...overrides,
  };
}

test("rejects an empty cart and invalid customer details", () => {
  const emptyCart = validateCheckoutSubmission(submission({ items: [] }), catalog);
  assert.equal(emptyCart.success, false);
  if (!emptyCart.success) assert.match(emptyCart.errors.items ?? "", /cart is empty/);

  const invalidDetails = validateCheckoutSubmission(
    submission({ customerName: " ", phone: "no phone", address: "x" }),
    catalog,
  );
  assert.equal(invalidDetails.success, false);
  if (!invalidDetails.success) {
    assert.ok(invalidDetails.errors.customerName);
    assert.ok(invalidDetails.errors.phone);
    assert.ok(invalidDetails.errors.address);
  }
});

test("delivery requires an address while pickup does not include one", () => {
  const invalidDelivery = validateCheckoutSubmission(
    submission({ address: "" }),
    catalog,
  );
  assert.equal(invalidDelivery.success, false);
  if (!invalidDelivery.success) assert.ok(invalidDelivery.errors.address);

  const pickup = validateCheckoutSubmission(
    submission({ fulfillment: "pickup", address: "private address" }),
    catalog,
  );
  assert.equal(pickup.success, true);
  if (pickup.success) assert.equal(pickup.checkout.address, "");
});

test("refuses demonstration products, unknown IDs, invalid quantities, and submitted prices", () => {
  for (const item of [
    { productId: products[0].id, quantity: 1 },
    { productId: "unknown-product", quantity: 1 },
    { productId: confirmedProduct.id, quantity: 0 },
    { productId: confirmedProduct.id, quantity: 100 },
    { productId: confirmedProduct.id, quantity: 1, priceInPaise: 1 },
  ]) {
    const result = validateCheckoutSubmission(submission({ items: [item] }), catalog);
    assert.equal(result.success, false);
  }
});

test("recalculates totals from trusted catalog prices", () => {
  const result = validateCheckoutSubmission(
    submission({
      subtotalInPaise: 1,
      items: [{ productId: confirmedProduct.id, quantity: 2, unitPrice: 1 }],
    }),
    catalog,
  );
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.checkout.subtotalInPaise, 25_000n);
});

test("requires a valid configured WhatsApp number and prepares an encoded, unsubmitted message", () => {
  assert.equal(isWhatsAppConfigured(undefined), false);
  assert.equal(normalizeWhatsAppNumber(" +91 (98765) 43210 "), "919876543210");

  const missingConfig = prepareWhatsAppMessage(submission(), catalog, undefined);
  assert.equal(missingConfig.success, false);
  if (!missingConfig.success) assert.equal(missingConfig.status, 503);

  const prepared = prepareWhatsAppMessage(
    submission({ fulfillment: "pickup", address: "do not include" }),
    catalog,
    "+91 98765 43210",
  );
  assert.equal(prepared.success, true);
  if (prepared.success) {
    assert.match(prepared.whatsappUrl, /^https:\/\/wa\.me\/919876543210\?text=/);
    assert.match(prepared.message, /Kaju Katli × 2 — ₹250\.00/);
    assert.match(prepared.message, /Pickup requested/);
    assert.doesNotMatch(prepared.message, /do not include/);
    assert.match(prepared.message, /not confirmed/);
  }
});

test("payment remains explicitly unavailable until a provider adapter exists", () => {
  assert.equal(getPaymentSetupStatus({} as NodeJS.ProcessEnv), "provider-not-selected");
  assert.equal(
    getPaymentSetupStatus({
      PAYMENT_PROVIDER: "chosen-provider",
      NEXT_PUBLIC_PAYMENT_PUBLIC_KEY: "public-placeholder",
      PAYMENT_SECRET_KEY: "secret-placeholder",
      PAYMENT_WEBHOOK_SECRET: "webhook-placeholder",
    } as NodeJS.ProcessEnv),
    "integration-pending",
  );
});
