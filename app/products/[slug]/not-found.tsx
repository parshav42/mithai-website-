import Link from "next/link";
import { Container } from "@/components/container";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";

export default function ProductNotFound() {
  return (
    <>
      <Navbar />
      <main className="bg-ivory">
        <Container className="py-20 text-center sm:py-28">
          <p className="eyebrow">Not in this collection</p>
          <h1 className="mt-3 font-display text-4xl text-maroon">We couldn&apos;t find that sweet.</h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-brown/80">
            This item may have moved or is not part of the current demonstration catalog.
          </p>
          <Link
            href="/products"
            className="mt-7 inline-flex min-h-11 items-center border border-maroon px-5 text-sm font-semibold text-maroon hover:bg-maroon hover:text-ivory"
          >
            Browse mithai
          </Link>
        </Container>
      </main>
      <Footer />
    </>
  );
}
