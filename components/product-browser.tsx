"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/data/products";

export function ProductBrowser({
  initialCategory,
  categories,
  products,
}: {
  initialCategory: string;
  categories: Array<{ slug: string; name: string }>;
  products: Product[];
}) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(
    categories.some((category) => category.slug === initialCategory)
      ? initialCategory
      : "all",
  );

  const visibleProducts = useMemo(
    () =>
      products.filter((product) =>
        (selectedCategory === "all" || product.category === selectedCategory) &&
        `${product.name} ${product.description}`.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [products, search, selectedCategory],
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
        {categories.map((category) => (
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
      <label className="mt-6 block max-w-md text-sm font-medium text-brown">
        Search sweets
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by product name"
          className="mt-2 min-h-11 w-full border border-gold/60 px-3"
        />
      </label>
      <p className="sr-only" aria-live="polite">
        Showing {visibleProducts.length} products
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
            No products match this selection.
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
