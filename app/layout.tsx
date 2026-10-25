import type { Metadata } from "next";
import { CartProvider } from "@/components/cart-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mithai House | A Tradition of Sweetness",
  description:
    "Discover beloved Indian sweets, thoughtfully prepared for life's sweetest moments.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
