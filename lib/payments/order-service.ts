import { randomUUID } from "node:crypto";
import {
  validateCheckoutSubmission,
} from "../checkout.ts";
import type { Product } from "../../data/products.ts";
import type { PaymentOrderStore } from "./order-model.ts";
import { InventoryConflictError } from "./order-model.ts";
import {
  isValidPaymentAmount,
  type RazorpaySdkFactory,
} from "./razorpay.ts";
import { createRazorpayPaymentProvider } from "./razorpay.ts";
import type { RazorpayEnvironment } from "./provider.ts";

export type CreatePaymentOrderResult =
  | {
      success: true;
      providerOrderId: string;
      amountInPaise: number;
      currency: "INR";
      keyId: string;
    }
  | { success: false; status: 400 | 409 | 422 | 503 | 502; error: string };

export async function createPaymentOrder(
  submission: unknown,
  dependencies: {
    idempotencyKey: string;
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
  if (!/^[0-9a-f-]{36}$/i.test(dependencies.idempotencyKey)) {
    return { success: false, status: 400, error: "A valid checkout request key is required." };
  }
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
        packageSize: product.packageSize ?? "Standard",
        quantity,
        unitPriceInPaise: product.priceInPaise,
      })),
      amountInPaise: Number(amountInPaise),
      currency: "INR",
      orderStatus: "awaiting_payment",
      paymentStatus: "created",
      idempotencyKey: dependencies.idempotencyKey,
    });
    orderId = savedOrder.id;
    if (
      savedOrder.amountInPaise !== Number(amountInPaise) ||
      savedOrder.currency !== "INR"
    ) {
      await store.markProviderOrderCreationFailed(savedOrder.id);
      return {
        success: false,
        status: 502,
        error: "The saved order does not match the validated checkout. No payment was started.",
      };
    }

    if (savedOrder.providerOrderId) {
      return {
        success: true,
        providerOrderId: savedOrder.providerOrderId,
        amountInPaise: savedOrder.amountInPaise,
        currency: "INR",
        keyId: environment.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      };
    }

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
  } catch (error) {
    if (error instanceof InventoryConflictError) {
      return { success: false, status: 409, error: error.message };
    }
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
