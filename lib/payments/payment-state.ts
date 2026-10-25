import type {
  OrderStatus,
  PaymentStatus,
  PaymentOrderStore,
  ProcessProviderEventResult,
  VerifiedProviderEvent,
} from "./order-model.ts";

export type PaymentTransition = {
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
};

export function transitionPaymentState(
  current: PaymentTransition,
  nextPaymentStatus: PaymentStatus,
): PaymentTransition {
  if (current.paymentStatus === "refunded" && nextPaymentStatus !== "refunded") {
    return current;
  }
  if (
    (current.paymentStatus === "refund_pending" ||
      current.paymentStatus === "partially_refunded") &&
    !["refund_pending", "partially_refunded", "refunded"].includes(nextPaymentStatus)
  ) {
    return current;
  }
  if (current.paymentStatus === "captured" && nextPaymentStatus !== "captured") {
    return current;
  }

  if (nextPaymentStatus === "refunded") {
    return {
      orderStatus:
        current.orderStatus === "confirmed"
          ? "confirmed"
          : "payment_received_review_required",
      paymentStatus: "refunded",
    };
  }

  if (nextPaymentStatus === "captured") {
    return {
      orderStatus:
        current.orderStatus === "cancelled"
          ? "payment_received_review_required"
          : current.orderStatus === "confirmed"
            ? "confirmed"
            : "awaiting_shop_confirmation",
      paymentStatus: "captured",
    };
  }

  if (
    nextPaymentStatus === "refund_pending" ||
    nextPaymentStatus === "partially_refunded"
  ) {
    return { ...current, paymentStatus: nextPaymentStatus };
  }

  if (nextPaymentStatus === "failed") {
    return {
      ...current,
      orderStatus: current.orderStatus === "confirmed" ? "confirmed" : "awaiting_payment",
      paymentStatus: "failed",
    };
  }

  if (nextPaymentStatus === "cancelled") {
    return current.orderStatus === "confirmed"
      ? current
      : { orderStatus: "cancelled", paymentStatus: "cancelled" };
  }

  if (current.paymentStatus === "failed" || current.paymentStatus === "cancelled") {
    return current;
  }

  return { ...current, paymentStatus: nextPaymentStatus };
}

export async function processVerifiedProviderEvent(
  store: PaymentOrderStore,
  event: VerifiedProviderEvent,
): Promise<ProcessProviderEventResult> {
  if (
    !event.providerEventId ||
    !event.providerPaymentId ||
    !Number.isSafeInteger(event.amountInPaise) ||
    event.amountInPaise <= 0 ||
    event.currency !== "INR" ||
    (event.eventType === "payment" && !event.providerOrderId) ||
    (event.eventType === "refund" &&
      (!event.providerRefundId ||
        !Number.isSafeInteger(event.refundAmountInPaise) ||
        !event.refundStatus))
  ) {
    throw new Error("Verified Razorpay event has invalid payment fields.");
  }
  return store.processProviderEvent(event);
}
