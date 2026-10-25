import type { Metadata } from "next";
import { AdminEmptyState, AdminPageHeading } from "@/components/admin/admin-shell";
import { OrderBars, RevenueBars } from "@/components/admin/analytics-charts";
import { formatPrice } from "@/data/products";
import { dateRangeForPreset, parseCustomDateRange } from "@/lib/admin/date-range";
import { getAnalytics } from "@/lib/admin/metrics";

export const metadata: Metadata = { title: "Analytics | Mithai House Admin" };

type Query = Promise<Record<string, string | string[] | undefined>>;
const presets = ["today", "last7", "last30", "thisMonth", "custom"] as const;

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Query }) {
  const query = await searchParams;
  const preset = typeof query.range === "string" && presets.includes(query.range as (typeof presets)[number])
    ? query.range as (typeof presets)[number]
    : "last30";
  let range: ReturnType<typeof dateRangeForPreset> | null;
  if (preset === "custom" && typeof query.from === "string" && typeof query.to === "string") {
    range = parseCustomDateRange(query.from, query.to);
  } else if (preset === "custom") {
    range = null;
  } else {
    range = dateRangeForPreset(preset);
  }
  const analytics = range ? await getAnalytics(range) : null;
  const hasData = Boolean(
    analytics &&
      (analytics.daily.length > 0 ||
        analytics.paymentBreakdown.length > 0 ||
        analytics.orderBreakdown.length > 0 ||
        analytics.fulfillmentBreakdown.length > 0),
  );

  return (
    <>
      <AdminPageHeading
        eyebrow="Business performance"
        title="Analytics"
        description="Paid revenue is captured amount less provider-confirmed refunds. Unpaid and failed payments are excluded; cancelled order values remain visible in status breakdowns."
      />
      <form className="mb-6 grid gap-3 border border-gold/30 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs font-semibold">Date range
          <select name="range" defaultValue={preset} className="mt-1 min-h-10 w-full border border-brown/25 bg-white px-2">
            <option value="today">Today</option><option value="last7">Last 7 days</option><option value="last30">Last 30 days</option><option value="thisMonth">This month</option><option value="custom">Custom range</option>
          </select>
        </label>
        <label className="text-xs font-semibold">From<input name="from" type="date" defaultValue={typeof query.from === "string" ? query.from : ""} className="mt-1 min-h-10 w-full border border-brown/25 px-2" /></label>
        <label className="text-xs font-semibold">Through<input name="to" type="date" defaultValue={typeof query.to === "string" ? query.to : ""} className="mt-1 min-h-10 w-full border border-brown/25 px-2" /></label>
        <div className="flex items-end lg:col-span-2"><button className="min-h-10 bg-maroon px-5 font-semibold text-ivory hover:bg-brown">Apply</button></div>
      </form>

      {!range ? (
        <AdminEmptyState>Choose both a start date and an end date to view a custom report range.</AdminEmptyState>
      ) : !hasData || !analytics ? (
        <AdminEmptyState>There is not enough persisted sales data to show meaningful analytics. Metrics will appear after real, verified orders exist.</AdminEmptyState>
      ) : (
        <>
          <section className="mb-6 grid gap-4 sm:grid-cols-2">
            <article className="border border-gold/30 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-brown/60">Paid average order value</p>
              <p className="mt-3 font-display text-2xl text-maroon">{formatPrice(analytics.averageOrderValueInPaise)}</p>
              <p className="mt-2 text-xs text-brown/60">Net paid revenue divided by paid orders in range.</p>
            </article>
            <article className="border border-gold/30 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-brown/60">Delivery completion</p>
              <p className="mt-3 font-display text-2xl text-maroon">{analytics.deliveryCompletionPercent === null ? "—" : `${analytics.deliveryCompletionPercent}%`}</p>
              <p className="mt-2 text-xs text-brown/60">{analytics.deliveryDenominator} verified paid deliveries reached dispatch. Pickup orders are excluded.</p>
            </article>
          </section>
          <section className="grid gap-5 xl:grid-cols-2">
            <RevenueBars title="Daily revenue & order trend" rows={analytics.daily} />
            <OrderBars title="Order volume over time" rows={analytics.daily} />
            <RevenueBars title="Weekly revenue" rows={analytics.weekly} />
            <RevenueBars title="Monthly revenue" rows={analytics.monthly} />
            <article className="border border-gold/30 bg-white p-5">
              <h3 className="font-display text-lg text-maroon">Best-selling products</h3>
              {analytics.bestSellingProducts.length ? <ol className="mt-4 divide-y divide-gold/20">{analytics.bestSellingProducts.map((item) => <li key={item.productId} className="flex justify-between gap-3 py-3 text-sm"><span>{item.productName} · {item.quantity}</span><span>{formatPrice(item.grossRevenueInPaise)} gross</span></li>)}</ol> : <p className="mt-4 text-sm text-brown/65">No paid product sales in this range.</p>}
            </article>
            <Breakdown title="Payment status" rows={analytics.paymentBreakdown} />
            <Breakdown title="Shop order status" rows={analytics.orderBreakdown} />
            <Breakdown title="Order fulfillment status" rows={analytics.fulfillmentBreakdown} />
          </section>
        </>
      )}
    </>
  );
}

function Breakdown({ title, rows }: { title: string; rows: Array<{ status: string; count: number }> }) {
  return (
    <article className="border border-gold/30 bg-white p-5">
      <h3 className="font-display text-lg text-maroon">{title}</h3>
      {rows.length ? <ul className="mt-4 divide-y divide-gold/20">{rows.map((row) => <li key={row.status} className="flex justify-between py-3 text-sm"><span>{row.status.replaceAll("_", " ")}</span><span>{row.count}</span></li>)}</ul> : <p className="mt-4 text-sm text-brown/65">No records in this range.</p>}
    </article>
  );
}
