"use client";

import Image from "next/image";
import { useMemo, useState, type FormEvent } from "react";
import type { Product } from "@/data/products";

type ProductFormValue = {
  id?: string;
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  packageSize: string;
  priceRupees: string;
  originalPriceRupees: string;
  stockQuantity: number;
  isAvailable: boolean;
  isFeatured: boolean;
};

const DEFAULT_IMAGE = "/images/mithai-assortment.jpg";
const EMPTY_FORM: ProductFormValue = {
  name: "",
  description: "",
  imageUrl: DEFAULT_IMAGE,
  category: "",
  packageSize: "500 g",
  priceRupees: "",
  originalPriceRupees: "",
  stockQuantity: 0,
  isAvailable: true,
  isFeatured: false,
};

function toRupees(paise: number | null | undefined) {
  return paise == null ? "" : `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, "0")}`;
}

function toForm(product: Product): ProductFormValue {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    imageUrl: product.image,
    category: product.categoryName ?? product.category,
    packageSize: product.packageSize ?? "",
    priceRupees: toRupees(product.priceInPaise),
    originalPriceRupees: toRupees(product.originalPriceInPaise),
    stockQuantity: product.stockOnHand ?? product.stockQuantity ?? 0,
    isAvailable: product.availability === "available",
    isFeatured: product.isFeatured ?? false,
  };
}

export function ProductsManager({
  initialProducts,
  inventoryView = false,
}: {
  initialProducts: Product[];
  inventoryView?: boolean;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [form, setForm] = useState<ProductFormValue | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const categories = [...new Set(products.map((product) => product.categoryName ?? product.category))].sort();
  const visibleProducts = useMemo(() => products.filter((product) => {
    const matchesSearch = `${product.name} ${product.description}`.toLowerCase().includes(search.trim().toLowerCase());
    const matchesCategory = category === "all" || (product.categoryName ?? product.category) === category;
    const matchesAvailability = availability === "all" ||
      (availability === "archived" ? product.archived : availability === "available"
        ? !product.archived && product.availability === "available" && (product.stockQuantity ?? 0) > 0
        : !product.archived && (product.availability !== "available" || (product.stockQuantity ?? 0) === 0));
    return matchesSearch && matchesCategory && matchesAvailability &&
      (!inventoryView || (product.stockQuantity ?? 0) <= 10);
  }), [availability, category, inventoryView, products, search]);

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setNotice(null);
    try {
      const { id, ...payload } = form;
      const response = await fetch("/api/admin/products", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id, ...payload } : payload),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(getError(result, "Product could not be saved."));
      const refreshed = await fetch("/api/admin/products", { cache: "no-store" });
      const data: unknown = await refreshed.json();
      if (!refreshed.ok || !isProductList(data)) {
        throw new Error("Product was saved, but the product list could not be refreshed.");
      }
      setProducts(data.products);
      setForm(null);
      setNotice({ type: "success", text: id ? "Product updated." : "Product added." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Product could not be saved." });
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(file: File | undefined) {
    if (!file || !form) return;
    setUploading(true);
    setNotice(null);
    try {
      const body = new FormData();
      body.set("image", file);
      const response = await fetch("/api/admin/products/image", { method: "POST", body });
      const result: unknown = await response.json();
      if (!response.ok || !isUploadResult(result)) {
        throw new Error(getError(result, "Image upload failed."));
      }
      setForm({ ...form, imageUrl: result.url });
      setNotice({ type: "success", text: "Image uploaded. Save the product to publish it." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Image upload failed." });
    } finally {
      setUploading(false);
    }
  }

  async function archive(product: Product) {
    if (!window.confirm(`Archive ${product.name}? It will disappear from the storefront, but existing order history will be retained.`)) return;
    setNotice(null);
    try {
      const response = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, archived: true }),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(getError(result, "Product could not be archived."));
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, archived: true } : item));
      setNotice({ type: "success", text: `${product.name} archived.` });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Product could not be archived." });
    }
  }

  return (
    <section>
      {notice ? <p role={notice.type === "error" ? "alert" : "status"} className={`mb-4 border p-3 text-sm ${notice.type === "error" ? "border-red-300 bg-red-50 text-red-900" : "border-green-300 bg-green-50 text-green-900"}`}>{notice.text}</p> : null}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brown/70">{visibleProducts.length} product{visibleProducts.length === 1 ? "" : "s"}</p>
        <button type="button" onClick={() => setForm({ ...EMPTY_FORM })} className="min-h-11 bg-maroon px-5 text-sm font-semibold text-ivory hover:bg-brown">Add Product</button>
      </div>
      {form ? (
        <form onSubmit={submitProduct} className="mb-6 grid gap-4 border border-gold/40 bg-white p-4 sm:grid-cols-2 sm:p-6">
          <h2 className="font-display text-2xl text-maroon sm:col-span-2">{form.id ? "Edit product" : "Add product"}</h2>
          <label className="text-sm font-medium">Product name<input required minLength={2} maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 min-h-11 w-full border border-brown/25 px-3" /></label>
          <label className="text-sm font-medium">Category<input required maxLength={80} list="product-categories" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="mt-1 min-h-11 w-full border border-brown/25 px-3" /><datalist id="product-categories">{categories.map((item) => <option key={item} value={item} />)}</datalist></label>
          <label className="text-sm font-medium sm:col-span-2">Description<textarea required maxLength={2000} rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1 w-full border border-brown/25 p-3" /></label>
          <label className="text-sm font-medium">Package size / weight<input required maxLength={40} placeholder="500 g" value={form.packageSize} onChange={(event) => setForm({ ...form, packageSize: event.target.value })} className="mt-1 min-h-11 w-full border border-brown/25 px-3" /></label>
          <label className="text-sm font-medium">Selling price (INR)<input required type="number" min="0.01" max="1000000000" step="0.01" value={form.priceRupees} onChange={(event) => setForm({ ...form, priceRupees: event.target.value })} className="mt-1 min-h-11 w-full border border-brown/25 px-3" /></label>
          <label className="text-sm font-medium">Original price (optional, INR)<input type="number" min="0.01" max="1000000000" step="0.01" value={form.originalPriceRupees} onChange={(event) => setForm({ ...form, originalPriceRupees: event.target.value })} className="mt-1 min-h-11 w-full border border-brown/25 px-3" /></label>
          <label className="text-sm font-medium">Stock on hand<input required type="number" min="0" max="1000000" step="1" value={form.stockQuantity} onChange={(event) => setForm({ ...form, stockQuantity: Number(event.target.value) })} className="mt-1 min-h-11 w-full border border-brown/25 px-3" /></label>
          <div className="sm:col-span-2">
            <span className="block text-sm font-medium">Product image</span>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <Image src={form.imageUrl} alt="Product preview" width={96} height={96} unoptimized className="size-24 object-cover" />
              <label className="text-sm">Upload JPG, PNG, or WebP (max 4 MB)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => void uploadImage(event.currentTarget.files?.[0])} className="mt-2 block max-w-full text-sm" /></label>
              {uploading ? <span role="status">Uploading…</span> : null}
            </div>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={form.isAvailable} onChange={(event) => setForm({ ...form, isAvailable: event.target.checked })} />Available for purchase</label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={form.isFeatured} onChange={(event) => setForm({ ...form, isFeatured: event.target.checked })} />Featured product</label>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button type="submit" disabled={saving || uploading} className="min-h-11 bg-maroon px-5 text-sm font-semibold text-ivory disabled:opacity-50">{saving ? "Saving…" : "Save Product"}</button>
            <button type="button" onClick={() => setForm(null)} className="min-h-11 border border-maroon px-5 text-sm font-semibold text-maroon">Cancel</button>
          </div>
        </form>
      ) : null}
      <div className="mb-4 grid gap-3 border border-gold/30 bg-white p-4 sm:grid-cols-3">
        <label className="text-xs font-semibold">Search products<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or description" className="mt-1 min-h-10 w-full border border-brown/25 px-3 text-sm font-normal" /></label>
        <label className="text-xs font-semibold">Category<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 min-h-10 w-full border border-brown/25 bg-white px-3 text-sm font-normal"><option value="all">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="text-xs font-semibold">Availability<select value={availability} onChange={(event) => setAvailability(event.target.value)} className="mt-1 min-h-10 w-full border border-brown/25 bg-white px-3 text-sm font-normal"><option value="all">All products</option><option value="available">Available and in stock</option><option value="unavailable">Unavailable / out of stock</option><option value="archived">Archived</option></select></label>
      </div>
      <div className="overflow-x-auto border border-gold/30 bg-white">
        <table className="w-full min-w-[850px] border-collapse text-left text-sm">
          <thead className="bg-maroon text-ivory"><tr>{["Product", "Category", "Price", "Stock", "Availability", "Actions"].map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead>
          <tbody>
            {visibleProducts.map((product) => (
              <tr key={product.id} className="border-b border-gold/20 last:border-0">
                <td className="px-4 py-3"><div className="flex items-center gap-3"><Image src={product.image} alt="" width={48} height={48} unoptimized className="size-12 object-cover" /><div><p className="font-semibold">{product.name}</p><p className="text-xs text-brown/60">{product.packageSize}</p>{product.archived ? <span className="text-xs text-maroon">Archived</span> : null}</div></div></td>
                <td className="px-4 py-3">{product.categoryName ?? product.category}</td>
                <td className="px-4 py-3">₹{toRupees(product.priceInPaise)}</td>
                <td className="px-4 py-3">{product.stockQuantity ?? 0}</td>
                <td className="px-4 py-3">{product.archived ? "Archived" : product.availability === "available" ? "Available" : "Unavailable"}</td>
                <td className="px-4 py-3"><div className="flex gap-3"><button type="button" disabled={product.archived} onClick={() => setForm(toForm(product))} className="font-semibold text-maroon underline disabled:opacity-40">Edit</button>{!product.archived ? <button type="button" onClick={() => void archive(product)} className="font-semibold text-maroon underline">Archive</button> : null}</div></td>
              </tr>
            ))}
            {visibleProducts.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-brown/65">No products match these filters.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function getError(value: unknown, fallback: string) {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string"
    ? value.error
    : fallback;
}

function isProductList(value: unknown): value is { products: Product[] } {
  return typeof value === "object" && value !== null && "products" in value && Array.isArray(value.products);
}

function isUploadResult(value: unknown): value is { url: string } {
  return typeof value === "object" && value !== null && "url" in value && typeof value.url === "string";
}
