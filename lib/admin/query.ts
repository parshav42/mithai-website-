import type { FulfillmentStatus, OrderStatus, PaymentStatus } from "../payments/order-model.ts";
import {
  FULFILLMENT_STATUSES,
  PAYMENT_STATUSES,
} from "./order-status.ts";
import { InvalidDateRangeError, parseCustomDateRange } from "./date-range.ts";

export type NormalizedAdminOrderFilters = {
  search?: string;
  from?: string;
  to?: string;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  orderStatus?: OrderStatus;
  page: number;
};

export function parseAdminOrderFilters(query: URLSearchParams):
  | { success: true; filters: NormalizedAdminOrderFilters }
  | { success: false; error: string } {
  const paymentStatus = query.get("paymentStatus") ?? "";
  const fulfillmentStatus = query.get("fulfillmentStatus") ?? "";
  const orderStatus = query.get("orderStatus") ?? "";
  const from = query.get("from") ?? "";
  const to = query.get("to") ?? "";
  if (paymentStatus && !PAYMENT_STATUSES.includes(paymentStatus as PaymentStatus)) {
    return { success: false, error: "Choose a supported payment status." };
  }
  if (
    fulfillmentStatus &&
    !FULFILLMENT_STATUSES.includes(fulfillmentStatus as FulfillmentStatus)
  ) {
    return { success: false, error: "Choose a supported fulfillment status." };
  }
  if (orderStatus && !["awaiting_payment", "awaiting_shop_confirmation", "confirmed", "cancelled", "payment_received_review_required"].includes(orderStatus)) {
    return { success: false, error: "Choose a supported order status." };
  }
  if (Boolean(from) !== Boolean(to)) {
    return { success: false, error: "Provide both a start date and an end date." };
  }
  if (from && to) {
    try {
      parseCustomDateRange(from, to);
    } catch (error) {
      if (error instanceof InvalidDateRangeError) {
        return { success: false, error: error.message };
      }
      throw error;
    }
  }
  const pageValue = Number(query.get("page") ?? "1");
  return {
    success: true,
    filters: {
      search: query.get("search")?.trim().slice(0, 100) || undefined,
      from: from || undefined,
      to: to || undefined,
      paymentStatus: (paymentStatus || undefined) as PaymentStatus | undefined,
      fulfillmentStatus: (fulfillmentStatus || undefined) as FulfillmentStatus | undefined,
      orderStatus: (orderStatus || undefined) as OrderStatus | undefined,
      page: Number.isInteger(pageValue) && pageValue > 0 ? Math.min(pageValue, 100_000) : 1,
    },
  };
}
