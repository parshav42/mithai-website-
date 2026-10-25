export function getAvailableStock(stockOnHand: number, reservedQuantity: number) {
  if (
    !Number.isSafeInteger(stockOnHand) ||
    !Number.isSafeInteger(reservedQuantity) ||
    stockOnHand < 0 ||
    reservedQuantity < 0
  ) {
    throw new Error("Inventory quantities must be non-negative whole numbers.");
  }
  return Math.max(stockOnHand - reservedQuantity, 0);
}

export function canReserveStock(
  stockOnHand: number,
  reservedQuantity: number,
  requestedQuantity: number,
) {
  return (
    Number.isSafeInteger(requestedQuantity) &&
    requestedQuantity > 0 &&
    requestedQuantity <= getAvailableStock(stockOnHand, reservedQuantity)
  );
}
