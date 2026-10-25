export type PaymentCurrency = "INR";

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

export interface PaymentProvider {
  createOrder(request: PaymentOrderRequest): Promise<PaymentOrder>;
  verifyPayment(verification: PaymentVerification): Promise<boolean>;
}

export type PaymentSetupStatus = "provider-not-selected" | "credentials-missing";

export function getPaymentSetupStatus(
  environment: NodeJS.ProcessEnv = process.env,
): PaymentSetupStatus {
  if (!environment.PAYMENT_PROVIDER) return "provider-not-selected";
  if (
    !environment.NEXT_PUBLIC_PAYMENT_PUBLIC_KEY ||
    !environment.PAYMENT_SECRET_KEY ||
    !environment.PAYMENT_WEBHOOK_SECRET
  ) {
    return "credentials-missing";
  }
  return "provider-not-selected";
}
