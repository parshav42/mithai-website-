import { verifyRazorpayWebhookSignature } from "@/lib/payments/razorpay";
import { getPaymentOrderStore } from "@/lib/payments/order-store";
import { processVerifiedProviderEvent } from "@/lib/payments/payment-state";
import {
  getMaximumWebhookRequestBytes,
  readRequestText,
} from "@/lib/payments/request-body";
import type { PaymentStatus } from "@/lib/payments/order-model";

type RazorpayWebhookEvent = {
  event: string;
  payload?: {
    payment?: {
      entity?: {
        id?: unknown;
        order_id?: unknown;
        amount?: unknown;
        currency?: unknown;
        status?: unknown;
      };
    };
  };
};

function parsePaymentEvent(value: unknown): Omit<
  Parameters<typeof processVerifiedProviderEvent>[1],
  "providerEventId"
> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const event = value as RazorpayWebhookEvent;
  const entity = event.payload?.payment?.entity;
  if (!entity) return null;

  const paymentStatus: PaymentStatus | null =
    event.event === "payment.captured"
      ? "captured"
      : event.event === "payment.failed"
        ? "failed"
        : event.event === "payment.authorized"
          ? "authorized"
          : null;
  if (
    !paymentStatus ||
    typeof entity.id !== "string" ||
    typeof entity.order_id !== "string" ||
    typeof entity.amount !== "number" ||
    typeof entity.currency !== "string"
  ) {
    return null;
  }

  return {
    providerOrderId: entity.order_id,
    providerPaymentId: entity.id,
    amountInPaise: entity.amount,
    currency: entity.currency,
    paymentStatus,
  };
}

export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = request.headers.get("x-razorpay-signature");
  const providerEventId = request.headers.get("x-razorpay-event-id");
  if (!secret || !signature || !providerEventId) {
    return Response.json(
      { error: "Razorpay webhook configuration or headers are missing." },
      { status: 400 },
    );
  }
  if (providerEventId.length > 200) {
    return Response.json({ error: "Razorpay event ID is invalid." }, { status: 400 });
  }

  const parsedBody = await readRequestText(
    request,
    getMaximumWebhookRequestBytes(),
  );
  if (!parsedBody.success) {
    return Response.json(
      { error: parsedBody.error },
      { status: parsedBody.status },
    );
  }

  if (!verifyRazorpayWebhookSignature(parsedBody.text, signature, secret)) {
    return Response.json({ error: "Razorpay webhook signature is invalid." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(parsedBody.text);
  } catch {
    return Response.json(
      { error: "Signed Razorpay webhook body is not valid JSON." },
      { status: 400 },
    );
  }

  const paymentEvent = parsePaymentEvent(body);
  if (!paymentEvent) {
    return Response.json({ received: true, ignored: true }, { status: 200 });
  }
  const store = getPaymentOrderStore();
  if (!store) {
    return Response.json(
      { error: "Webhook event storage is unavailable. Configure persistent order storage." },
      { status: 503 },
    );
  }

  const result = await processVerifiedProviderEvent(store, {
    providerEventId,
    ...paymentEvent,
  });
  if (result === "order-not-found") {
    return Response.json({ error: "Payment order was not found." }, { status: 404 });
  }
  if (result === "amount-mismatch") {
    return Response.json({ error: "Payment amount does not match the saved order." }, { status: 422 });
  }

  return Response.json(
    { received: true, duplicate: result === "duplicate" },
    { status: 200 },
  );
}
