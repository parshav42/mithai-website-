import assert from "node:assert/strict";
import test from "node:test";
import { isPurchasable, products, type Product } from "../data/products.ts";
import {
  calculateSubtotal,
  countCartItems,
  MAX_CART_QUANTITY,
  normalizeCart,
  updateCart,
} from "../lib/cart.ts";

const pricedProduct: Product = {
  ...products[0],
  id: "test-priced-kaju-katli",
  availability: "available",
  priceInPaise: 12_500,
  isDemonstration: false,
};
const catalog = [...products, pricedProduct];

test("adds, increments, decrements, and removes a configured product", () => {
  const added = updateCart({}, { type: "add", productId: pricedProduct.id }, catalog);
  assert.equal(added[pricedProduct.id], 1);

  const incremented = updateCart(added, { type: "add", productId: pricedProduct.id }, catalog);
  assert.equal(incremented[pricedProduct.id], 2);

  const decremented = updateCart(
    incremented,
    { type: "set-quantity", productId: pricedProduct.id, quantity: 1 },
    catalog,
  );
  assert.equal(decremented[pricedProduct.id], 1);

  const removed = updateCart(decremented, { type: "remove", productId: pricedProduct.id }, catalog);
  assert.equal(removed[pricedProduct.id], undefined);
});

test("calculates subtotals in integer paise", () => {
  const items = { [pricedProduct.id]: 3 };
  assert.equal(calculateSubtotal(items, catalog), 37_500n);
  assert.equal(countCartItems(items), 3);
});

test("refuses unconfirmed products and invalid quantities", () => {
  assert.deepEqual(
    updateCart({}, { type: "add", productId: products[0].id }, catalog),
    {},
  );
  assert.deepEqual(
    updateCart(
      { [pricedProduct.id]: 1 },
      { type: "set-quantity", productId: pricedProduct.id, quantity: 0 },
      catalog,
    ),
    { [pricedProduct.id]: 1 },
  );
  assert.deepEqual(
    updateCart(
      {},
      { type: "add", productId: products[0].id },
      [
        ...catalog,
        {
          ...products[0],
          id: "misconfigured-demo",
          availability: "available",
          priceInPaise: 100,
        },
      ],
    ),
    {},
  );
});

test("requires an explicit non-demo availability and positive integer price", () => {
  assert.equal(isPurchasable(pricedProduct), true);
  assert.equal(
    isPurchasable({ ...pricedProduct, availability: "unavailable" }),
    false,
  );
  assert.equal(isPurchasable({ ...pricedProduct, priceInPaise: 0 }), false);
  assert.equal(isPurchasable({ ...pricedProduct, priceInPaise: 12.5 }), false);
  assert.equal(isPurchasable({ ...pricedProduct, priceInPaise: Number.MAX_SAFE_INTEGER + 1 }), false);
});

test("caps quantities and normalizes locally stored cart data", () => {
  const maxed = updateCart(
    { [pricedProduct.id]: MAX_CART_QUANTITY },
    { type: "add", productId: pricedProduct.id },
    catalog,
  );
  assert.equal(maxed[pricedProduct.id], MAX_CART_QUANTITY);

  assert.deepEqual(
    normalizeCart(
      {
        [pricedProduct.id]: 2,
        [products[0].id]: 4,
        unknown: 1,
        fractional: 1.2,
        excessive: MAX_CART_QUANTITY + 1,
      },
      catalog,
    ),
    { [pricedProduct.id]: 2, [products[0].id]: 4 },
  );
});

test("keeps subtotal arithmetic exact for large configured totals", () => {
  const highPrice: Product = {
    ...pricedProduct,
    id: "test-high-price",
    priceInPaise: Number.MAX_SAFE_INTEGER,
  };
  assert.equal(
    calculateSubtotal({ [highPrice.id]: MAX_CART_QUANTITY }, [highPrice]),
    BigInt(Number.MAX_SAFE_INTEGER) * BigInt(MAX_CART_QUANTITY),
  );
});
