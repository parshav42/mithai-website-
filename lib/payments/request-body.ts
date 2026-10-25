const MAX_PAYMENT_REQUEST_BYTES = 16_384;
const MAX_WEBHOOK_REQUEST_BYTES = 1_048_576;

export type ReadRequestTextResult =
  | { success: true; text: string }
  | { success: false; status: 400 | 413; error: string };

export async function readRequestText(
  request: Request,
  maximumBytes = MAX_PAYMENT_REQUEST_BYTES,
): Promise<ReadRequestTextResult> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > maximumBytes) {
    return { success: false, status: 413, error: "Request body is too large." };
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return { success: false, status: 400, error: "Request body is required." };
  }

  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maximumBytes) {
        return { success: false, status: 413, error: "Request body is too large." };
      }
      chunks.push(value);
    }
  } catch {
    return { success: false, status: 400, error: "Request body could not be read." };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { success: true, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { success: false, status: 400, error: "Request body is not valid UTF-8." };
  }
}

export function getMaximumWebhookRequestBytes() {
  return MAX_WEBHOOK_REQUEST_BYTES;
}
