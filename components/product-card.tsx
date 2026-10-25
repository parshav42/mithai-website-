import Image from "next/image";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { type Product } from "@/data/products";

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group min-w-0">
      <a
        href={`/products/${product.slug}`}
        className="block"
        aria-label={`View ${product.name} details`}
      >
        <div className="relative aspect-[1.08/1] overflow-hidden bg-[#ead9bb]">
          <Image
            src={product.image}
            alt={product.imageAlt}
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.035]"
          />
          <span className="absolute bottom-3 left-3 bg-ivory px-2.5 py-1 text-[0.58rem] font-semibold tracking-[0.1em] text-brown">
            {product.isDemonstration ? "DEMONSTRATION ITEM" : "SHOP PRODUCT"}
          </span>
        </div>
        <div className="border-b border-gold/35 py-4 sm:py-5">
          <h3 className="font-display text-xl leading-tight text-brown sm:text-2xl">
            {product.name}
          </h3>
          <p className="mt-1.5 text-xs leading-5 text-brown/75">
            {product.isDemonstration
              ? "Example only · not confirmed shop inventory"
              : "Product details supplied by the shop"}
          </p>
        </div>
      </a>
      <div className="pt-3">
        <AddToCartButton product={product} />
      </div>
    </article>
  );
}
