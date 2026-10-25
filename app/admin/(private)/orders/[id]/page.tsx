import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPageHeading } from "@/components/admin/admin-shell";
import { FulfillmentStatusForm } from "@/components/admin/fulfillment-status-form";
import { ShopOrderStatusForm } from "@/components/admin/shop-order-status-form";
import { RetryConfirmationSms } from "@/components/admin/retry-confirmation-sms";
import { formatPrice } from "@/data/products";
import {
  formatBusinessDateTime,
} from "@/lib/admin/date-range";
import { getInvoiceBusinessConfiguration } from "@/lib/admin/documents";
import { getAdminOrderDetails } from "@/lib/admin/orders";

type PageProps = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Order ${id.slice(0, 8)} | Mithai House Admin`, robots: { index: false, follow: false } };
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const order = await getAdminOrderDetails(id);
  if (!order) notFound();

  const invoiceAvailable = Boolean(getInvoiceBusinessConfiguration());
  return (
    <>
      <AdminPageHeading
        eyebrow="Order record"
        title={`Order ${order.receipt}`}
        description={`Created ${formatBusinessDateTime(order.createdAt)} · Payment and fulfillment are tracked independently.`}
      />

      <section className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <article className="border border-gold/30 bg-white p-5 sm:p-7">
          <h2 className="font-display text-xl text-maroon">Customer & fulfillment</h2>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div><dt className="text-xs font-semibold uppercase text-brown/60">Customer</dt><dd className="mt-1">{order.customerName}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-brown/60">Phone</dt><dd className="mt-1">{order.customerPhone}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-brown/60">Shop order status</dt><dd className="mt-1">{label(order.orderStatus)}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-brown/60">Fulfillment</dt><dd className="mt-1">{label(order.fulfillment)}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-brown/60">Fulfillment status</dt><dd className="mt-1">{label(order.fulfillmentStatus)}</dd></div>
            {order.deliveryAddress ? <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-brown/60">Delivery address</dt><dd className="mt-1 whitespace-pre-wrap">{order.deliveryAddress}</dd></div> : null}
            {order.instructions ? <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-brown/60">Customer instructions</dt><dd className="mt-1 whitespace-pre-wrap">{order.instructions}</dd></div> : null}
          </dl>
          <FulfillmentStatusForm
            orderId={order.id}
            currentStatus={order.fulfillmentStatus}
            paymentStatus={order.paymentStatus}
          />
          <ShopOrderStatusForm
            orderId={order.id}
            currentStatus={order.orderStatus}
            paymentStatus={order.paymentStatus}
          />
          <div className="mt-5 border-t border-gold/25 pt-4">
            <h3 className="text-xs font-semibold uppercase text-brown/60">Confirmation SMS</h3>
            {!order.confirmationNotification ? (
              <p className="mt-2 text-sm text-brown/65">No confirmation SMS is queued.</p>
            ) : (
              <div className="mt-2 text-sm">
                <p>{label(order.confirmationNotification.status)} · {order.confirmationNotification.provider} · {order.confirmationNotification.attemptCount} attempt{order.confirmationNotification.attemptCount === 1 ? "" : "s"}</p>
                {order.confirmationNotification.providerReference ? <p className="mt-1 break-all text-xs text-brown/60">Provider reference: {order.confirmationNotification.providerReference}</p> : null}
                {order.confirmationNotification.lastError ? <p className="mt-1 text-maroon">{order.confirmationNotification.lastError}</p> : null}
                {order.confirmationNotification.status === "failed" && order.confirmationNotification.retryable && order.confirmationNotification.attemptCount < 3 ? <RetryConfirmationSms orderId={order.id} /> : null}
                <p className="mt-1 text-xs text-brown/60">Accepted means the provider accepted the request; delivery is not confirmed.</p>
              </div>
            )}
          </div>
        </article>

        <article className="border border-gold/30 bg-white p-5 sm:p-7">
          <h2 className="font-display text-xl text-maroon">Payment record</h2>
          <dl className="mt-5 space-y-4 text-sm">
            <div><dt className="text-xs font-semibold uppercase text-brown/60">Payment status</dt><dd className="mt-1 font-medium">{label(order.paymentStatus)}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-brown/60">Payment method</dt><dd className="mt-1 font-medium">{order.paymentAttempts[0]?.provider ?? "Not started"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-brown/60">Order total</dt><dd className="mt-1 font-display text-xl">{formatPrice(order.amountInPaise)}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-brown/60">Refunded, provider-confirmed</dt><dd className="mt-1">{formatPrice(order.refundedAmountInPaise)}</dd></div>
          </dl>
          <div className="mt-6 border-t border-gold/20 pt-4">
            <p className="text-xs font-semibold uppercase text-brown/60">Payment attempts</p>
            {order.paymentAttempts.length === 0 ? <p className="mt-2 text-sm text-brown/60">No provider payment attempt is recorded.</p> : (
              <ul className="mt-2 space-y-2 text-sm">
                {order.paymentAttempts.map((attempt, index) => (
                  <li key={`${attempt.providerPaymentId ?? attempt.providerOrderId}-${index}`} className="border-l-2 border-gold pl-3">
                    <p>{label(attempt.status)} · {formatPrice(attempt.amountInPaise)}</p>
                    <p className="break-all text-xs text-brown/60">{attempt.providerPaymentId ?? attempt.providerOrderId}</p>
                    <p className="text-xs text-brown/60">{formatBusinessDateTime(attempt.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>

        <article className="border border-gold/30 bg-white p-5 sm:p-7 lg:col-span-2">
          <h2 className="font-display text-xl text-maroon">Items</h2>
          <div className="mt-4 divide-y divide-gold/20">
            {order.lines.map((line) => (
              <div key={line.productId} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span>{line.productName} × {line.quantity}</span>
                <span>{formatPrice(line.unitPriceInPaise)} each · {formatPrice(line.unitPriceInPaise * line.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between border-t border-gold/30 pt-4 font-semibold">
            <span>Order total</span><span>{formatPrice(order.amountInPaise)}</span>
          </div>
        </article>
      </section>

      <section className="mt-6 border border-gold/30 bg-white p-5 sm:p-7">
        <h2 className="font-display text-xl text-maroon">Documents</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {order.fulfillment === "delivery" ? <a className="min-h-11 border border-maroon px-4 py-3 text-sm font-semibold text-maroon hover:bg-maroon hover:text-ivory" href={`/api/admin/orders/${order.id}/documents/label`}>Print delivery label</a> : null}
          <a className="min-h-11 border border-maroon px-4 py-3 text-sm font-semibold text-maroon hover:bg-maroon hover:text-ivory" href={`/api/admin/orders/${order.id}/documents/packing-slip`}>Print packing slip</a>
          {invoiceAvailable ? (
            <a className="min-h-11 border border-maroon px-4 py-3 text-sm font-semibold text-maroon hover:bg-maroon hover:text-ivory" href={`/api/admin/orders/${order.id}/documents/invoice`}>Download order invoice</a>
          ) : (
            <span className="inline-flex min-h-11 items-center border border-brown/20 px-4 py-3 text-sm text-brown/60" title="Shop invoice details are not configured">Invoice disabled · shop details unconfirmed</span>
          )}
        </div>
        {!invoiceAvailable ? <p className="mt-3 text-xs leading-5 text-brown/60">An order invoice requires confirmed shop name, address, phone, and legal details. No invoice number or tax information is fabricated; the PDF will be clearly marked as not a tax invoice.</p> : null}
      </section>

      {order.refunds.length ? (
        <section className="mt-6 border border-gold/30 bg-white p-5 sm:p-7">
          <h2 className="font-display text-xl text-maroon">Refund events</h2>
          <ul className="mt-4 space-y-3">
            {order.refunds.map((refund) => <li key={refund.id} className="flex flex-wrap justify-between gap-2 text-sm"><span>{refund.status} · {formatPrice(refund.amountInPaise)}</span><time>{formatBusinessDateTime(refund.createdAt)}</time></li>)}
          </ul>
        </section>
      ) : null}

      <section className="mt-6 border border-gold/30 bg-white p-5 sm:p-7">
        <h2 className="font-display text-xl text-maroon">Status history</h2>
        {order.history.length === 0 ? <p className="mt-3 text-sm text-brown/60">No status changes recorded.</p> : (
          <ol className="mt-4 space-y-3">
            {order.history.map((event, index) => (
              <li key={`${event.status_type}-${event.createdAt.toISOString()}-${index}`} className="border-l-2 border-gold pl-4 text-sm">
                <p className="font-medium">{label(event.status_type)}: {event.previous_status ? `${label(event.previous_status)} → ` : ""}{label(event.next_status)}</p>
                <p className="mt-1 text-xs text-brown/60">{formatBusinessDateTime(event.createdAt)} · {event.actor}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
