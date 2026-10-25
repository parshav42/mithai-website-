import { products } from "@/data/products";
import { createPaymentOrder } from "@/lib/payments/order-service";
import { getPaymentOrderStore } from "@/lib/payments/order-store";
import { readRequestText } from "@/lib/payments/request-body";
import { getRazorpayEnvironment } from "@/lib/payments/provider";

export async function POST(request: Request) {
  const parsedBody = await readRequestText(request);
  if (!parsedBody.success) {
    return Response.json(
      { error: parsedBody.error },
      { status: parsedBody.status },
    );
  }

  let submission: unknown;
  try {
    submission = JSON.parse(parsedBody.text);
  } catch {
    return Response.json(
      { error: "Payment request must contain valid JSON." },
      { status: 400 },
    );
  }

  const result = await createPaymentOrder(submission, {
    environment: getRazorpayEnvironment(),
    catalog: products,
    store: getPaymentOrderStore(),
  });
  if (!result.success) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json(result, { status: 201 });
}
