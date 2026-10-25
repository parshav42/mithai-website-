import { randomUUID } from "node:crypto";
import {
  validateCheckoutSubmission,
} from "@/lib/checkout";
import type { Product } from "@/data/products";
import type { PaymentOrderStore } from "@/lib/payments/order-model";
import {
  isValidPaymentAmount,
  type RazorpaySdkFactory,
} from "@/lib/payments/razorpay";
import { createRazorpayPaymentProvider } from "@/lib/payments/razorpay";
import type { RazorpayEnvironment } from "@/lib/payments/provider";

export type CreatePaymentOrderResult =
  | {
      success: true;
      providerOrderId: string;
      amountInPaise: number;
      currency: "INR";
      keyId: string;
    }
  | { success: false; status: 400 | 422 | 503 | 502; error: string };

export async function createPaymentOrder(
  submission: unknown,
  dependencies: {
    environment: RazorpayEnvironment;
    catalog: readonly Product[];
    store: PaymentOrderStore | null;
    sdkFactory?: RazorpaySdkFactory;
  },
): Promise<CreatePaymentOrderResult> {
  const validation = validateCheckoutSubmission(submission, dependencies.catalog);
  if (!validation.success) {
    return {
      success: false,
      status: 422,
      error: "The cart or checkout details are invalid or unconfirmed.",
    };
  }

  const { environment, store } = dependencies;
  if (
    !environment.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
    !environment.RAZORPAY_KEY_SECRET ||
    !environment.RAZORPAY_WEBHOOK_SECRET
  ) {
    return {
      success: false,
      status: 503,
      error: "Razorpay is not configured. Payment has not been started.",
    };
  }
  if (!store) {
    return {
      success: false,
      status: 503,
      error: "Online payments are unavailable until persistent order storage is configured.",
    };
  }

  const amountInPaise = validation.checkout.subtotalInPaise;
  if (!isValidPaymentAmount(amountInPaise, "INR")) {
    return {
      success: false,
      status: 400,
      error: "The calculated payment amount or currency is invalid.",
    };
  }

  let orderId: string | null = null;
  try {
    const receipt = `mithai_${randomUUID().replaceAll("-", "")}`;
    const savedOrder = await store.createPendingOrder({
      receipt,
      customerName: validation.checkout.customerName,
      customerPhone: validation.checkout.phone,
      fulfillment: validation.checkout.fulfillment,
      deliveryAddress: validation.checkout.address || null,
      instructions: validation.checkout.instructions || null,
      lines: validation.checkout.lines.map(({ product, quantity }) => ({
        productId: product.id,
        productName: product.name,
        quantity,
        unitPriceInPaise: product.priceInPaise,
      })),
      amountInPaise: Number(amountInPaise),
      currency: "INR",
      orderStatus: "awaiting_payment",
      paymentStatus: "created",
    });
    orderId = savedOrder.id;

    const provider = createRazorpayPaymentProvider({
      keyId: environment.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      keySecret: environment.RAZORPAY_KEY_SECRET,
      sdkFactory: dependencies.sdkFactory,
    });
    const providerOrder = await provider.createOrder({
      amountInPaise,
      currency: "INR",
      receipt: savedOrder.receipt,
    });
    await store.attachProviderOrder(savedOrder.id, providerOrder.providerOrderId);

    return {
      success: true,
      providerOrderId: providerOrder.providerOrderId,
      amountInPaise: providerOrder.amountInPaise,
      currency: providerOrder.currency,
      keyId: environment.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    };
  } catch {
    if (orderId) {
      await store.markProviderOrderCreationFailed(orderId);
    }
    return {
      success: false,
      status: 502,
      error: "A secure payment order could not be prepared. No payment was started.",
    };
  }
}
