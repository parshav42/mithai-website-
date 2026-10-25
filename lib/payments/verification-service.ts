import "server-only";
import type { PaymentOrderStore } from "./order-model.ts";
import type {
  PaymentProvider,
  PaymentVerification,
  RazorpayEnvironment,
} from "./provider.ts";

export type VerifyPaymentResult =
  | {
      success: true;
      paymentStatus: "captured" | "authorized" | "pending" | "failed";
      orderStatus: "awaiting_shop_confirmation" | "awaiting_payment";
    }
  | { success: false; status: 400 | 404 | 503; error: string };

export async function verifyPaymentAndRecord(
  verification: PaymentVerification,
  dependencies: {
    environment: RazorpayEnvironment;
    provider: PaymentProvider;
    store: PaymentOrderStore | null;
  },
): Promise<VerifyPaymentResult> {
  const { environment, provider, store } = dependencies;
  if (!environment.RAZORPAY_KEY_SECRET || !store) {
    return {
      success: false,
      status: 503,
      error: "Payment verification is unavailable. No order confirmation was recorded.",
    };
  }
  if (!provider.verifyPayment(verification)) {
    return {
      success: false,
      status: 400,
      error: "Razorpay payment signature is invalid.",
    };
  }

  const order = await store.findByProviderOrderId(verification.providerOrderId);
  if (!order) {
    return {
      success: false,
      status: 404,
      error: "The payment order could not be found.",
    };
  }

  const payment = await provider.fetchPayment(verification.providerPaymentId);
  if (
    payment.providerPaymentId !== verification.providerPaymentId ||
    payment.providerOrderId !== order.providerOrderId ||
    payment.amountInPaise !== order.amountInPaise ||
    payment.currency !== order.currency
  ) {
    return {
      success: false,
      status: 400,
      error: "Razorpay payment details do not match the saved order.",
    };
  }

  const paymentStatus =
    payment.status === "captured"
      ? "captured"
      : payment.status === "authorized"
        ? "authorized"
        : payment.status === "failed"
          ? "failed"
          : "pending";
  await store.recordVerifiedPayment(order.id, payment.providerPaymentId, paymentStatus);

  return {
    success: true,
    paymentStatus,
    orderStatus:
      paymentStatus === "captured"
        ? "awaiting_shop_confirmation"
        : "awaiting_payment",
  };
}
