import type { Metadata } from "next";
import Link from "next/link";
import { AdminEmptyState, AdminPageHeading } from "@/components/admin/admin-shell";
import { formatPrice } from "@/data/products";
import { getDashboardMetrics } from "@/lib/admin/metrics";

export const metadata: Metadata = { title: "Overview | Mithai House Admin" };

function MetricCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <article className="border border-gold/30 bg-white p-5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-brown/65">{label}</h2>
      <p className="mt-3 font-display text-2xl text-maroon">{value}</p>
      {note ? <p className="mt-2 text-xs leading-5 text-brown/60">{note}</p> : null}
    </article>
  );
}

export default async function AdminOverviewPage() {
  const metrics = await getDashboardMetrics();

  return (
    <>
      <AdminPageHeading
        eyebrow="Shop administration"
        title="Overview"
        description="Live figures are calculated from persisted orders. Paid revenue is captured order value less completed refunds."
      />
      {metrics.allTimeOrderCount === 0 ? (
        <div className="mb-6">
          <AdminEmptyState>
            There are no persisted orders yet. No demonstration records or invented sales are shown.
            Orders will appear here only after a persistent store is configured and verified orders are recorded.
          </AdminEmptyState>
        </div>
      ) : null}
      <section aria-label="Business metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Today's orders" value={String(metrics.today.orderCount)} />
        <MetricCard label="Today's paid revenue" value={formatPrice(metrics.today.paidRevenueInPaise)} />
        <MetricCard label="Last 7 days paid revenue" value={formatPrice(metrics.last7DaysRevenueInPaise)} />
        <MetricCard label="This month paid revenue" value={formatPrice(metrics.thisMonthRevenueInPaise)} />
        <MetricCard label="Paid average order value" value={formatPrice(metrics.today.averageOrderValueInPaise)} note="Today's captured orders, after completed refunds." />
        <MetricCard label="Pending payments" value={String(metrics.pendingPaymentCount)} />
        <MetricCard label="New / preparing" value={String(metrics.newPreparingCount)} />
        <MetricCard label="Awaiting dispatch / delivery" value={String(metrics.dispatchCount)} />
      </section>

      <section className="mt-10 border border-gold/30 bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Paid orders</p>
            <h2 className="mt-2 font-display text-2xl text-maroon">Best-selling products</h2>
            <p className="mt-2 text-xs text-brown/60">Quantity and gross item sales, before refunds.</p>
          </div>
          <Link href="/admin/analytics" className="text-sm font-semibold text-maroon underline underline-offset-4">
            View analytics
          </Link>
        </div>
        {metrics.bestSellingProducts.length === 0 ? (
          <p className="mt-6 text-sm text-brown/65">No paid product sales to analyze yet.</p>
        ) : (
          <ol className="mt-6 divide-y divide-gold/20">
            {metrics.bestSellingProducts.map((product) => (
              <li key={product.productId} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span>{product.productName}</span>
                <span className="text-brown/65">
                  {product.quantity} sold · {formatPrice(product.grossSalesInPaise)} gross
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="mt-6">
        <Link href="/admin/orders" className="inline-flex min-h-11 items-center bg-maroon px-5 font-semibold text-ivory hover:bg-brown focus-visible:outline-2 focus-visible:outline-saffron">
          Manage orders
        </Link>
      </div>
    </>
  );
}
