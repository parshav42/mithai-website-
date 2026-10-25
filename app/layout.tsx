import type { Metadata } from "next";
import { CartProvider } from "@/components/cart-provider";
import { listStorefrontProducts } from "@/lib/products";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mithai House | A Tradition of Sweetness",
  description:
    "Discover beloved Indian sweets, thoughtfully prepared for life's sweetest moments.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const products = await listStorefrontProducts();
  return (
    <html lang="en">
      <body>
        <CartProvider products={products}>{children}</CartProvider>
      </body>
    </html>
  );
}
