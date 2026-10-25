import { products } from "@/data/products";
import { prepareWhatsAppMessage } from "@/lib/checkout";

const MAX_REQUEST_BYTES = 16_384;

export async function POST(request: Request) {
  const configuredNumber = process.env.NEXT_PUBLIC_SHOP_WHATSAPP_NUMBER;
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_REQUEST_BYTES) {
    return Response.json({ error: "Checkout request is too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) {
      return Response.json({ error: "Checkout request is too large." }, { status: 413 });
    }
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Checkout request must contain valid JSON." }, { status: 400 });
  }

  const result = prepareWhatsAppMessage(body, products, configuredNumber);
  if (!result.success) {
    return Response.json(
      { error: result.error, ...(result.errors ? { errors: result.errors } : {}) },
      { status: result.status },
    );
  }

  return Response.json(
    {
      whatsappUrl: result.whatsappUrl,
      message: result.message,
      subtotalInPaise: result.subtotalInPaise.toString(),
    },
    { status: 200 },
  );
}
