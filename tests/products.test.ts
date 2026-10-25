import assert from "node:assert/strict";
import test from "node:test";
import {
  validateProductImage,
  validateProductImageContent,
  validateProductInput,
} from "../lib/product-validation.ts";

const validInput = {
  name: "Kaju Katli",
  description: "Rich cashew mithai.",
  imageUrl: "/images/mithai-assortment.jpg",
  category: "Kaju Katli",
  packageSize: "500 g",
  priceRupees: "450.00",
  originalPriceRupees: "500.00",
  stockQuantity: 12,
  isAvailable: true,
  isFeatured: true,
};

test("validates and converts product prices into integer paise", () => {
  const result = validateProductInput(validInput);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.value.priceInPaise, 45_000);
    assert.equal(result.value.originalPriceInPaise, 50_000);
    assert.equal(result.value.stockQuantity, 12);
  }
});

test("accepts zero stock and unavailable products without making them purchasable", () => {
  const result = validateProductInput({
    ...validInput,
    stockQuantity: 0,
    isAvailable: false,
    originalPriceRupees: "",
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.value.stockQuantity, 0);
    assert.equal(result.value.isAvailable, false);
    assert.equal(result.value.originalPriceInPaise, null);
  }
});

test("rejects invalid prices, discount values, package sizes, and stock", () => {
  for (const changes of [
    { priceRupees: "450.001" },
    { priceRupees: "1e2" },
    { originalPriceRupees: "400" },
    { packageSize: "!!!" },
    { stockQuantity: -1 },
    { stockQuantity: 1.5 },
  ]) {
    assert.equal(validateProductInput({ ...validInput, ...changes }).success, false);
  }
});

test("allows only a default image or an HTTPS Vercel Blob product URL", () => {
  assert.equal(validateProductInput(validInput).success, true);
  assert.equal(
    validateProductInput({
      ...validInput,
      imageUrl: "https://store.public.blob.vercel-storage.com/product.webp",
    }).success,
    true,
  );
  assert.equal(
    validateProductInput({ ...validInput, imageUrl: "http://example.test/image.jpg" }).success,
    false,
  );
  assert.equal(
    validateProductInput({ ...validInput, imageUrl: "https://example.test/image.jpg" }).success,
    false,
  );
});

test("validates supported image type, size, and file signature", () => {
  assert.equal(validateProductImage({ type: "image/jpeg", size: 10, name: "sweet.jpg" }).success, true);
  assert.equal(validateProductImage({ type: "image/svg+xml", size: 10, name: "sweet.svg" }).success, false);
  assert.equal(validateProductImage({ type: "image/png", size: 4 * 1024 * 1024 + 1, name: "large.png" }).success, false);
  assert.equal(
    validateProductImageContent("image/png", new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])),
    true,
  );
  assert.equal(
    validateProductImageContent("image/png", new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])),
    false,
  );
});
