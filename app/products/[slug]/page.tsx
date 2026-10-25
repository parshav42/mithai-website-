import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { Container } from "@/components/container";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { StorefrontRefreshWatcher } from "@/components/storefront-refresh-watcher";
import { getStorefrontProductBySlug } from "@/lib/products";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getStorefrontProductBySlug(slug);
  if (!product) return { title: "Sweet not found | Mithai House" };

  return {
    title: `${product.name} | Mithai House`,
    description: product.description,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getStorefrontProductBySlug(slug);
  if (!product) notFound();

  return (
    <>
      <StorefrontRefreshWatcher />
      <Navbar />
      <main id="main-content" className="bg-white">
        <Container className="py-8 sm:py-12">
          <Link
            href="/products"
            className="text-sm font-semibold text-maroon underline decoration-gold underline-offset-4 hover:text-brown"
          >
            Back to mithai
          </Link>
          <div className="mt-7 grid items-start gap-8 md:grid-cols-2 md:gap-12 lg:gap-16">
            <figure className="relative aspect-[1.08/1] overflow-hidden bg-[#ead9bb]">
              <Image
                src={product.image}
                alt={product.imageAlt}
                fill
                priority
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
              {product.stockQuantity === 0 ? <span className="absolute bottom-3 left-3 bg-ivory px-2.5 py-1.5 text-[0.58rem] font-semibold tracking-[0.1em] text-brown">OUT OF STOCK</span> : null}
            </figure>
            <div className="py-1 sm:py-5">
              <p className="eyebrow">{product.categoryName ?? "Mithai"}</p>
              <h1 className="mt-3 font-display text-4xl leading-tight tracking-[-0.04em] text-maroon sm:text-5xl">
                {product.name}
              </h1>
              <p className="mt-5 text-base leading-7 text-brown/80">{product.description}</p>

              <div className="mt-7 border-y border-gold/40 py-5">
                <p className="text-sm font-semibold text-maroon">
                  {product.stockQuantity === 0
                    ? "Out of stock"
                    : product.availability === "unavailable"
                    ? "Currently unavailable"
                    : product.isDemonstration
                      ? "Demonstration listing · not confirmed shop inventory"
                      : product.availability === "available"
                        ? "Available"
                        : "Availability pending"}
                </p>
                <p className="mt-2 text-sm leading-6 text-brown/75">
                  {product.packageSize ? `Package size: ${product.packageSize}. ` : ""}
                  {product.stockQuantity === 0 ? "Please check back later for availability." : `Stock available: ${product.stockQuantity}.`}
                </p>
              </div>

              <div className="mt-6 max-w-sm">
                <AddToCartButton product={product} />
              </div>
              <p className="mt-5 text-xs leading-5 text-brown/65">
                Checkout checks the current price and stock against the shop inventory before an order is created.
              </p>
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
