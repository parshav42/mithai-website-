"use client";

import { useEffect } from "react";
import { Container } from "@/components/container";

export default function ProductsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Product catalog failed to load:", error);
  }, [error]);

  return (
    <main className="bg-ivory">
      <Container className="py-20 text-center">
        <h1 className="font-display text-3xl text-maroon">The catalog could not load</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-brown/80">
          Please try again. If the problem continues, the shop&apos;s catalog may need
          attention.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 min-h-11 border border-maroon px-5 text-sm font-semibold text-maroon hover:bg-maroon hover:text-ivory"
        >
          Try again
        </button>
      </Container>
    </main>
  );
}
