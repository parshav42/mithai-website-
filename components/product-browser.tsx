"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/product-card";
import { productCategories, products } from "@/data/products";

export function ProductBrowser({ initialCategory }: { initialCategory: string }) {
  const [selectedCategory, setSelectedCategory] = useState(
    productCategories.some((category) => category.slug === initialCategory)
      ? initialCategory
      : "all",
  );

  const visibleProducts = useMemo(
    () =>
      selectedCategory === "all"
        ? products
        : products.filter((product) => product.category === selectedCategory),
    [selectedCategory],
  );

  return (
    <>
      <div className="mt-8 flex flex-wrap gap-2 sm:mt-10" aria-label="Filter by category">
        <button
          type="button"
          aria-pressed={selectedCategory === "all"}
          onClick={() => setSelectedCategory("all")}
          className={`min-h-11 border px-4 text-sm transition-colors ${selectedCategory === "all" ? "border-maroon bg-maroon text-ivory" : "border-gold/55 text-brown hover:border-maroon hover:text-maroon"}`}
        >
          All sweets
        </button>
        {productCategories.map((category) => (
          <button
            key={category.slug}
            type="button"
            aria-pressed={selectedCategory === category.slug}
            onClick={() => setSelectedCategory(category.slug)}
            className={`min-h-11 border px-4 text-sm transition-colors ${selectedCategory === category.slug ? "border-maroon bg-maroon text-ivory" : "border-gold/55 text-brown hover:border-maroon hover:text-maroon"}`}
          >
            {category.name}
          </button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        Showing {visibleProducts.length} demonstration products
      </p>
      {visibleProducts.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-3 lg:gap-x-8">
          {visibleProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="mt-12 border-y border-gold/40 py-12 text-center">
          <h2 className="font-display text-2xl text-brown">No sweets in this selection yet</h2>
          <p className="mt-2 text-sm text-brown/75">
            This category has no catalog examples at the moment.
          </p>
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className="mt-5 min-h-11 border border-maroon px-5 text-sm font-semibold text-maroon hover:bg-maroon hover:text-ivory"
          >
            View all sweets
          </button>
        </div>
      )}
    </>
  );
}
