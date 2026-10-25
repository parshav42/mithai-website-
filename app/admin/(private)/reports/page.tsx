import type { Metadata } from "next";
import { AdminPageHeading } from "@/components/admin/admin-shell";
import { businessDateString, dateRangeForPreset } from "@/lib/admin/date-range";

export const metadata: Metadata = { title: "Reports | Mithai House Admin" };

function datesForPreset(preset: "today" | "last7") {
  const range = dateRangeForPreset(preset);
  const inclusiveEnd = new Date(range.end.getTime() - 1);
  return {
    from: businessDateString(range.start),
    to: businessDateString(inclusiveEnd),
  };
}

export default function AdminReportsPage() {
  const daily = datesForPreset("today");
  const weekly = datesForPreset("last7");
  return (
    <>
      <AdminPageHeading
        eyebrow="Documents & exports"
        title="Reports"
        description="Downloads include order/customer details and are restricted to signed-in administrators. Share files only with authorized staff."
      />
      <section className="grid gap-5 lg:grid-cols-2">
        <article className="border border-gold/30 bg-white p-5 sm:p-7">
          <h2 className="font-display text-xl text-maroon">Daily PDF</h2>
          <p className="mt-2 text-sm leading-6 text-brown/70">Orders created today in the configured business time zone, with payment, fulfillment, refund, and cancellation summaries.</p>
          <a href={`/api/admin/reports/pdf?from=${daily.from}&to=${daily.to}`} className="mt-5 inline-flex min-h-11 items-center bg-maroon px-4 font-semibold text-ivory hover:bg-brown">Download today&apos;s PDF</a>
        </article>
        <article className="border border-gold/30 bg-white p-5 sm:p-7">
          <h2 className="font-display text-xl text-maroon">Weekly PDF</h2>
          <p className="mt-2 text-sm leading-6 text-brown/70">A rolling seven-day report ending today, using the configured business time zone.</p>
          <a href={`/api/admin/reports/pdf?from=${weekly.from}&to=${weekly.to}`} className="mt-5 inline-flex min-h-11 items-center bg-maroon px-4 font-semibold text-ivory hover:bg-brown">Download 7-day PDF</a>
        </article>
      </section>

      <section className="mt-6 border border-gold/30 bg-white p-5 sm:p-7">
        <h2 className="font-display text-xl text-maroon">Custom date range</h2>
        <p className="mt-2 text-sm leading-6 text-brown/70">Choose an inclusive date range of up to 366 days. CSV and PDF use persisted order records only; downloads include private customer information.</p>
        <form className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
          <label className="text-sm font-medium">From<input name="from" type="date" required className="mt-2 min-h-11 w-full border border-brown/25 px-3" /></label>
          <label className="text-sm font-medium">Through<input name="to" type="date" required className="mt-2 min-h-11 w-full border border-brown/25 px-3" /></label>
          <button formAction="/api/admin/reports/csv" className="min-h-11 border border-maroon px-4 font-semibold text-maroon hover:bg-maroon hover:text-ivory">Download CSV</button>
          <button formAction="/api/admin/reports/pdf" className="min-h-11 bg-maroon px-4 font-semibold text-ivory hover:bg-brown">Download PDF</button>
        </form>
      </section>
      <p className="mt-6 text-xs leading-5 text-brown/60">Totals separate paid gross, provider-confirmed refunds, net paid after refunds, unpaid amounts, and cancelled order count. No tax amount or invoice number is inferred.</p>
    </>
  );
}
