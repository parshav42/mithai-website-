import type { Metadata } from "next";
import { CheckoutPage } from "@/components/checkout-page";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { isWhatsAppConfigured } from "@/lib/checkout";
import { getPaymentSetupStatus } from "@/lib/payments/provider";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout | Mithai House",
  description: "Review your sweets and prepare an order enquiry for the shop.",
};

export default function CheckoutRoute() {
  return (
    <>
      <Navbar />
      <CheckoutPage
        whatsappConfigured={isWhatsAppConfigured(
          process.env.NEXT_PUBLIC_SHOP_WHATSAPP_NUMBER,
        )}
        paymentSetupStatus={getPaymentSetupStatus()}
      />
      <Footer />
    </>
  );
}
