import Image from "next/image";
import { ArrowDown, ArrowRight } from "lucide-react";
import { AnnouncementBar } from "@/components/announcement-bar";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { ProductCard } from "@/components/product-card";
import { StorefrontRefreshWatcher } from "@/components/storefront-refresh-watcher";
import { listStorefrontCategories, listStorefrontProducts } from "@/lib/products";

export const dynamic = "force-dynamic";

const categoryArtwork: Record<string, string> = {
  "kaju-katli": "50% 45%",
  ladoo: "50% 45%",
  barfi: "76% 65%",
  rasgulla: "27% 28%",
  peda: "72% 35%",
  jalebi: "50% 52%",
};

export default async function Home() {
  const [products, productCategories] = await Promise.all([
    listStorefrontProducts(),
    listStorefrontCategories(),
  ]);
  const featuredProducts = products.filter((product) => product.isFeatured).slice(0, 3);
  const homeProducts = featuredProducts.length ? featuredProducts : products.slice(0, 3);
  return (
    <>
      <StorefrontRefreshWatcher />
      <a
        href="#main-content"
        className="sr-only z-50 bg-ivory p-3 text-maroon focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <AnnouncementBar />
      <Navbar />
      <main id="main-content">
        <section id="home" className="relative overflow-hidden bg-ivory">
          <Container className="grid items-center gap-9 py-9 sm:gap-12 sm:py-12 md:min-h-[39rem] md:grid-cols-[0.92fr_1.08fr] md:gap-8 md:py-14 lg:gap-14">
            <div className="relative z-10 max-w-xl md:py-8">
              <p className="eyebrow flex items-center gap-3">
                <span aria-hidden="true" className="h-px w-9 bg-gold" />
                A sweeter kind of together
              </p>
              <h1 className="mt-5 font-display text-[clamp(3.35rem,8.1vw,6.6rem)] leading-[0.95] tracking-[-0.055em] text-maroon">
                A Tradition
                <br />
                of Sweetness<span className="text-gold">.</span>
              </h1>
              <p className="mt-6 max-w-md text-base leading-7 text-brown/80 sm:text-lg sm:leading-8">
                Discover beloved Indian sweets, thoughtfully prepared for life&apos;s sweetest
                moments.
              </p>
              <div className="mt-8 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:flex-wrap">
                <Button href="/products" className="w-full min-[420px]:w-auto">
                  Shop Mithai <ArrowRight aria-hidden="true" size={16} />
                </Button>
                <Button
                  href="/#gifting"
                  variant="outline"
                  className="w-full min-[420px]:w-auto"
                >
                  Explore Gift Boxes
                </Button>
              </div>
              <p className="mt-5 text-xs leading-5 text-brown/75">
                Illustrative photography and example sweets. The shop&apos;s own range is to
                be confirmed.
              </p>
            </div>

            <figure className="relative mx-auto w-full max-w-[43rem] md:mr-0">
              <div className="relative aspect-[1.16/1] overflow-hidden border-[7px] border-white bg-[#d9b66f] sm:border-[10px] md:aspect-[0.98/1]">
                <Image
                  src="/images/hero-mithai.jpg"
                  alt="Illustrative photograph of assorted Indian mithai on ornate serving platters."
                  fill
                  priority
                  sizes="(min-width: 768px) 52vw, 100vw"
                  className="object-cover"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-3 border border-white/60 sm:inset-5"
                />
                <span className="absolute bottom-3 left-3 bg-ivory px-2.5 py-1.5 text-[0.58rem] font-semibold tracking-[0.12em] text-brown sm:bottom-5 sm:left-5">
                  ILLUSTRATIVE PHOTOGRAPH · UNSPLASH
                </span>
              </div>
              <figcaption className="mt-3 flex items-center justify-between gap-2 text-[0.58rem] font-semibold tracking-[0.15em] text-brown/75 sm:text-[0.65rem]">
                <span>TRADITION, SHARED</span>
                <span aria-hidden="true" className="h-px flex-1 bg-gold/60" />
                <span>INDIAN MITHAI</span>
              </figcaption>
            </figure>
          </Container>
          <a
            href="#categories"
            aria-label="Scroll to mithai categories"
            className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 text-maroon/70 transition-transform hover:translate-y-1 md:block"
          >
            <ArrowDown aria-hidden="true" size={19} />
          </a>
        </section>

        <section id="categories" className="section-space bg-white">
          <Container>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end sm:gap-8">
              <div>
                <p className="eyebrow">An introduction to Indian sweets</p>
                <h2 className="section-heading mt-3 text-brown">Explore mithai</h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-brown/75">
                Browse current favorites from the shop, with live availability and pricing.
              </p>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-7 sm:mt-11 sm:grid-cols-3 sm:gap-x-6 lg:gap-x-8">
              {productCategories.map((category, index) => {
                const representative = products.find(
                  (product) => product.category === category.slug,
                );
                if (!representative) return null;

                return (
                <article key={category.name} className="group min-w-0">
                  <figure>
                    <a
                      href={`/products?category=${category.slug}`}
                      aria-label={`Browse ${category.name}`}
                      className="block"
                    >
                    <div className="relative aspect-[1.07/1] overflow-hidden bg-[#ead9bb]">
                      <Image
                        src={representative.image}
                        alt={representative.imageAlt}
                        fill
                        sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 50vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        style={{ objectPosition: categoryArtwork[category.slug] ?? "50% 50%" }}
                      />
                      <span className="absolute bottom-2 left-2 bg-ivory px-2 py-1 text-[0.5rem] font-semibold tracking-[0.1em] text-brown sm:bottom-3 sm:left-3 sm:text-[0.58rem]">
                        ILLUSTRATIVE PHOTO
                      </span>
                    </div>
                    <figcaption className="flex items-center justify-between gap-2 border-b border-gold/35 py-3 sm:py-4">
                      <span className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <span className="font-sans text-[0.57rem] font-semibold tracking-[0.12em] text-maroon sm:text-[0.65rem]">
                          0{index + 1}
                        </span>
                        <span className="truncate font-display text-lg leading-tight text-brown sm:text-2xl">
                          {category.name}
                        </span>
                      </span>
                    </figcaption>
                    </a>
                  </figure>
                </article>
                );
              })}
            </div>
          </Container>
        </section>

        <section id="bestsellers" className="section-space bg-ivory">
          <Container>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end sm:gap-8">
              <div>
                <p className="eyebrow">A first taste of the classics</p>
                <h2 className="section-heading mt-3 text-brown">Sweet things to discover</h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-brown/75">
                Our product selection is managed directly by the shop and reflects current availability.
              </p>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-x-5 gap-y-8 sm:mt-11 sm:grid-cols-3 sm:gap-x-6 lg:gap-x-8">
              {homeProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </Container>
        </section>

        <section id="gifting" className="bg-maroon">
          <Container className="grid items-stretch py-8 sm:py-10 md:grid-cols-[1.03fr_0.97fr]">
            <figure className="relative min-h-64 overflow-hidden bg-[#8b5b32] sm:min-h-80 md:min-h-[25rem]">
              <Image
                src="/images/gifting-mithai.jpg"
                alt="Illustrative photograph of traditional Indian sweets on a festive platter."
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
              <span className="absolute bottom-3 left-3 bg-ivory px-2.5 py-1.5 text-[0.58rem] font-semibold tracking-[0.12em] text-brown">
                ILLUSTRATIVE PHOTOGRAPH · UNSPLASH
              </span>
            </figure>
            <div className="relative flex flex-col justify-center px-2 py-9 text-ivory sm:px-7 sm:py-12 md:px-10 lg:px-14">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-4 font-display text-7xl text-gold/20 sm:right-6 sm:top-6 sm:text-8xl"
              >
                ❧
              </span>
              <p className="eyebrow text-gold">For the moments we gather</p>
              <h2 className="mt-4 max-w-lg font-display text-4xl leading-[1.07] tracking-[-0.04em] text-ivory sm:text-5xl lg:text-6xl">
                A little sweetness, beautifully shared.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-6 text-ivory/85 sm:text-base sm:leading-7">
                Weddings, festivals and family celebrations bring people together.
                Bring a little sweetness to the occasion.
              </p>
              <p className="mt-6 border-t border-gold/45 pt-4 text-xs leading-5 text-ivory/80">
                Gift box styles, availability and delivery details are to be confirmed by
                the shop.
              </p>
            </div>
          </Container>
        </section>

        <section id="our-story" className="section-space bg-white">
          <Container className="grid items-center gap-8 sm:gap-12 md:grid-cols-[0.95fr_1.05fr] md:gap-16">
            <div className="relative max-w-xl md:order-2">
              <p className="eyebrow">Our story</p>
              <h2 className="section-heading mt-3 text-brown">
                Every shop has a story worth telling.
              </h2>
              <p className="mt-5 text-base leading-7 text-brown/80">
                This space is reserved for the shop&apos;s own history and the people behind
                it. We&apos;ll share their story here once it has been provided by the
                business.
              </p>
              <span
                aria-hidden="true"
                className="mt-7 block h-px w-16 bg-gold"
              />
            </div>
            <figure className="relative aspect-[1.12/1] overflow-hidden bg-[#ead9bb] md:order-1 md:aspect-[1.03/1]">
              <Image
                src="/images/ladoo.jpg"
                alt="Illustrative photograph of ladoos being shared on a silver platter."
                fill
                sizes="(min-width: 768px) 45vw, 100vw"
                className="object-cover"
              />
              <span className="absolute bottom-3 left-3 bg-ivory px-2.5 py-1.5 text-[0.58rem] font-semibold tracking-[0.12em] text-brown">
                ILLUSTRATIVE PHOTOGRAPH · UNSPLASH
              </span>
            </figure>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
