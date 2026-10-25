import type { Metadata } from "next";
import { AdminPageHeading } from "@/components/admin/admin-shell";
import { ProductsManager } from "@/components/admin/products-manager";
import { listAdminProducts } from "@/lib/products";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Products | Mithai House Admin" };

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ view }, products] = await Promise.all([searchParams, listAdminProducts()]);
  return (
    <>
      <AdminPageHeading
        eyebrow="Shop operations"
        title={view === "inventory" ? "Inventory" : "Products"}
        description="Manage live product details, availability, pricing, and stock. Archived products remain in historical order records."
      />
      <ProductsManager initialProducts={products} inventoryView={view === "inventory"} />
    </>
  );
}
