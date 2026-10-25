import "server-only";
import { randomUUID } from "node:crypto";

export type SmsSendResult =
  | { accepted: true; provider: string; reference: string | null }
  | { accepted: false; provider: string; error: string; retryable: boolean };

export function normalizeIndianMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  const national = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(national) ? `91${national}` : null;
}

export function getSmsConfiguration() {
  const provider = process.env.SMS_PROVIDER?.trim().toLowerCase() || "mock";
  const enabled = process.env.SMS_ENABLED === "true";
  return { provider, enabled };
}

export async function sendConfirmationSms(input: {
  phone: string;
  customerName: string;
  receipt: string;
  amountInPaise: number;
}): Promise<SmsSendResult> {
  const mobile = normalizeIndianMobile(input.phone);
  if (!mobile) return { accepted: false, provider: "none", error: "Customer mobile number is not a valid Indian mobile number.", retryable: false };
  const { provider, enabled } = getSmsConfiguration();
  if (!enabled || provider === "mock") {
    return { accepted: true, provider: "mock", reference: `mock-${randomUUID()}` };
  }
  if (provider !== "msg91") return { accepted: false, provider, error: "SMS provider is not supported.", retryable: false };
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  if (!authKey || !templateId) return { accepted: false, provider, error: "MSG91 is enabled but its server configuration is incomplete.", retryable: false };

  try {
    const response = await fetch("https://control.msg91.com/api/v5/flow", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", authkey: authKey },
      body: JSON.stringify({
        template_id: templateId,
        realTimeResponse: "1",
        recipients: [{
          mobiles: mobile,
          VAR1: input.customerName.slice(0, 100),
          VAR2: input.receipt,
          VAR3: `₹${(input.amountInPaise / 100).toFixed(2)}`,
        }],
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const responseText = await response.text();
    let responseBody: unknown;
    try { responseBody = JSON.parse(responseText); } catch { responseBody = null; }
    if (!response.ok) {
      return { accepted: false, provider, error: `MSG91 returned HTTP ${response.status}.`, retryable: response.status === 429 || response.status >= 500 };
    }
    const record = typeof responseBody === "object" && responseBody !== null ? responseBody as Record<string, unknown> : {};
    const reference = [record.request_id, record.message, record.message_id].find((value) => typeof value === "string");
    return { accepted: true, provider, reference: typeof reference === "string" ? reference.slice(0, 200) : null };
  } catch {
    return { accepted: false, provider, error: "MSG91 could not be reached before the request timed out.", retryable: true };
  }
}
