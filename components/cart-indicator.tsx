"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart-provider";

export function CartIndicator() {
  const { itemCount, isReady } = useCart();

  return (
    <Link
      href="/cart"
      aria-label={isReady ? `Shopping cart, ${itemCount} items` : "Shopping cart"}
      className="relative inline-flex min-h-11 min-w-11 items-center justify-center gap-2 text-maroon transition-colors hover:text-brown"
    >
      <ShoppingBag aria-hidden="true" size={19} strokeWidth={1.6} />
      <span className="hidden text-sm sm:inline">Cart</span>
      <span
        aria-hidden="true"
        className="flex min-w-5 items-center justify-center bg-maroon px-1 py-0.5 text-[0.62rem] font-semibold text-ivory"
      >
        {isReady ? itemCount : "–"}
      </span>
    </Link>
  );
}
