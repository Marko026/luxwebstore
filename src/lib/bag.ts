// The Bag: all Bag rules live here. Every function takes the database as a parameter, so tests pass their own.
// Stock is read straight from the products table, never through the cached catalogue reads.
import { and, asc, eq, gt, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { gte, lt, notExists } from "drizzle-orm";
import * as schema from "@/db/schema";
import { bagItems, products, type ProductImage } from "@/db/schema";

/** The app's Neon database or a test database: anything Postgres with the project's schema. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export type BagItem = {
  slug: string;
  name: string;
  packshot: ProductImage | undefined;
  /** Current catalogue price in euro cents, VAT included. */
  priceCents: number;
  stock: number;
  quantity: number;
};

export type Bag = {
  items: BagItem[];
  /** Total number of units across all Bag items. */
  units: number;
  /** Euro cents, VAT included. */
  subtotalCents: number;
};

export const emptyBag: Bag = { items: [], units: 0, subtotalCents: 0 };

export type AddToBagResult =
  | { status: "added"; quantity: number }
  /** The Bag already holds every unit in Stock: "Only N available". */
  | { status: "capped"; available: number }
  /** Stock is 0, though the page may still have shown it in stock: "Just sold out". */
  | { status: "sold-out" }
  | { status: "unknown-product" };

export async function getBag(db: Db, ownerId: string): Promise<Bag> {
  const rows = await db
    .select({
      slug: products.slug,
      name: products.name,
      images: products.images,
      priceCents: products.priceCents,
      stock: products.stock,
      quantity: bagItems.quantity,
    })
    .from(bagItems)
    .innerJoin(products, eq(products.id, bagItems.productId))
    .where(eq(bagItems.userId, ownerId))
    .orderBy(asc(bagItems.createdAt), asc(products.id));

  const items = rows.map(({ images, ...row }) => ({ ...row, packshot: images[0] }));
  return {
    items,
    units: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotalCents: items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0),
  };
}

export async function addToBag(db: Db, ownerId: string, productSlug: string): Promise<AddToBagResult> {
  // Insert-select needs every column of bag_items, in table order.
  const [row] = await db
    .insert(bagItems)
    .select(
      db
        .select({
          userId: sql<string>`${ownerId}`.as("user_id"),
          productId: products.id,
          quantity: sql<number>`1`.as("quantity"),
          createdAt: sql<Date>`now()`.as("created_at"),
          updatedAt: sql<Date>`now()`.as("updated_at"),
        })
        .from(products)
        .where(and(eq(products.slug, productSlug), gt(products.stock, 0))),
    )
    .onConflictDoUpdate({
      target: [bagItems.userId, bagItems.productId],
      set: { quantity: sql`${bagItems.quantity} + 1`, updatedAt: sql`now()` },
      setWhere: sql`${bagItems.quantity} < (select ${products.stock} from ${products} where ${products.id} = ${bagItems.productId})`,
    })
    .returning({ quantity: bagItems.quantity });
  if (row) return { status: "added", quantity: row.quantity };

  // Nothing was written; read the Stock only to say why (no write depends on this read).
  const [product] = await db.select({ stock: products.stock }).from(products).where(eq(products.slug, productSlug));
  if (!product) return { status: "unknown-product" };
  if (product.stock === 0) return { status: "sold-out" };
  return { status: "capped", available: product.stock };
}

/**
 * Deletes Guests whose Bag has not changed since `olderThan`; their Bag items go with them (cascade).
 * A Bag's last change is its latest Bag item update; a Guest with an empty Bag falls back to the Guest's
 * own `updatedAt` (set when the first "Add to bag" created them). Users are never deleted.
 * One statement, so a Bag changed while it runs is either seen as recent or not, never half-deleted.
 */
export async function deleteStaleGuests(db: Db, olderThan: Date): Promise<number> {
  const { user } = schema;
  const recentBagItem = db
    .select({ one: sql`1` })
    .from(bagItems)
    .where(and(eq(bagItems.userId, user.id), gte(bagItems.updatedAt, olderThan)));
  const deleted = await db
    .delete(user)
    .where(and(eq(user.isAnonymous, true), lt(user.updatedAt, olderThan), notExists(recentBagItem)))
    .returning({ id: user.id });
  return deleted.length;
}
