import type { FulfillmentMethod } from "../checkout.ts";
import type { PaymentCurrency } from "./provider.ts";

export type OrderStatus =
  | "awaiting_payment"
  | "awaiting_shop_confirmation"
  | "confirmed"
  | "cancelled"
  | "payment_received_review_required";

export type PaymentStatus =
  | "created"
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "cancelled"
  | "refunded";

export type PaymentOrderLine = {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceInPaise: number;
};

export type PersistedPaymentOrder = {
  id: string;
  receipt: string;
  providerOrderId: string | null;
  customerName: string;
  customerPhone: string;
  fulfillment: FulfillmentMethod;
  deliveryAddress: string | null;
  instructions: string | null;
  lines: PaymentOrderLine[];
  amountInPaise: number;
  currency: PaymentCurrency;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  providerPaymentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewPaymentOrder = Omit<
  PersistedPaymentOrder,
  | "id"
  | "providerOrderId"
  | "orderStatus"
  | "paymentStatus"
  | "providerPaymentId"
  | "createdAt"
  | "updatedAt"
> & {
  orderStatus: "awaiting_payment";
  paymentStatus: "created";
};

export type VerifiedProviderEvent = {
  providerEventId: string;
  providerOrderId: string;
  providerPaymentId: string;
  amountInPaise: number;
  currency: string;
  paymentStatus: PaymentStatus;
};

export type ProcessProviderEventResult =
  | "applied"
  | "duplicate"
  | "order-not-found"
  | "amount-mismatch";

export interface PaymentOrderStore {
  createPendingOrder(input: NewPaymentOrder): Promise<PersistedPaymentOrder>;
  attachProviderOrder(orderId: string, providerOrderId: string): Promise<void>;
  markProviderOrderCreationFailed(orderId: string): Promise<void>;
  findByProviderOrderId(providerOrderId: string): Promise<PersistedPaymentOrder | null>;
  /**
   * Must apply the same non-regressive payment transition as webhook updates.
   */
  recordVerifiedPayment(
    orderId: string,
    providerPaymentId: string,
    paymentStatus: PaymentStatus,
  ): Promise<void>;
  /**
   * Must atomically enforce unique providerEventId, match order/amount/currency,
   * and apply the payment transition so retries and concurrent deliveries are safe.
   */
  processProviderEvent(
    event: VerifiedProviderEvent,
  ): Promise<ProcessProviderEventResult>;
}
