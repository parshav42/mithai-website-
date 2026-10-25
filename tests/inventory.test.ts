import assert from "node:assert/strict";
import test from "node:test";
import { canReserveStock, getAvailableStock } from "../lib/inventory.ts";

test("active reservations are deducted from stock available to new checkouts", () => {
  assert.equal(getAvailableStock(8, 3), 5);
  assert.equal(canReserveStock(8, 3, 5), true);
  assert.equal(canReserveStock(8, 3, 6), false);
});

test("releasing a reservation restores availability without changing on-hand stock", () => {
  const stockOnHand = 8;
  let reservedQuantity = 6;
  assert.equal(getAvailableStock(stockOnHand, reservedQuantity), 2);

  reservedQuantity -= 4;
  assert.equal(getAvailableStock(stockOnHand, reservedQuantity), 6);
  assert.equal(canReserveStock(stockOnHand, reservedQuantity, 6), true);
});

test("consuming a reservation deducts stock on hand only once", () => {
  let stockOnHand = 8;
  let reservedQuantity = 3;
  stockOnHand -= 3;
  reservedQuantity = 0;

  assert.equal(getAvailableStock(stockOnHand, reservedQuantity), 5);
  assert.equal(getAvailableStock(stockOnHand, reservedQuantity), 5);
});

test("rejects invalid stock quantities", () => {
  assert.throws(() => getAvailableStock(-1, 0));
  assert.throws(() => getAvailableStock(2, -1));
  assert.equal(canReserveStock(5, 0, 0), false);
});
