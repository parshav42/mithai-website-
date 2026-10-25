import { ArrowDown, ArrowRight, Sparkles } from "lucide-react";
import { AnnouncementBar } from "@/components/announcement-bar";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { ProductCard } from "@/components/product-card";

const categories = [
  { name: "Kaju Katli", detail: "A beloved classic", style: "ivory" },
  { name: "Ladoo", detail: "A festive favourite", style: "saffron" },
  { name: "Barfi", detail: "A timeless treat", style: "maroon" },
  { name: "Rasgulla", detail: "A soft, syrupy sweet", style: "ivory" },
  { name: "Peda", detail: "A cherished tradition", style: "maroon" },
  { name: "Jalebi", detail: "A golden indulgence", style: "saffron" },
] as const;

const products = [
  { name: "Kaju Katli", style: "ivory" },
  { name: "Motichoor Ladoo", style: "saffron" },
  { name: "Pista Barfi", style: "maroon" },
] as const;

export default function Home() {
  return (
    <>
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
          <Container className="grid min-h-[35rem] items-center gap-10 py-12 md:min-h-[39rem] md:grid-cols-[1.02fr_0.98fr] md:gap-8 md:py-16">
            <div className="relative z-10 max-w-xl">
              <p className="eyebrow flex items-center gap-2">
                <span className="h-px w-8 bg-gold" />
                A sweeter kind of together
              </p>
              <h1 className="mt-5 font-display text-[clamp(3.5rem,8vw,6.5rem)] leading-[0.98] tracking-[-0.055em] text-maroon">
                A Tradition
                <br />
                of Sweetness<span className="text-gold">.</span>
              </h1>
              <p className="mt-6 max-w-md text-base leading-7 text-brown/75 sm:text-lg sm:leading-8">
                Discover beloved Indian sweets, thoughtfully prepared for life&apos;s sweetest
                moments.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button href="#bestsellers">
                  Shop Mithai <ArrowRight aria-hidden="true" size={16} />
                </Button>
                <Button href="#gifting" variant="outline">
                  Explore Gift Boxes
                </Button>
              </div>
              <p className="mt-7 text-xs leading-5 text-brown/55">
                Product range and imagery are illustrative placeholders pending shop details.
              </p>
            </div>
            <div
              role="img"
              aria-label="Decorative hero image placeholder; shop photography to be provided"
              className="placeholder-art placeholder-art--maroon relative mx-auto flex aspect-[1.12/1] w-full max-w-[34rem] items-center justify-center md:aspect-[0.94/1]"
            >
              <div className="absolute inset-[9%] border border-gold/50" />
              <div className="relative flex size-[66%] items-center justify-center rounded-full border border-gold/50">
                <div className="absolute inset-[10%] rounded-full border border-ivory/25" />
                <div className="text-center text-ivory">
                  <Sparkles aria-hidden="true" className="mx-auto mb-4 text-gold" size={25} />
                  <p className="font-display text-3xl leading-tight sm:text-4xl">
                    Sweetness,
                    <br />
                    shared.
                  </p>
                  <p className="mt-4 text-[0.6rem] font-semibold tracking-[0.2em] text-ivory/70">
                    HERO PHOTO PLACEHOLDER
                  </p>
                </div>
              </div>
              <span className="absolute bottom-5 left-5 text-[0.6rem] font-semibold tracking-[0.16em] text-ivory/70">
                TRADITION · TOGETHERNESS · TREAT
              </span>
            </div>
          </Container>
          <a
            href="#categories"
            aria-label="Scroll to mithai categories"
            className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 text-maroon/60 transition-colors hover:text-maroon md:block"
          >
            <ArrowDown aria-hidden="true" size={20} />
          </a>
        </section>

        <section id="categories" className="section-space bg-white">
          <Container>
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="eyebrow">Something for every sweet tooth</p>
                <h2 className="section-heading mt-3 text-brown">Explore mithai</h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-brown/65">
                A first look at much-loved Indian sweet varieties. The shop&apos;s actual
                assortment is to be confirmed.
              </p>
            </div>
            <div className="mt-9 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-6 lg:mt-12 lg:gap-x-8">
              {categories.map((category) => (
                <a
                  key={category.name}
                  href="#bestsellers"
                  className="group min-w-0"
                  aria-label={`Explore ${category.name} in the illustrative mithai assortment`}
                >
                  <div
                    role="img"
                    aria-label={`${category.name} image placeholder; product photography to be provided`}
                    className={`placeholder-art ${category.style === "maroon" ? "placeholder-art--maroon" : category.style === "saffron" ? "placeholder-art--saffron" : ""} relative aspect-[1.1/1] transition-transform duration-300 group-hover:scale-[1.015]`}
                  >
                    <span className="absolute inset-x-2 bottom-2 mx-auto w-fit bg-ivory/90 px-2 py-1 text-[0.52rem] font-semibold tracking-[0.08em] text-brown sm:bottom-3 sm:text-[0.58rem]">
                      PHOTO PLACEHOLDER
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-1 pt-3 sm:pt-4">
                    <div className="min-w-0">
                      <h3 className="font-display text-lg leading-tight text-brown sm:text-2xl">
                        {category.name}
                      </h3>
                      <p className="mt-1 text-xs text-brown/60 sm:text-sm">{category.detail}</p>
                    </div>
                    <ArrowRight
                      aria-hidden="true"
                      size={16}
                      className="mt-1 shrink-0 text-gold transition-transform group-hover:translate-x-1"
                    />
                  </div>
                </a>
              ))}
            </div>
          </Container>
        </section>

        <section id="bestsellers" className="section-space bg-ivory">
          <Container>
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="eyebrow">A taste of the classics</p>
                <h2 className="section-heading mt-3 text-brown">Beloved, by tradition</h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-brown/65">
                Representative mithai only. Product availability, ingredients and pricing
                have not yet been provided by the shop.
              </p>
            </div>
            <div className="mt-9 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:mt-12 lg:gap-8">
              {products.map((product) => (
                <ProductCard key={product.name} {...product} />
              ))}
            </div>
          </Container>
        </section>

        <section id="gifting" className="bg-maroon">
          <Container className="grid items-center gap-8 py-12 sm:py-16 md:grid-cols-[1fr_auto] md:gap-12 md:py-20">
            <div className="max-w-2xl">
              <p className="eyebrow text-gold">A thoughtful way to say it</p>
              <h2 className="mt-3 font-display text-4xl leading-tight tracking-[-0.035em] text-ivory sm:text-5xl">
                Make a little room for sweetness.
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-6 text-ivory/75 sm:text-base">
                Explore the idea of sharing mithai with someone special. Gift box designs
                and availability will be added once confirmed.
              </p>
            </div>
            <p className="max-w-60 border border-gold/50 px-4 py-3 text-xs leading-5 text-ivory/80">
              Gift box designs and availability will be shared once confirmed by the shop.
            </p>
          </Container>
        </section>

        <section id="our-story" className="section-space bg-white">
          <Container className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
            <div
              role="img"
              aria-label="Decorative image placeholder; shop and maker photography to be provided"
              className="placeholder-art placeholder-art--saffron relative aspect-[1.2/1] md:aspect-[1.05/1]"
            >
              <span className="absolute inset-x-3 bottom-3 mx-auto w-fit bg-ivory/90 px-3 py-1.5 text-[0.58rem] font-semibold tracking-[0.1em] text-brown">
                OUR STORY PHOTO PLACEHOLDER
              </span>
            </div>
            <div className="max-w-lg">
              <p className="eyebrow">A story still being written</p>
              <h2 className="section-heading mt-3 text-brown">Rooted in the joy of sharing.</h2>
              <p className="mt-5 text-base leading-7 text-brown/75">
                Every sweet has a place at the table: a celebration, a visit, a small
                moment made memorable. We&apos;re preparing this space to tell the story of
                the people and traditions behind this shop.
              </p>
              <p className="mt-4 text-sm leading-6 text-brown/60">
                The shop&apos;s history and details will be added when shared by the business.
              </p>
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
