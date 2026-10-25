import type { Metadata } from "next";
import { AdminPageHeading } from "@/components/admin/admin-shell";
import { isDatabaseConfigured, getDatabasePool } from "@/lib/db";
import { isAdministratorConfigured } from "@/lib/admin/password";
import { getInvoiceBusinessConfiguration } from "@/lib/admin/documents";
import { isWhatsAppConfigured } from "@/lib/checkout";
import { getPaymentSetupStatus, getRazorpayEnvironment } from "@/lib/payments/provider";
import { getPaymentOrderStore } from "@/lib/payments/order-store";
import { products } from "@/data/products";

export const metadata: Metadata = { title: "Settings | Mithai House Admin" };

async function databaseStatus() {
  if (!isDatabaseConfigured()) return "Not configured";
  try {
    const result = await getDatabasePool().query<{ orders_table: string | null }>(
      `SELECT to_regclass('public.orders')::text AS orders_table`,
    );
    return result.rows[0]?.orders_table ? "Connected · schema available" : "Connected · migration required";
  } catch {
    return "Connection or schema check failed";
  }
}

export default async function AdminSettingsPage() {
  const database = await databaseStatus();
  const payment = getPaymentSetupStatus(
    getRazorpayEnvironment(),
    products,
    getPaymentOrderStore() !== null,
  );
  const values: Array<[string, string]> = [
    ["Administrator authentication", isAdministratorConfigured() ? "Configured" : "Not configured"],
    ["PostgreSQL", database],
    ["Confirmed invoice details", getInvoiceBusinessConfiguration() ? "Configured" : "Not configured"],
    ["WhatsApp contact", isWhatsAppConfigured(process.env.NEXT_PUBLIC_SHOP_WHATSAPP_NUMBER) ? "Configured" : "Not configured"],
    ["Razorpay readiness", payment.replaceAll("-", " ")],
    ["Catalog", products.some((product) => !product.isDemonstration && product.availability === "available") ? "Contains shop-configured items" : "Demonstration products only"],
  ];
  return (
    <>
      <AdminPageHeading
        eyebrow="Configuration"
        title="Settings"
        description="This screen reports setup readiness without exposing secrets. Store values in deployment environment settings; never paste credentials here."
      />
      <dl className="divide-y divide-gold/20 border border-gold/30 bg-white px-5 sm:px-7">
        {values.map(([name, value]) => <div key={name} className="grid gap-1 py-4 sm:grid-cols-[minmax(14rem,0.8fr)_1.2fr]"><dt className="text-sm font-semibold">{name}</dt><dd className="text-sm text-brown/70">{value}</dd></div>)}
      </dl>
      <aside className="mt-6 border-l-4 border-saffron bg-white p-5 text-sm leading-6">
        <strong className="block text-maroon">Launch safeguards</strong>
        Real sales and online payments remain disabled until the shop owner confirms the catalog, prices, availability, fulfillment and delivery policies; configures persistent PostgreSQL and Razorpay; and completes test-mode verification. This application does not invent or show sample orders.
      </aside>
    </>
  );
}
