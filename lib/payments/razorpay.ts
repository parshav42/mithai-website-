import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import type {
  PaymentOrder,
  PaymentOrderRequest,
  PaymentProvider,
  PaymentVerification,
  ProviderPayment,
} from "./provider.ts";

type RazorpayOrderResponse = {
  id: string;
  amount: number | string;
  currency: string;
  status: string;
};

type RazorpayPaymentResponse = {
  id: string;
  order_id: string | null;
  amount: number | string;
  currency: string;
  status: string;
};

export type RazorpaySdkClient = {
  orders: {
    create(input: {
      amount: number;
      currency: "INR";
      receipt: string;
      partial_payment: false;
    }): Promise<RazorpayOrderResponse>;
  };
  payments: {
    fetch(paymentId: string): Promise<RazorpayPaymentResponse>;
  };
};

export type RazorpaySdkFactory = (
  credentials: { keyId: string; keySecret: string },
) => RazorpaySdkClient;

export type RazorpayPaymentProviderOptions = {
  keyId: string;
  keySecret: string;
  sdkFactory?: RazorpaySdkFactory;
  verifyWebhookSignature?: (
    rawBody: string,
    signature: string,
    secret: string,
  ) => boolean;
};

function createSdkClient({
  keyId,
  keySecret,
}: {
  keyId: string;
  keySecret: string;
}): RazorpaySdkClient {
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

export function isValidPaymentAmount(
  amountInPaise: bigint,
  currency: string,
): boolean {
  return (
    currency === "INR" &&
    amountInPaise > 0n &&
    amountInPaise <= BigInt(Number.MAX_SAFE_INTEGER)
  );
}

export function rupeesToPaise(value: string): number | null {
  if (value.length > 18) return null;
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;

  const rupees = BigInt(match[1]);
  const paise = BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  const total = rupees * 100n + paise;
  return total > 0n && total <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(total)
    : null;
}

export function verifyPaymentSignature(
  verification: PaymentVerification,
  secret: string,
): boolean {
  if (
    !verification.providerOrderId ||
    !verification.providerPaymentId ||
    !/^[a-f\d]{64}$/i.test(verification.signature)
  ) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${verification.providerOrderId}|${verification.providerPaymentId}`)
    .digest();
  const supplied = Buffer.from(verification.signature, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
  verifier: (rawBody: string, signature: string, secret: string) => boolean =
    Razorpay.validateWebhookSignature,
): boolean {
  return (
    /^[a-f\d]{64}$/i.test(signature) &&
    Boolean(secret) &&
    verifier(rawBody, signature, secret)
  );
}

export function createRazorpayPaymentProvider(
  options: RazorpayPaymentProviderOptions,
): PaymentProvider {
  const client = (options.sdkFactory ?? createSdkClient)({
    keyId: options.keyId,
    keySecret: options.keySecret,
  });

  return {
    async createOrder(request: PaymentOrderRequest): Promise<PaymentOrder> {
      if (!isValidPaymentAmount(request.amountInPaise, request.currency)) {
        throw new Error("Payment amount or currency is invalid.");
      }
      if (!request.receipt || request.receipt.length > 40) {
        throw new Error("Payment receipt is invalid.");
      }

      const response = await client.orders.create({
        amount: Number(request.amountInPaise),
        currency: request.currency,
        receipt: request.receipt,
        partial_payment: false,
      });
      const responseAmount =
        typeof response.amount === "number"
          ? response.amount
          : /^\d+$/.test(response.amount)
            ? Number(response.amount)
            : NaN;
      if (
        typeof response.id !== "string" ||
        !Number.isSafeInteger(responseAmount) ||
        responseAmount !== Number(request.amountInPaise) ||
        response.currency !== request.currency ||
        response.status !== "created"
      ) {
        throw new Error("Razorpay returned an invalid order response.");
      }

      return {
        providerOrderId: response.id,
        amountInPaise: responseAmount,
        currency: request.currency,
      };
    },

    verifyPayment(verification) {
      return verifyPaymentSignature(verification, options.keySecret);
    },

    verifyWebhook(rawBody, signature, secret) {
      return verifyRazorpayWebhookSignature(
        rawBody,
        signature,
        secret,
        options.verifyWebhookSignature,
      );
    },

    async fetchPayment(providerPaymentId): Promise<ProviderPayment> {
      const payment = await client.payments.fetch(providerPaymentId);
      const amountInPaise =
        typeof payment.amount === "number"
          ? payment.amount
          : /^\d+$/.test(payment.amount)
            ? Number(payment.amount)
            : NaN;
      return {
        providerOrderId: payment.order_id,
        providerPaymentId: payment.id,
        amountInPaise,
        currency: payment.currency,
        status: payment.status,
      };
    },
  };
}
