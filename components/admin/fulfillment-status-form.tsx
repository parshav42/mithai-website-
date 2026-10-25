"use client";

import { useState } from "react";
import type { FulfillmentStatus } from "@/lib/payments/order-model";

const transitions: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  new: ["preparing", "cancelled"],
  preparing: ["ready_for_dispatch", "cancelled"],
  ready_for_dispatch: ["out_for_delivery", "delivered", "picked_up", "cancelled"],
  out_for_delivery: ["delivered"],
  delivered: [],
  picked_up: [],
  cancelled: [],
};

const title = (status: string) =>
  status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function FulfillmentStatusForm({
  orderId,
  currentStatus,
  paymentStatus,
}: {
  orderId: string;
  currentStatus: FulfillmentStatus;
  paymentStatus: string;
}) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const available = ["captured", "partially_refunded"].includes(paymentStatus)
    ? transitions[currentStatus]
    : [];

  async function submit(formData: FormData) {
    const fulfillmentStatus = formData.get("fulfillmentStatus");
    if (typeof fulfillmentStatus !== "string") return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fulfillmentStatus }),
      });
      const body: { error?: string } = await response.json();
      if (!response.ok) {
        setMessage(body.error ?? "The status update could not be saved.");
        return;
      }
      window.location.reload();
    } catch {
      setMessage("The administrator service could not be reached. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (available.length === 0) {
    return (
      <p className="mt-3 text-sm text-brown/65">
        {paymentStatus === "captured" || paymentStatus === "partially_refunded"
          ? "No further fulfillment changes are available."
          : "Fulfillment updates are unavailable until a verified payment is recorded."}
      </p>
    );
  }

  return (
    <form action={submit} className="mt-4 flex flex-col gap-3 sm:flex-row">
      <label className="sr-only" htmlFor="fulfillmentStatus">New fulfillment status</label>
      <select
        id="fulfillmentStatus"
        name="fulfillmentStatus"
        defaultValue={available[0]}
        className="min-h-11 min-w-0 flex-1 border border-brown/25 bg-white px-3"
      >
        {available.map((status) => (
          <option key={status} value={status}>{title(status)}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 bg-maroon px-5 font-semibold text-ivory hover:bg-brown disabled:opacity-60"
      >
        {pending ? "Saving…" : "Update status"}
      </button>
      {message ? <p role="alert" className="basis-full text-sm text-maroon">{message}</p> : null}
    </form>
  );
}
