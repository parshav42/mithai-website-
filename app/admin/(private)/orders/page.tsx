import type { Metadata } from "next";
import Link from "next/link";
import { AdminEmptyState, AdminPageHeading } from "@/components/admin/admin-shell";
import { formatPrice } from "@/data/products";
import { formatBusinessDateTime } from "@/lib/admin/date-range";
import {
  FULFILLMENT_STATUSES,
  listAdminOrders,
  PAYMENT_STATUSES,
} from "@/lib/admin/orders";

export const metadata: Metadata = { title: "Orders | Mithai House Admin" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function value(search: Record<string, string | string[] | undefined>, key: string) {
  const field = search[key];
  return typeof field === "string" ? field : "";
}

function label(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const payment = value(query, "paymentStatus");
  const fulfillment = value(query, "fulfillmentStatus");
  const page = Number(value(query, "page") || 1);
  const filters = {
    search: value(query, "search"),
    from: value(query, "from"),
    to: value(query, "to"),
    paymentStatus: PAYMENT_STATUSES.find((status) => status === payment),
    fulfillmentStatus: FULFILLMENT_STATUSES.find((status) => status === fulfillment),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
  const result = await listAdminOrders(filters);

  return (
    <>
      <AdminPageHeading
        eyebrow="Shop operations"
        title="Orders"
        description="Payment status is recorded separately from fulfillment status. Customer details are visible only to signed-in administrators."
      />
      <form className="mb-6 grid gap-3 border border-gold/30 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold">Search order or customer</span>
          <input name="search" defaultValue={filters.search} maxLength={100} placeholder="Order ID, name, phone" className="min-h-10 w-full border border-brown/25 px-3" />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold">From date</span>
          <input name="from" type="date" defaultValue={filters.from} className="min-h-10 w-full border border-brown/25 px-2" />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold">Through date</span>
          <input name="to" type="date" defaultValue={filters.to} className="min-h-10 w-full border border-brown/25 px-2" />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold">Payment</span>
          <select name="paymentStatus" defaultValue={payment} className="min-h-10 w-full border border-brown/25 bg-white px-2">
            <option value="">Any payment status</option>
            {PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{label(status)}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold">Fulfillment</span>
          <select name="fulfillmentStatus" defaultValue={fulfillment} className="min-h-10 w-full border border-brown/25 bg-white px-2">
            <option value="">Any fulfillment status</option>
            {FULFILLMENT_STATUSES.map((status) => <option key={status} value={status}>{label(status)}</option>)}
          </select>
        </label>
        <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-6">
          <button className="min-h-10 bg-maroon px-4 text-sm font-semibold text-ivory hover:bg-brown">Apply filters</button>
          <Link href="/admin/orders" className="inline-flex min-h-10 items-center px-2 text-sm text-maroon underline underline-offset-4">Clear</Link>
        </div>
      </form>

      {result.orders.length === 0 ? (
        <AdminEmptyState>No orders match these filters. The dashboard does not use sample or invented records.</AdminEmptyState>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {result.orders.map((order) => (
              <article key={order.id} className="border border-gold/30 bg-white p-4">
                <div className="flex justify-between gap-3">
                  <Link href={`/admin/orders/${order.id}`} className="font-semibold text-maroon underline underline-offset-4">{order.receipt}</Link>
                  <span className="text-xs text-brown/65">{formatBusinessDateTime(order.createdAt)}</span>
                </div>
                <p className="mt-3 text-sm font-medium">{order.customerName}</p>
                <p className="text-sm text-brown/70">{order.customerPhone}</p>
                <p className="mt-2 text-sm">{order.fulfillment === "delivery" ? order.deliveryAddress : "Pickup"}</p>
                <p className="mt-3 text-sm">{order.lines.map((line) => `${line.productName} × ${line.quantity}`).join(", ")}</p>
                <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
                  <strong>{formatPrice(order.amountInPaise)}</strong>
                  <span>{label(order.paymentStatus)} · {label(order.fulfillmentStatus)}</span>
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto border border-gold/30 bg-white md:block">
            <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
              <thead className="bg-maroon text-ivory">
                <tr>{["Order / date", "Customer", "Fulfillment", "Items", "Total", "Payment", "Status"].map((header) => <th key={header} className="px-4 py-3 font-semibold">{header}</th>)}</tr>
              </thead>
              <tbody>
                {result.orders.map((order) => (
                  <tr key={order.id} className="border-b border-gold/20 align-top last:border-0">
                    <td className="px-4 py-4">
                      <Link href={`/admin/orders/${order.id}`} className="font-semibold text-maroon underline underline-offset-4">{order.receipt}</Link>
                      <p className="mt-1 text-xs text-brown/60">{formatBusinessDateTime(order.createdAt)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium">{order.customerName}</p>
                      <p className="mt-1 text-xs">{order.customerPhone}</p>
                      {order.fulfillment === "delivery" && order.deliveryAddress ? <p className="mt-1 max-w-56 text-xs text-brown/65">{order.deliveryAddress}</p> : <p className="mt-1 text-xs">Pickup</p>}
                    </td>
                    <td className="px-4 py-4">{label(order.fulfillment)}</td>
                    <td className="px-4 py-4">{order.lines.map((line) => <p key={line.productId}>{line.productName} × {line.quantity}</p>)}</td>
                    <td className="px-4 py-4 font-semibold">{formatPrice(order.amountInPaise)}</td>
                    <td className="px-4 py-4">{label(order.paymentStatus)}</td>
                    <td className="px-4 py-4">{label(order.fulfillmentStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex items-center justify-between gap-4 text-sm">
            <span>{result.total} order{result.total === 1 ? "" : "s"} · Page {result.page} of {Math.max(1, result.pages)}</span>
            <div className="flex gap-2">
              {result.page > 1 ? <Link href={pageHref(query, result.page - 1)} className="border border-maroon px-3 py-2 text-maroon">Previous</Link> : null}
              {result.page < result.pages ? <Link href={pageHref(query, result.page + 1)} className="border border-maroon px-3 py-2 text-maroon">Next</Link> : null}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function pageHref(
  query: Record<string, string | string[] | undefined>,
  page: number,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string" && key !== "page") params.set(key, value);
  }
  params.set("page", String(page));
  return `/admin/orders?${params.toString()}`;
}
