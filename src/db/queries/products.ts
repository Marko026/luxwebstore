// Catalog reads. Cached so results land in the static shell (cacheComponents is on);
// `minutes` keeps stock labels fresh within the hour, and the "products" tag allows revalidateTag after edits.
import { asc, desc, eq, ne } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import type { CategoryLink, Product } from "@/lib/products";

type ProductRow = typeof products.$inferSelect & { category: { name: string; slug: string } };

function toProduct(row: ProductRow): Product {
  return {
    slug: row.slug,
    name: row.name,
    category: row.category.name,
    categorySlug: row.category.slug,
    priceCents: row.priceCents,
    stock: row.stock,
    gallery: row.images,
    description: row.description,
    details: row.details,
    care: row.care,
  };
}

const withCategory = { category: { columns: { name: true, slug: true } } } as const;

/** Every category, for navigation (header menu, category bar). */
export async function getCategories(): Promise<CategoryLink[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");
  return db.select({ slug: categories.slug, name: categories.name }).from(categories).orderBy(asc(categories.id));
}

export async function getProducts(): Promise<Product[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");
  const rows = await db.query.products.findMany({ with: withCategory, orderBy: asc(products.id) });
  return rows.map(toProduct);
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");
  const row = await db.query.products.findFirst({ where: eq(products.slug, slug), with: withCategory });
  return row && toProduct(row);
}

/** Most recently added products first. The seed inserts in one statement (same created_at), so id breaks ties. */
export async function getNewArrivals(count = 8): Promise<Product[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");
  const rows = await db.query.products.findMany({
    with: withCategory,
    orderBy: [desc(products.createdAt), desc(products.id)],
    limit: count,
  });
  return rows.map(toProduct);
}

/** Other products to suggest under a product. */
export async function getRelatedProducts(slug: string, count = 3): Promise<Product[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");
  const rows = await db.query.products.findMany({
    where: ne(products.slug, slug),
    with: withCategory,
    orderBy: asc(products.id),
    limit: count,
  });
  return rows.map(toProduct);
}

/** A category with its products, or undefined for an unknown slug. */
export async function getCategory(slug: string): Promise<{ name: string; products: Product[] } | undefined> {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");
  const row = await db.query.categories.findFirst({
    where: eq(categories.slug, slug),
    with: { products: { with: withCategory, orderBy: asc(products.id) } },
  });
  return row && { name: row.name, products: row.products.map(toProduct) };
}

export async function getCategorySlugs(): Promise<string[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");
  const rows = await db.select({ slug: categories.slug }).from(categories);
  return rows.map((r) => r.slug);
}

export async function getProductSlugs(): Promise<string[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");
  const rows = await db.select({ slug: products.slug }).from(products);
  return rows.map((r) => r.slug);
}
