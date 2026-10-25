import type { Metadata } from "next";
import { CartPage } from "@/components/cart-page";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { StorefrontRefreshWatcher } from "@/components/storefront-refresh-watcher";

export const metadata: Metadata = {
  title: "Shopping cart | Mithai House",
  description: "Review your locally saved shopping cart.",
};

export default function CartRoute() {
  return (
    <>
      <StorefrontRefreshWatcher />
      <Navbar />
      <CartPage />
      <Footer />
    </>
  );
}
