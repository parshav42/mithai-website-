"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Container } from "@/components/container";
import { useCart } from "@/components/cart-provider";
import {
  formatPrice,
  getProductById,
  isPurchasable,
  products,
} from "@/data/products";

export function CartPage() {
  const {
    items,
    itemCount,
    subtotalInPaise,
    isReady,
    setQuantity,
    removeItem,
  } = useCart();

  if (!isReady) {
    return (
      <main aria-busy="true" className="bg-white">
        <Container className="section-space">
          <div className="h-10 w-56 animate-pulse bg-gold/20" />
          <div className="mt-8 h-40 animate-pulse bg-gold/15" />
        </Container>
      </main>
    );
  }

  const cartLines = Object.entries(items)
    .map(([productId, quantity]) => ({
      product: getProductById(productId),
      quantity,
    }))
    .filter((line): line is { product: (typeof products)[number]; quantity: number } =>
      Boolean(line.product),
    );
  const unavailableItems = cartLines.filter((line) => !isPurchasable(line.product));

  if (cartLines.length === 0) {
    return (
      <main id="main-content" className="bg-white">
        <Container className="section-space text-center">
          <p className="eyebrow">A little room for something sweet</p>
          <h1 className="section-heading mt-3 text-maroon">Your cart is empty</h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-brown/80">
            Browse the demonstration catalog. Example items cannot be purchased until the
            shop confirms prices and availability.
          </p>
          <Link
            href="/products"
            className="mt-7 inline-flex min-h-12 items-center justify-center border border-maroon bg-maroon px-6 text-sm font-semibold text-ivory hover:bg-brown"
          >
            Continue shopping
          </Link>
        </Container>
      </main>
    );
  }

  return (
    <main id="main-content" className="bg-white">
      <Container className="section-space">
        <p className="eyebrow">Your selection</p>
        <h1 className="section-heading mt-3 text-maroon">Shopping cart</h1>
        <p className="mt-2 text-sm text-brown/75">
          {itemCount} {itemCount === 1 ? "item" : "items"} · saved in this browser
        </p>
        <div className="mt-8 grid gap-9 lg:grid-cols-[1fr_20rem] lg:gap-14">
          <ul className="divide-y divide-gold/35 border-y border-gold/35">
            {cartLines.map(({ product, quantity }) => {
              const purchasable = isPurchasable(product);

              return (
                <li key={product.id} className="grid grid-cols-[5rem_1fr] gap-4 py-5 sm:grid-cols-[7rem_1fr] sm:gap-6">
                  <a
                    href={`/products/${product.slug}`}
                    aria-label={`View ${product.name}`}
                    className="relative aspect-square overflow-hidden bg-[#ead9bb]"
                  >
                    <Image
                      src={product.image}
                      alt={product.imageAlt}
                      fill
                      sizes="112px"
                      className="object-cover"
                    />
                  </a>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <a
                          href={`/products/${product.slug}`}
                          className="font-display text-xl text-brown underline decoration-gold/60 underline-offset-4 hover:text-maroon sm:text-2xl"
                        >
                          {product.name}
                        </a>
                        <p className="mt-1 text-xs text-brown/70">
                          {product.isDemonstration
                            ? "Demonstration item · not confirmed shop inventory"
                            : "Shop product"}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-maroon">
                        {purchasable
                          ? formatPrice(product.priceInPaise * quantity)
                          : "Price pending"}
                      </p>
                    </div>
                    {!purchasable && (
                      <p className="mt-3 text-xs font-semibold leading-5 text-brown/80">
                        This item is not purchasable until price and availability are confirmed.
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="inline-flex items-center border border-gold/60">
                        <button
                          type="button"
                          aria-label={`Decrease ${product.name} quantity`}
                          disabled={!purchasable || quantity <= 1}
                          onClick={() => setQuantity(product.id, quantity - 1)}
                          className="flex size-10 items-center justify-center text-maroon hover:bg-ivory disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Minus aria-hidden="true" size={15} />
                        </button>
                        <span
                          aria-label={`Quantity ${quantity}`}
                          className="min-w-9 text-center text-sm font-semibold text-brown"
                        >
                          {quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase ${product.name} quantity`}
                          disabled={!purchasable || quantity >= 99}
                          onClick={() => setQuantity(product.id, quantity + 1)}
                          className="flex size-10 items-center justify-center text-maroon hover:bg-ivory disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Plus aria-hidden="true" size={15} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(product.id)}
                        className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-maroon underline decoration-gold/60 underline-offset-4 hover:text-brown"
                      >
                        <Trash2 aria-hidden="true" size={15} />
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <aside className="h-fit border border-gold/45 bg-ivory p-5 sm:p-6">
            <h2 className="font-display text-2xl text-brown">Order summary</h2>
            <div className="mt-5 flex justify-between gap-4 border-t border-gold/40 pt-4 text-sm">
              <span>Subtotal</span>
              <span className="font-semibold text-maroon">
                {unavailableItems.length > 0
                  ? `${formatPrice(subtotalInPaise)}*`
                  : formatPrice(subtotalInPaise)}
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-brown/75">
              This browser-calculated subtotal is not authoritative for payment or order
              placement. Delivery and other charges are not calculated.
            </p>
            {unavailableItems.length > 0 && (
              <p className="mt-2 text-xs leading-5 text-brown/75">
                * Includes priced, available items only; items awaiting shop confirmation
                are excluded.
              </p>
            )}
            <button
              type="button"
              disabled
              className="mt-6 min-h-12 w-full border border-brown/30 bg-brown/10 px-4 text-sm font-semibold text-brown/60"
            >
              Checkout not available
            </button>
            <p className="mt-3 text-xs leading-5 text-brown/75">
              {unavailableItems.length > 0
                ? "Items with unconfirmed prices cannot be purchased. Checkout will be enabled after shop details are configured."
                : "Checkout and payments have not been set up."}
            </p>
            <Link
              href="/products"
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center border border-maroon px-4 text-sm font-semibold text-maroon hover:bg-maroon hover:text-ivory"
            >
              Continue shopping
            </Link>
          </aside>
        </div>
      </Container>
    </main>
  );
}
