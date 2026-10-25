import { createRazorpayPaymentProvider } from "@/lib/payments/razorpay";
import { getPaymentOrderStore } from "@/lib/payments/order-store";
import { verifyPaymentAndRecord } from "@/lib/payments/verification-service";
import { readRequestText } from "@/lib/payments/request-body";
import { getRazorpayEnvironment } from "@/lib/payments/provider";

function isVerification(value: unknown): value is {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.providerOrderId === "string" &&
    typeof record.providerPaymentId === "string" &&
    typeof record.signature === "string" &&
    record.providerOrderId.length <= 100 &&
    record.providerPaymentId.length <= 100 &&
    record.signature.length === 64
  );
}

export async function POST(request: Request) {
  const parsedBody = await readRequestText(request);
  if (!parsedBody.success) {
    return Response.json(
      { error: parsedBody.error },
      { status: parsedBody.status },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(parsedBody.text);
  } catch {
    return Response.json(
      { error: "Payment verification request must contain valid JSON." },
      { status: 400 },
    );
  }
  if (!isVerification(body)) {
    return Response.json(
      { error: "Payment verification details are invalid." },
      { status: 400 },
    );
  }

  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return Response.json(
      { error: "Razorpay verification is not configured." },
      { status: 503 },
    );
  }
  const provider = createRazorpayPaymentProvider({ keyId, keySecret });
  const result = await verifyPaymentAndRecord(body, {
    environment: getRazorpayEnvironment(),
    provider,
    store: getPaymentOrderStore(),
  });
  if (!result.success) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json(
    {
      paymentStatus: result.paymentStatus,
      orderStatus: result.orderStatus,
      message:
        result.paymentStatus === "captured"
          ? "Payment has been verified. The shop must still confirm your order."
          : result.paymentStatus === "refunded"
            ? "Razorpay reports this payment as refunded. The shop must review the order."
            : result.paymentStatus === "failed"
              ? "Razorpay reports that this payment failed. The order is not confirmed."
              : "Payment is not captured yet. The order is not confirmed.",
    },
    { status: 200 },
  );
}
