import type {
  FulfillmentStatus,
  OrderStatus,
  PaymentStatus,
} from "../payments/order-model.ts";

export type AdminOrderStatus = "confirmed" | "cancelled";
export const ORDER_STATUSES: readonly OrderStatus[] = [
  "awaiting_payment", "awaiting_shop_confirmation", "confirmed", "cancelled",
  "payment_received_review_required",
];

export const FULFILLMENT_STATUSES: readonly FulfillmentStatus[] = [
  "new",
  "preparing",
  "ready_for_dispatch",
  "out_for_delivery",
  "delivered",
  "picked_up",
  "cancelled",
];

export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "created",
  "pending",
  "authorized",
  "captured",
  "failed",
  "cancelled",
  "refund_pending",
  "partially_refunded",
  "refunded",
];

const TRANSITIONS: Record<FulfillmentStatus, readonly FulfillmentStatus[]> = {
  new: ["preparing", "cancelled"],
  preparing: ["ready_for_dispatch", "cancelled"],
  ready_for_dispatch: ["out_for_delivery", "delivered", "picked_up", "cancelled"],
  out_for_delivery: ["delivered"],
  delivered: [],
  picked_up: [],
  cancelled: [],
};

export function validateFulfillmentChange(
  current: FulfillmentStatus,
  next: FulfillmentStatus,
  payment: PaymentStatus,
): "valid" | "invalid-transition" | "payment-not-eligible" {
  if (!TRANSITIONS[current].includes(next)) return "invalid-transition";
  if (!["captured", "partially_refunded"].includes(payment)) {
    return "payment-not-eligible";
  }
  return "valid";
}

export function validateOrderChange(
  current: OrderStatus,
  next: AdminOrderStatus,
  payment: PaymentStatus,
): "valid" | "invalid-transition" | "payment-not-eligible" {
  if (next === "confirmed") {
    if (current !== "awaiting_shop_confirmation") return "invalid-transition";
    if (!["captured", "partially_refunded"].includes(payment)) {
      return "payment-not-eligible";
    }
    return "valid";
  }
  if (!["awaiting_shop_confirmation", "confirmed", "awaiting_payment"].includes(current)) {
    return "invalid-transition";
  }
  if (
    current === "awaiting_payment" &&
    ["captured", "refund_pending", "partially_refunded", "refunded"].includes(payment)
  ) {
    return "payment-not-eligible";
  }
  return "valid";
}

export function getPagination(pageValue: number, pageSize = 20) {
  const page =
    Number.isInteger(pageValue) && pageValue > 0
      ? Math.min(pageValue, 100_000)
      : 1;
  return { page, pageSize, offset: (page - 1) * pageSize };
}
