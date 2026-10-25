"use client";

import { useState } from "react";

export function ShopOrderStatusForm({
  orderId,
  currentStatus,
  paymentStatus,
}: {
  orderId: string;
  currentStatus: string;
  paymentStatus: string;
}) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const canConfirm =
    currentStatus === "awaiting_shop_confirmation" &&
    ["captured", "partially_refunded"].includes(paymentStatus);
  const canCancel = ["awaiting_payment", "awaiting_shop_confirmation", "confirmed"].includes(
    currentStatus,
  );
  if (!canConfirm && !canCancel) {
    return <p className="mt-3 text-sm text-brown/65">No shop order confirmation changes are available.</p>;
  }

  async function update(orderStatus: "confirmed" | "cancelled") {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderStatus }),
      });
      const body: { error?: string } = await response.json();
      if (!response.ok) {
        setMessage(body.error ?? "The order status could not be saved.");
        return;
      }
      window.location.reload();
    } catch {
      setMessage("The administrator service could not be reached. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-3">
        {canConfirm ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => update("confirmed")}
            className="min-h-11 bg-maroon px-4 font-semibold text-ivory hover:bg-brown disabled:opacity-60"
          >
            {pending ? "Saving…" : "Confirm shop order"}
          </button>
        ) : null}
        {canCancel ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => update("cancelled")}
            className="min-h-11 border border-maroon px-4 font-semibold text-maroon hover:bg-maroon hover:text-ivory disabled:opacity-60"
          >
            Cancel shop order
          </button>
        ) : null}
      </div>
      {currentStatus === "awaiting_shop_confirmation" || currentStatus === "confirmed" ? (
        <p className="mt-3 text-xs leading-5 text-brown/60">
          Cancelling a paid order does not issue a refund. Payment status changes only after verified provider records.
        </p>
      ) : null}
      {message ? <p role="alert" className="mt-3 text-sm text-maroon">{message}</p> : null}
    </div>
  );
}
