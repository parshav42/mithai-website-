"use client";

import { useCart } from "@/components/cart-provider";
import { formatPrice, isPurchasable, type Product } from "@/data/products";

export function AddToCartButton({ product }: { product: Product }) {
  const { addItem, isReady } = useCart();

  if (!isPurchasable(product)) {
    return (
      <p className="border border-gold/60 px-3 py-2 text-center text-[0.68rem] font-semibold leading-5 text-brown/80 sm:px-4 sm:text-xs">
        {product.availability === "unavailable"
          ? "Currently unavailable"
          : "Price & availability pending"}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="font-semibold text-maroon">{formatPrice(product.priceInPaise)}</p>
      <button
        type="button"
        disabled={!isReady}
        onClick={() => addItem(product.id)}
        className="min-h-11 border border-maroon px-4 text-sm font-semibold text-maroon transition-colors hover:bg-maroon hover:text-ivory disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isReady ? "Add to cart" : "Loading cart"}
      </button>
    </div>
  );
}
