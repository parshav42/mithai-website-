import { isPurchasable, type Product } from "../../data/products.ts";

export type PaymentCurrency = "INR";
export type PaymentSetupStatus =
  | "credentials-missing"
  | "catalog-unconfirmed"
  | "order-storage-unavailable"
  | "ready";

export type PaymentOrderRequest = {
  amountInPaise: bigint;
  currency: PaymentCurrency;
  receipt: string;
};

export type PaymentOrder = {
  providerOrderId: string;
  amountInPaise: number;
  currency: PaymentCurrency;
};

export type PaymentVerification = {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
};

export type ProviderPayment = {
  providerOrderId: string | null;
  providerPaymentId: string;
  amountInPaise: number;
  currency: string;
  status: string;
};

export interface PaymentProvider {
  createOrder(request: PaymentOrderRequest): Promise<PaymentOrder>;
  verifyPayment(verification: PaymentVerification): boolean;
  verifyWebhook(rawBody: string, signature: string, secret: string): boolean;
  fetchPayment(providerPaymentId: string): Promise<ProviderPayment>;
}

export type RazorpayEnvironment = {
  NEXT_PUBLIC_RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
};

export function getRazorpayEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): RazorpayEnvironment {
  return {
    NEXT_PUBLIC_RAZORPAY_KEY_ID: environment.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: environment.RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: environment.RAZORPAY_WEBHOOK_SECRET,
  };
}

export function getPaymentSetupStatus(
  environment: RazorpayEnvironment = getRazorpayEnvironment(),
  catalog: readonly Product[],
  orderStorageAvailable: boolean,
): PaymentSetupStatus {
  if (
    !environment.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
    !environment.RAZORPAY_KEY_SECRET ||
    !environment.RAZORPAY_WEBHOOK_SECRET
  ) {
    return "credentials-missing";
  }
  if (!catalog.some(isPurchasable)) return "catalog-unconfirmed";
  if (!orderStorageAvailable) return "order-storage-unavailable";
  return "ready";
}
