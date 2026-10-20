// Product shape used by the storefront, plus pure display helpers. Data comes from src/db/queries/products.ts.
import type { ProductImage } from "@/db/schema";

export type Product = {
  slug: string;
  name: string;
  /** Category display name. */
  category: string;
  categorySlug: string;
  /** Price in euro cents, VAT included. */
  priceCents: number;
  /** Units available to order online. */
  stock: number;
  /** First photo is the packshot (object on white); the rest are editorial. */
  gallery: ProductImage[];
  description: string;
  details: string[];
  care: string;
};

export const LOW_STOCK = 3;

export type StockState = "in-stock" | "low" | "sold-out";

export function stockState(stock: number): StockState {
  if (stock <= 0) return "sold-out";
  if (stock <= LOW_STOCK) return "low";
  return "in-stock";
}

export function stockLabel(stock: number) {
  const state = stockState(stock);
  if (state === "sold-out") return "Sold out";
  if (state === "low") return `Only ${stock} left`;
  return "In stock";
}

const euro = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export const formatPrice = (priceCents: number) => euro.format(priceCents / 100);

export const productHref = (slug: string) => `/products/${slug}`;

export type CategoryLink = { slug: string; name: string };

export const categoryHref = (slug: string) => `/category/${slug}`;
