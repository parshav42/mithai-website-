"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type OrderListResponse = { orders?: Array<{ id: string }> };

export function OrderRefreshWatcher({ query, orderIds }: { query: string; orderIds: string[] }) {
  const router = useRouter();
  const knownIds = useRef(new Set(orderIds));
  const [message, setMessage] = useState("Checking for new orders…");

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(`/api/admin/orders?${query}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Order refresh failed.");
        const data = await response.json() as OrderListResponse;
        if (!active || !Array.isArray(data.orders)) return;
        const newOrders = data.orders.filter((order) => !knownIds.current.has(order.id));
        for (const order of data.orders) knownIds.current.add(order.id);
        if (newOrders.length) {
          setMessage(`${newOrders.length} new order${newOrders.length === 1 ? "" : "s"} received.`);
          router.refresh();
        } else {
          setMessage("Orders are up to date. Refreshes automatically every 15 seconds.");
        }
      } catch {
        if (active) setMessage("Live order updates are temporarily unavailable. Retrying…");
      }
    };
    const timer = window.setInterval(check, 15_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [query, router]);

  return <p role="status" aria-live="polite" className="mb-4 text-sm text-brown/70">{message}</p>;
}
