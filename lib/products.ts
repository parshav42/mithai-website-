import "server-only";
import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import type { Product } from "../data/products.ts";
import { getDatabasePool } from "./db.ts";
import type { ProductInput } from "./product-validation.ts";

type ProductRow = QueryResultRow & {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  category_name: string;
  category_slug: string;
  package_size: string;
  price_in_paise: string | number;
  original_price_in_paise: string | number | null;
  stock_quantity: number;
  stock_on_hand?: number;
  is_available: boolean;
  is_featured: boolean;
  archived_at: Date | null;
};

function safeMoney(value: string | number | null) {
  if (value === null) return null;
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error("Stored product price is outside the safe INR range.");
  }
  return amount;
}

function toProduct(row: ProductRow, includeStockOnHand = false): Product {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    image: row.image_url,
    imageAlt: row.name,
    category: row.category_slug,
    categoryName: row.category_name,
    availability: row.is_available ? "available" : "unavailable",
    priceInPaise: safeMoney(row.price_in_paise),
    originalPriceInPaise: safeMoney(row.original_price_in_paise),
    stockQuantity: row.stock_quantity,
    ...(includeStockOnHand ? { stockOnHand: row.stock_on_hand } : {}),
    packageSize: row.package_size,
    isFeatured: row.is_featured,
    isDemonstration: false,
    archived: row.archived_at !== null,
  };
}

const PRODUCT_SELECT = `
  SELECT p.id, p.name, p.slug, p.description, p.image_url,
         c.name AS category_name, c.slug AS category_slug,
         p.package_size, p.price_in_paise, p.original_price_in_paise,
         GREATEST(p.stock_quantity - COALESCE((
           SELECT SUM(oi.quantity) FROM stock_reservations sr
           JOIN order_items oi ON oi.order_id = sr.order_id
           WHERE sr.status = 'reserved' AND sr.reserved_until > NOW()
             AND oi.product_id = p.id::text
         ), 0), 0)::integer AS stock_quantity,
         p.stock_quantity AS stock_on_hand,
         p.is_available, p.is_featured, p.archived_at
  FROM products p
  JOIN product_categories c ON c.id = p.category_id`;

export async function listStorefrontProducts() {
  const result = await getDatabasePool().query<ProductRow>(
    `${PRODUCT_SELECT} WHERE p.archived_at IS NULL
     ORDER BY p.is_featured DESC, p.name`,
  );
  return result.rows.map((row) => toProduct(row));
}

export async function listAdminProducts() {
  const result = await getDatabasePool().query<ProductRow>(
    `${PRODUCT_SELECT} ORDER BY p.archived_at NULLS FIRST, p.updated_at DESC`,
  );
  return result.rows.map((row) => toProduct(row, true));
}

export async function getStorefrontProductBySlug(slug: string) {
  const result = await getDatabasePool().query<ProductRow>(
    `${PRODUCT_SELECT} WHERE p.slug = $1 AND p.archived_at IS NULL`,
    [slug],
  );
  return result.rows[0] ? toProduct(result.rows[0]) : null;
}

export async function listStorefrontCategories() {
  const result = await getDatabasePool().query<{ name: string; slug: string }>(
    `SELECT DISTINCT c.name, c.slug
     FROM product_categories c
     JOIN products p ON p.category_id = c.id
     WHERE p.archived_at IS NULL
     ORDER BY c.name`,
  );
  return result.rows;
}

function makeSlug(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || `mithai-${randomUUID().slice(0, 8)}`;
}

export async function saveProduct(id: string | null, input: ProductInput) {
  const client = await getDatabasePool().connect();
  const productId = id ?? randomUUID();
  try {
    await client.query("BEGIN");
    if (id) {
      const current = await client.query(
        `SELECT id FROM products WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (current.rowCount !== 1) throw new Error("Product was not found.");
      const reservation = await client.query<{ reserved: string }>(
        `SELECT COALESCE(SUM(oi.quantity), 0)::text AS reserved
         FROM stock_reservations sr
         JOIN order_items oi ON oi.order_id = sr.order_id
         WHERE sr.status = 'reserved' AND sr.reserved_until > NOW()
           AND oi.product_id = $1`,
        [id],
      );
      if (input.stockQuantity < Number(reservation.rows[0]?.reserved ?? 0)) {
        throw new Error("Stock cannot be reduced below quantities reserved for pending orders.");
      }
    }
    const category = await client.query<{ id: string }>(
      `INSERT INTO product_categories (name, slug)
       VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [input.category, makeSlug(input.category)],
    );
    const categoryId = category.rows[0]?.id;
    if (!categoryId) throw new Error("Product category could not be saved.");

    const slug = `${makeSlug(`${input.name}-${input.packageSize}`)}-${productId.slice(0, 8)}`;
    const values = [
      input.name,
      slug,
      input.description,
      input.imageUrl,
      categoryId,
      input.packageSize,
      input.priceInPaise,
      input.originalPriceInPaise,
      input.stockQuantity,
      input.isAvailable,
      input.isFeatured,
    ];
    const result = id
      ? await client.query(
          `UPDATE products SET name = $1, slug = $2, description = $3,
             image_url = $4, category_id = $5, package_size = $6,
             price_in_paise = $7, original_price_in_paise = $8,
             stock_quantity = $9, is_available = $10, is_featured = $11,
             updated_at = NOW()
           WHERE id = $12 RETURNING id`,
          [...values, id],
        )
      : await client.query(
          `INSERT INTO products (
             name, slug, description, image_url, category_id, package_size,
             price_in_paise, original_price_in_paise, stock_quantity,
             is_available, is_featured
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          values,
        );
    if (result.rowCount !== 1) {
      throw new Error("Product was not found or could not be saved.");
    }
    await client.query("COMMIT");
    return productId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function archiveProduct(id: string) {
  const result = await getDatabasePool().query(
    `UPDATE products SET archived_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND archived_at IS NULL`,
    [id],
  );
  return result.rowCount === 1;
}
