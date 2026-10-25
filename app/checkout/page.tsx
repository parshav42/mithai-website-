import type { Metadata } from "next";
import { CheckoutPage } from "@/components/checkout-page";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { StorefrontRefreshWatcher } from "@/components/storefront-refresh-watcher";
import { isWhatsAppConfigured } from "@/lib/checkout";
import { listStorefrontProducts } from "@/lib/products";
import {
  getPaymentSetupStatus,
  getRazorpayEnvironment,
} from "@/lib/payments/provider";
import { getPaymentOrderStore } from "@/lib/payments/order-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout | Mithai House",
  description: "Review your sweets and prepare an order enquiry for the shop.",
};

export default async function CheckoutRoute() {
  const products = await listStorefrontProducts();
  return (
    <>
      <StorefrontRefreshWatcher />
      <Navbar />
      <CheckoutPage
        whatsappConfigured={isWhatsAppConfigured(
          process.env.NEXT_PUBLIC_SHOP_WHATSAPP_NUMBER,
        )}
        paymentSetupStatus={getPaymentSetupStatus(
          getRazorpayEnvironment(),
          products,
          getPaymentOrderStore() !== null,
        )}
      />
      <Footer />
    </>
  );
}
