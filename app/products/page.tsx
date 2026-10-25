import type { Metadata } from "next";
import { Container } from "@/components/container";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { StorefrontRefreshWatcher } from "@/components/storefront-refresh-watcher";
import { ProductBrowser } from "@/components/product-browser";
import { listStorefrontCategories, listStorefrontProducts } from "@/lib/products";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Mithai | Mithai House",
  description: "Browse fresh sweets and traditional Indian mithai.",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const [{ category = "all" }, products, categories] = await Promise.all([
    searchParams,
    listStorefrontProducts(),
    listStorefrontCategories(),
  ]);

  return (
    <>
      <StorefrontRefreshWatcher />
      <Navbar />
      <main id="main-content" className="min-h-[60vh]">
        <section className="border-b border-gold/30 bg-ivory py-12 sm:py-16">
          <Container>
            <p className="eyebrow">Explore the collection</p>
            <h1 className="section-heading mt-3 text-maroon">Mithai, to discover</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-brown/80 sm:text-base sm:leading-7">
              Discover freshly listed sweets, with current prices and availability from the shop.
            </p>
          </Container>
        </section>
        <section className="section-space bg-white">
          <Container>
            <ProductBrowser initialCategory={category} products={products} categories={categories} />
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
