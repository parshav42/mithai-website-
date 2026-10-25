import type { Metadata } from "next";
import { Container } from "@/components/container";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ProductBrowser } from "@/components/product-browser";

export const metadata: Metadata = {
  title: "Mithai | Mithai House",
  description: "Browse demonstration examples of traditional Indian sweets.",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category = "all" } = await searchParams;

  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-[60vh]">
        <section className="border-b border-gold/30 bg-ivory py-12 sm:py-16">
          <Container>
            <p className="eyebrow">Explore the collection</p>
            <h1 className="section-heading mt-3 text-maroon">Mithai, to discover</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-brown/80 sm:text-base sm:leading-7">
              This is a demonstration catalog, not confirmed shop inventory. Product
              availability and prices will be added once supplied by the shop.
            </p>
          </Container>
        </section>
        <section className="section-space bg-white">
          <Container>
            <ProductBrowser initialCategory={category} />
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
