import type { Metadata } from "next";
import Link from "next/link";
import { AdminEmptyState, AdminPageHeading } from "@/components/admin/admin-shell";
import { formatBusinessDateTime } from "@/lib/admin/date-range";
import { getPaymentOverview } from "@/lib/admin/orders";
import { formatPrice } from "@/data/products";

export const metadata: Metadata = { title: "Payments | Mithai House Admin" };

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function AdminPaymentsPage() {
  const payments = await getPaymentOverview();
  return (
    <>
      <AdminPageHeading
        eyebrow="Financial operations"
        title="Payments"
        description="Statuses shown here come from verified server-side payment checks and provider webhooks. A paid payment does not automatically confirm shop fulfillment."
      />
      {payments.breakdown.length === 0 ? (
        <AdminEmptyState>No persisted payment records are available yet.</AdminEmptyState>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {payments.breakdown.map((item) => (
              <article key={item.status} className="border border-gold/30 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-brown/60">{label(item.status)}</p>
                <p className="mt-3 font-display text-2xl text-maroon">{item.count} order{item.count === 1 ? "" : "s"}</p>
                <p className="mt-2 text-sm text-brown/70">Order value {formatPrice(item.orderValueInPaise)}</p>
                {item.refundedInPaise > 0 ? <p className="mt-1 text-sm text-brown/70">Refunded {formatPrice(item.refundedInPaise)}</p> : null}
              </article>
            ))}
          </section>
          <section className="mt-8 border border-gold/30 bg-white">
            <h2 className="border-b border-gold/25 px-5 py-4 font-display text-xl text-maroon">Recent payment records</h2>
            {payments.recent.length === 0 ? <div className="p-5"><AdminEmptyState>No payments to display.</AdminEmptyState></div> : (
              <ul className="divide-y divide-gold/20">
                {payments.recent.map((payment) => (
                  <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div>
                      <Link href={`/admin/orders/${payment.id}`} className="font-semibold text-maroon underline underline-offset-4">{payment.receipt}</Link>
                      <p className="mt-1 text-sm">{payment.customerName} · {formatBusinessDateTime(payment.createdAt)}</p>
                      {payment.providerPaymentId ? <p className="mt-1 break-all text-xs text-brown/60">Provider payment reference: {payment.providerPaymentId}</p> : null}
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold">{formatPrice(payment.amountInPaise)}</p>
                      <p>{label(payment.paymentStatus)}</p>
                      {payment.refundedAmountInPaise > 0 ? <p className="text-xs text-brown/65">Refunded {formatPrice(payment.refundedAmountInPaise)}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
