import { products } from "@/data/products";
import { prepareWhatsAppMessage } from "@/lib/checkout";

const MAX_REQUEST_BYTES = 16_384;

export async function POST(request: Request) {
  const configuredNumber = process.env.NEXT_PUBLIC_SHOP_WHATSAPP_NUMBER;
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_REQUEST_BYTES) {
    return Response.json({ error: "Checkout request is too large." }, { status: 413 });
  }

  const parsedBody = await readCheckoutBody(request);
  if (!parsedBody.success) {
    return Response.json(
      { error: parsedBody.error },
      { status: parsedBody.status },
    );
  }

  const result = prepareWhatsAppMessage(
    parsedBody.body,
    products,
    configuredNumber,
  );
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

async function readCheckoutBody(
  request: Request,
): Promise<
  | { success: true; body: unknown }
  | { success: false; status: 400 | 413; error: string }
> {
  const reader = request.body?.getReader();
  if (!reader) {
    return {
      success: false,
      status: 400,
      error: "Checkout request must contain a JSON body.",
    };
  }

  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_REQUEST_BYTES) {
        return {
          success: false,
          status: 413,
          error: "Checkout request is too large.",
        };
      }
      chunks.push(value);
    }
  } catch {
    return {
      success: false,
      status: 400,
      error: "Checkout request body could not be read.",
    };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return {
      success: false,
      status: 400,
      error: "Checkout request must contain valid UTF-8 JSON.",
    };
  }

  try {
    return { success: true, body: JSON.parse(text) };
  } catch {
    return {
      success: false,
      status: 400,
      error: "Checkout request must contain valid JSON.",
    };
  }
}
