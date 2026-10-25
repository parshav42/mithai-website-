import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { products, type Product } from "../data/products.ts";
import { type CheckoutSubmission } from "../lib/checkout.ts";
import {
  type NewPaymentOrder,
  type PaymentOrderStore,
  type PersistedPaymentOrder,
  type PaymentStatus,
  type VerifiedProviderEvent,
} from "../lib/payments/order-model.ts";
import { createPaymentOrder } from "../lib/payments/order-service.ts";
import {
  getPaymentSetupStatus,
  type PaymentProvider,
  type RazorpayEnvironment,
} from "../lib/payments/provider.ts";
import {
  createRazorpayPaymentProvider,
  isValidPaymentAmount,
  rupeesToPaise,
  type RazorpaySdkClient,
} from "../lib/payments/razorpay.ts";
import { processVerifiedProviderEvent, transitionPaymentState } from "../lib/payments/payment-state.ts";
import { verifyPaymentAndRecord } from "../lib/payments/verification-service.ts";

const configuredEnvironment: RazorpayEnvironment = {
  NEXT_PUBLIC_RAZORPAY_KEY_ID: "rzp_test_placeholder",
  RAZORPAY_KEY_SECRET: "test_secret_placeholder",
  RAZORPAY_WEBHOOK_SECRET: "webhook_secret_placeholder",
};
const confirmedProduct: Product = {
  ...products[0],
  id: "confirmed-kaju-katli-test",
  availability: "available",
  priceInPaise: 12_550,
  isDemonstration: false,
};
const confirmedCatalog = [confirmedProduct];
const checkoutSubmission: CheckoutSubmission = {
  customerName: "Asha Rao",
  phone: "+91 98765 43210",
  fulfillment: "pickup",
  address: "",
  instructions: "",
  items: [{ productId: confirmedProduct.id, quantity: 2 }],
};

class TestPaymentStore implements PaymentOrderStore {
  order: PersistedPaymentOrder | null = null;
  private idempotencyKey: string | null = null;
  readonly processedEvents = new Set<string>();
  readonly refunds = new Map<string, { amountInPaise: number; status: "pending" | "processed" | "failed" }>();

  async createPendingOrder(input: NewPaymentOrder) {
    if (this.order && this.idempotencyKey === input.idempotencyKey) return this.order;
    const order: PersistedPaymentOrder = {
      ...input,
      id: "database-order-test-id",
      providerOrderId: null,
      providerPaymentId: null,
      fulfillmentStatus: "new",
      refundedAmountInPaise: 0,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    this.order = order;
    this.idempotencyKey = input.idempotencyKey;
    return order;
  }

  async attachProviderOrder(orderId: string, providerOrderId: string) {
    assert.equal(orderId, this.order?.id);
    if (this.order) this.order.providerOrderId = providerOrderId;
  }

  async markProviderOrderCreationFailed() {
    if (this.order) this.order.paymentStatus = "failed";
  }

  async findByProviderOrderId(providerOrderId: string) {
    return this.order?.providerOrderId === providerOrderId ? this.order : null;
  }

  async recordVerifiedPayment(
    orderId: string,
    providerPaymentId: string,
    paymentStatus: PaymentStatus,
  ) {
    assert.equal(orderId, this.order?.id);
    if (this.order) {
      this.order.providerPaymentId = providerPaymentId;
      const next = transitionPaymentState(this.order, paymentStatus);
      this.order.paymentStatus = next.paymentStatus;
      this.order.orderStatus = next.orderStatus;
    }
  }

  async processProviderEvent(event: VerifiedProviderEvent) {
    if (
      !this.order ||
      (event.eventType === "payment" &&
        this.order.providerOrderId !== event.providerOrderId) ||
      (event.eventType === "refund" &&
        this.order.providerPaymentId !== event.providerPaymentId)
    ) {
      return "order-not-found" as const;
    }
    if (
      event.currency !== this.order.currency ||
      (event.eventType === "payment" &&
        this.order.amountInPaise !== event.amountInPaise) ||
      (event.eventType === "refund" &&
        (event.refundAmountInPaise ?? 0) > this.order.amountInPaise)
    ) {
      return "amount-mismatch" as const;
    }
    if (this.processedEvents.has(event.providerEventId)) return "duplicate" as const;

    if (event.eventType === "payment") {
      const next = transitionPaymentState(this.order, event.paymentStatus);
      this.order.orderStatus = next.orderStatus;
      this.order.paymentStatus = next.paymentStatus;
      this.order.providerPaymentId = event.providerPaymentId;
    } else if (event.providerRefundId && event.refundStatus) {
      const existing = this.refunds.get(event.providerRefundId);
      const status =
        existing?.status === "processed"
          ? "processed"
          : existing?.status === "failed" && event.refundStatus === "pending"
            ? "failed"
            : event.refundStatus;
      this.refunds.set(event.providerRefundId, {
        amountInPaise: event.refundAmountInPaise ?? 0,
        status,
      });
      this.order.refundedAmountInPaise = [...this.refunds.values()]
        .filter((refund) => refund.status === "processed")
        .reduce((total, refund) => total + refund.amountInPaise, 0);
      const pending = [...this.refunds.values()].some((refund) => refund.status === "pending");
      this.order.paymentStatus = pending
        ? "refund_pending"
        : this.order.refundedAmountInPaise >= this.order.amountInPaise
          ? "refunded"
          : this.order.refundedAmountInPaise > 0
            ? "partially_refunded"
            : "captured";
    }
    this.processedEvents.add(event.providerEventId);
    return "applied" as const;
  }
}

function sdkMock(
  overrides: Partial<RazorpaySdkClient> = {},
): { client: RazorpaySdkClient; created: Array<Record<string, unknown>> } {
  const created: Array<Record<string, unknown>> = [];
  const client: RazorpaySdkClient = {
    orders: {
      async create(input) {
        created.push(input);
        return {
          id: "order_test_123",
          amount: input.amount,
          currency: input.currency,
          status: "created",
        };
      },
    },
    payments: {
      async fetch(paymentId) {
        return {
          id: paymentId,
          order_id: "order_test_123",
          amount: 25_100,
          currency: "INR",
          status: "captured",
        };
      },
    },
    ...overrides,
  };
  return { client, created };
}

function signedPayment(
  providerOrderId: string,
  providerPaymentId: string,
  secret: string,
) {
  return createHmac("sha256", secret)
    .update(`${providerOrderId}|${providerPaymentId}`)
    .digest("hex");
}

test("payment setup fails closed for missing configuration, unconfirmed catalog, or absent storage", () => {
  assert.equal(
    getPaymentSetupStatus({}, confirmedCatalog, true),
    "credentials-missing",
  );
  assert.equal(
    getPaymentSetupStatus(configuredEnvironment, products, true),
    "catalog-unconfirmed",
  );
  assert.equal(
    getPaymentSetupStatus(configuredEnvironment, confirmedCatalog, false),
    "order-storage-unavailable",
  );
  assert.equal(
    getPaymentSetupStatus(configuredEnvironment, confirmedCatalog, true),
    "ready",
  );
});

test("missing payment configuration never persists an order or calls the mocked SDK", async () => {
  const store = new TestPaymentStore();
  let sdkWasCalled = false;
  const result = await createPaymentOrder(checkoutSubmission, {
    idempotencyKey: "00000000-0000-4000-8000-000000000001",
    environment: {},
    catalog: confirmedCatalog,
    store,
    sdkFactory: () => {
      sdkWasCalled = true;
      return sdkMock().client;
    },
  });
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.status, 503);
  assert.equal(store.order, null);
  assert.equal(sdkWasCalled, false);
});

test("converts decimal rupees to integer paise and rejects invalid amounts", () => {
  assert.equal(rupeesToPaise("249.50"), 24_950);
  assert.equal(rupeesToPaise("249"), 24_900);
  assert.equal(rupeesToPaise("0"), null);
  assert.equal(rupeesToPaise("1.001"), null);
  assert.equal(rupeesToPaise("-1"), null);
  assert.equal(isValidPaymentAmount(24_950n, "INR"), true);
  assert.equal(isValidPaymentAmount(24_950n, "USD"), false);
  assert.equal(isValidPaymentAmount(0n, "INR"), false);
});

test("rejects unconfirmed products and invalid quantities before persistence or SDK calls", async () => {
  const store = new TestPaymentStore();
  const { client, created } = sdkMock();
  const sdkFactory = () => client;

  const unconfirmed = await createPaymentOrder(
    { ...checkoutSubmission, items: [{ productId: products[0].id, quantity: 1 }] },
    {
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
      environment: configuredEnvironment,
      catalog: products,
      store,
      sdkFactory,
    },
  );
  const invalidQuantity = await createPaymentOrder(
    { ...checkoutSubmission, items: [{ productId: confirmedProduct.id, quantity: 0 }] },
    {
      idempotencyKey: "00000000-0000-4000-8000-000000000003",
      environment: configuredEnvironment,
      catalog: confirmedCatalog,
      store,
      sdkFactory,
    },
  );
  assert.equal(unconfirmed.success, false);
  assert.equal(invalidQuantity.success, false);
  assert.equal(store.order, null);
  assert.equal(created.length, 0);
});

test("calculates the saved and Razorpay order total from trusted catalog prices", async () => {
  const store = new TestPaymentStore();
  const { client, created } = sdkMock();
  const result = await createPaymentOrder(checkoutSubmission, {
    idempotencyKey: "00000000-0000-4000-8000-000000000004",
    environment: configuredEnvironment,
    catalog: confirmedCatalog,
    store,
    sdkFactory: () => client,
  });

  assert.equal(result.success, true);
  assert.equal(store.order?.amountInPaise, 25_100);
  assert.equal(store.order?.currency, "INR");
  assert.equal(store.order?.paymentStatus, "created");
  assert.equal(store.order?.providerOrderId, "order_test_123");
  assert.equal(created[0]?.amount, 25_100);
  assert.equal(created[0]?.currency, "INR");
  assert.equal(created[0]?.partial_payment, false);
});

test("repeated checkout requests with the same key reuse the saved order and provider order", async () => {
  const store = new TestPaymentStore();
  const { client, created } = sdkMock();
  const dependencies = {
    idempotencyKey: "00000000-0000-4000-8000-000000000006",
    environment: configuredEnvironment,
    catalog: confirmedCatalog,
    store,
    sdkFactory: () => client,
  };
  const first = await createPaymentOrder(checkoutSubmission, dependencies);
  const retry = await createPaymentOrder(checkoutSubmission, dependencies);
  assert.equal(first.success, true);
  assert.equal(retry.success, true);
  assert.equal(created.length, 1);
  assert.equal(store.order?.providerOrderId, "order_test_123");
});

test("does not create an external Razorpay order when persistent order storage is absent", async () => {
  let sdkWasCalled = false;
  const result = await createPaymentOrder(checkoutSubmission, {
    idempotencyKey: "00000000-0000-4000-8000-000000000005",
    environment: configuredEnvironment,
    catalog: confirmedCatalog,
    store: null,
    sdkFactory: () => {
      sdkWasCalled = true;
      return sdkMock().client;
    },
  });
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.status, 503);
  assert.equal(sdkWasCalled, false);
});

test("mocks SDK order creation and rejects invalid provider amounts before calling it", async () => {
  const { client, created } = sdkMock();
  const provider = createRazorpayPaymentProvider({
    keyId: configuredEnvironment.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
    keySecret: configuredEnvironment.RAZORPAY_KEY_SECRET!,
    sdkFactory: () => client,
  });

  await assert.rejects(
    provider.createOrder({
      amountInPaise: 1n,
      currency: "USD" as "INR",
      receipt: "receipt_test",
    }),
    /amount or currency is invalid/,
  );
  assert.equal(created.length, 0);

  const signature = signedPayment(
    "order_test_123",
    "pay_test_123",
    configuredEnvironment.RAZORPAY_KEY_SECRET!,
  );
  assert.equal(
    provider.verifyPayment({
      providerOrderId: "order_test_123",
      providerPaymentId: "pay_test_123",
      signature,
    }),
    true,
  );
  assert.equal(
    provider.verifyPayment({
      providerOrderId: "order_test_123",
      providerPaymentId: "pay_test_123",
      signature: "0".repeat(64),
    }),
    false,
  );
});

test("invalid checkout payment signatures do not verify or update saved orders", async () => {
  const store = new TestPaymentStore();
  store.order = {
    id: "db-id",
    receipt: "receipt_test",
    providerOrderId: "order_test_123",
    providerPaymentId: null,
    customerName: "Asha",
    customerPhone: "9876543210",
    fulfillment: "pickup",
    deliveryAddress: null,
    instructions: null,
    lines: [],
    amountInPaise: 25_100,
    currency: "INR",
    orderStatus: "awaiting_payment",
    fulfillmentStatus: "new",
    paymentStatus: "created",
    refundedAmountInPaise: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
  const provider: PaymentProvider = {
    async createOrder() {
      throw new Error("Not used");
    },
    verifyPayment: () => false,
    verifyWebhook: () => false,
    async fetchPayment() {
      throw new Error("An invalid signature must not fetch payments.");
    },
  };

  const result = await verifyPaymentAndRecord(
    {
      providerOrderId: "order_test_123",
      providerPaymentId: "pay_test_123",
      signature: "0".repeat(64),
    },
    { environment: configuredEnvironment, provider, store },
  );
  assert.equal(result.success, false);
  assert.equal(store.order!.paymentStatus, "created");
  assert.equal(store.order!.orderStatus, "awaiting_payment");
});

test("server-fetched captured payment remains separate from shop confirmation", async () => {
  const store = new TestPaymentStore();
  store.order = {
    id: "db-id",
    receipt: "receipt_test",
    providerOrderId: "order_test_123",
    providerPaymentId: null,
    customerName: "Asha",
    customerPhone: "9876543210",
    fulfillment: "pickup",
    deliveryAddress: null,
    instructions: null,
    lines: [],
    amountInPaise: 25_100,
    currency: "INR",
    orderStatus: "awaiting_payment",
    fulfillmentStatus: "new",
    paymentStatus: "created",
    refundedAmountInPaise: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
  const signature = signedPayment(
    "order_test_123",
    "pay_test_123",
    configuredEnvironment.RAZORPAY_KEY_SECRET!,
  );
  const provider: PaymentProvider = {
    async createOrder() {
      throw new Error("Not used");
    },
    verifyPayment: (verification) =>
      verification.signature === signature &&
      verification.providerOrderId === "order_test_123",
    verifyWebhook: () => false,
    async fetchPayment(paymentId) {
      return {
        providerOrderId: "order_test_123",
        providerPaymentId: paymentId,
        amountInPaise: 25_100,
        currency: "INR",
        status: "captured",
      };
    },
  };

  const result = await verifyPaymentAndRecord(
    {
      providerOrderId: "order_test_123",
      providerPaymentId: "pay_test_123",
      signature,
    },
    { environment: configuredEnvironment, provider, store },
  );
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.paymentStatus, "captured");
    assert.equal(result.orderStatus, "awaiting_shop_confirmation");
  }
  assert.equal(store.order!.paymentStatus, "captured");
  assert.equal(store.order!.orderStatus, "awaiting_shop_confirmation");
});

test("rejects invalid webhook signatures and verifies the exact raw body with the official SDK", () => {
  const { client } = sdkMock();
  const provider = createRazorpayPaymentProvider({
    keyId: configuredEnvironment.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
    keySecret: configuredEnvironment.RAZORPAY_KEY_SECRET!,
    sdkFactory: () => client,
  });
  const rawBody = '{"event":"payment.captured","payload":{}}';
  const signature = createHmac("sha256", "test-webhook-secret")
    .update(rawBody)
    .digest("hex");

  assert.equal(
    provider.verifyWebhook(rawBody, "0".repeat(64), "test-webhook-secret"),
    false,
  );
  assert.equal(
    provider.verifyWebhook(rawBody, "short-signature", "test-webhook-secret"),
    false,
  );
  assert.equal(
    provider.verifyWebhook(rawBody, signature, "test-webhook-secret"),
    true,
  );
});

test("deduplicates webhook events and records captured payment separately from shop confirmation", async () => {
  const store = new TestPaymentStore();
  store.order = {
    id: "db-id",
    receipt: "receipt_test",
    providerOrderId: "order_test_123",
    providerPaymentId: null,
    customerName: "Asha",
    customerPhone: "9876543210",
    fulfillment: "pickup",
    deliveryAddress: null,
    instructions: null,
    lines: [],
    amountInPaise: 25_100,
    currency: "INR",
    orderStatus: "awaiting_payment",
    fulfillmentStatus: "new",
    paymentStatus: "created",
    refundedAmountInPaise: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
  const event: VerifiedProviderEvent = {
    providerEventId: "evt_test_1",
    eventType: "payment",
    providerOrderId: "order_test_123",
    providerPaymentId: "pay_test_123",
    amountInPaise: 25_100,
    currency: "INR",
    paymentStatus: "captured",
  };
  assert.equal(await processVerifiedProviderEvent(store, event), "applied");
  assert.equal(await processVerifiedProviderEvent(store, event), "duplicate");
  assert.equal(store.order!.paymentStatus, "captured");
  assert.equal(store.order!.orderStatus, "awaiting_shop_confirmation");
  assert.notEqual(store.order!.orderStatus, "confirmed");
});

test("records partial and full refunds idempotently without treating pending refunds as completed", async () => {
  const store = new TestPaymentStore();
  store.order = {
    id: "db-id",
    receipt: "receipt_test",
    providerOrderId: "order_test_123",
    providerPaymentId: "pay_test_123",
    customerName: "Asha",
    customerPhone: "9876543210",
    fulfillment: "pickup",
    deliveryAddress: null,
    instructions: null,
    lines: [],
    amountInPaise: 25_100,
    refundedAmountInPaise: 0,
    currency: "INR",
    orderStatus: "awaiting_shop_confirmation",
    fulfillmentStatus: "new",
    paymentStatus: "captured",
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
  const partialRefund: VerifiedProviderEvent = {
    providerEventId: "evt_refund_1",
    eventType: "refund",
    providerOrderId: null,
    providerPaymentId: "pay_test_123",
    amountInPaise: 5_000,
    currency: "INR",
    paymentStatus: "refund_pending",
    providerRefundId: "rfnd_1",
    refundAmountInPaise: 5_000,
    refundStatus: "pending",
  };
  assert.equal(await processVerifiedProviderEvent(store, partialRefund), "applied");
  assert.equal(store.order!.paymentStatus, "refund_pending");
  assert.equal(store.order!.refundedAmountInPaise, 0);
  assert.equal(
    await processVerifiedProviderEvent(store, {
      ...partialRefund,
      providerEventId: "evt_refund_2",
      refundStatus: "processed",
    }),
    "applied",
  );
  assert.equal(store.order!.paymentStatus, "partially_refunded");
  assert.equal(store.order!.refundedAmountInPaise, 5_000);
  assert.equal(
    await processVerifiedProviderEvent(store, {
      ...partialRefund,
      providerEventId: "evt_refund_3",
      refundStatus: "processed",
    }),
    "applied",
  );
  assert.equal(store.order!.refundedAmountInPaise, 5_000);
  assert.equal(
    await processVerifiedProviderEvent(store, {
      ...partialRefund,
      providerEventId: "evt_refund_4",
      providerRefundId: "rfnd_2",
      amountInPaise: 20_100,
      refundAmountInPaise: 20_100,
      refundStatus: "processed",
    }),
    "applied",
  );
  assert.equal(store.order!.paymentStatus, "refunded");
  assert.equal(store.order!.refundedAmountInPaise, 25_100);
});

test("handles payment failure, cancellation, and late capture without redirect-based confirmation", () => {
  const failed = transitionPaymentState(
    { orderStatus: "awaiting_payment", paymentStatus: "pending" },
    "failed",
  );
  assert.equal(failed.paymentStatus, "failed");
  assert.equal(failed.orderStatus, "awaiting_payment");

  const cancelled = transitionPaymentState(
    { orderStatus: "awaiting_payment", paymentStatus: "created" },
    "cancelled",
  );
  assert.equal(cancelled.paymentStatus, "cancelled");
  assert.equal(cancelled.orderStatus, "cancelled");

  const lateCapture = transitionPaymentState(cancelled, "captured");
  assert.equal(lateCapture.paymentStatus, "captured");
  assert.equal(lateCapture.orderStatus, "payment_received_review_required");

  const paid = transitionPaymentState(
    { orderStatus: "awaiting_shop_confirmation", paymentStatus: "captured" },
    "failed",
  );
  assert.equal(paid.paymentStatus, "captured");
  assert.equal(paid.orderStatus, "awaiting_shop_confirmation");
});
