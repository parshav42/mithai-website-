"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RetryConfirmationSms({ orderId }: { orderId: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  async function retry() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/notification/retry`, { method: "POST" });
      const body = await response.json() as { status?: string; error?: string };
      if (!response.ok) { setMessage(body.error ?? "SMS retry failed."); return; }
      setMessage(body.status === "accepted" ? "Provider accepted the SMS retry." : "SMS retry failed; see the updated notification status.");
      router.refresh();
    } catch {
      setMessage("The administrator service could not be reached.");
    } finally { setPending(false); }
  }
  return <div className="mt-3">
    <button type="button" disabled={pending} onClick={retry} className="min-h-10 border border-maroon px-3 text-sm font-semibold text-maroon disabled:opacity-50">
      {pending ? "Retrying…" : "Retry SMS"}
    </button>
    <p role="status" className="mt-2 text-sm text-brown">{message}</p>
  </div>;
}
