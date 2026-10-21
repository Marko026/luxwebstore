// The Bag: all Bag rules live here. Every function takes the database as a parameter, so tests pass their own.
// Stock is read straight from the products table, never through the cached catalogue reads.
import { and, asc, eq, gt, gte, inArray, lt, notExists, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
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
  stockStatus: StockStatus;
  /** The quantity "one less" sets: straight down to the Stock for a short Bag item; null at 1 or when sold out. */
  oneLess: number | null;
  /** The quantity "one more" sets; null once the quantity reaches the Stock. */
  oneMore: number | null;
};

/** "short": more units in the Bag than are in Stock ("Only N left"). "sold-out": Stock is 0. */
export type StockStatus = "in-stock" | "short" | "sold-out";

function stockStatusOf(quantity: number, stock: number): StockStatus {
  if (stock <= 0) return "sold-out";
  return quantity > stock ? "short" : "in-stock";
}

// The same 1-to-Stock range `setQuantity` accepts, so the drawer only offers quantities that will be taken
function quantityStepsOf(quantity: number, stock: number) {
  const lower = Math.min(quantity - 1, stock);
  return { oneLess: lower >= 1 ? lower : null, oneMore: quantity < stock ? quantity + 1 : null };
}

export type Bag = {
  items: BagItem[];
  /** Total number of units across all Bag items. */
  units: number;
  /** Euro cents, VAT included. Sold-out Bag items are left out. */
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

export type SetQuantityResult =
  | { status: "updated"; quantity: number }
  /** More than the Stock was asked for; nothing changed: "Only N left". */
  | { status: "above-stock"; available: number }
  /** Not a whole number of at least 1. Taking a Bag item out is `removeFromBag`. */
  | { status: "invalid-quantity" }
  /** The product isn't in this Bag (or no longer in the catalogue). */
  | { status: "not-in-bag" };

/** Sets a Bag item's quantity to between 1 and the Stock. Anything else is rejected, never clamped. */
export async function setQuantity(
  db: Db,
  ownerId: string,
  productSlug: string,
  quantity: number,
): Promise<SetQuantityResult> {
  if (!Number.isInteger(quantity) || quantity < 1) return { status: "invalid-quantity" };
  // The Stock check is part of the update, so it holds even if Stock changes between two requests
  const [row] = await db
    .update(bagItems)
    .set({ quantity, updatedAt: sql`now()` })
    .where(
      and(eq(bagItems.userId, ownerId), inArray(bagItems.productId, productIdBySlug(db, productSlug, quantity))),
    )
    .returning({ quantity: bagItems.quantity });
  if (row) return { status: "updated", quantity: row.quantity };

  // Nothing was written; read the Bag item's Stock only to say why
  const [item] = await db
    .select({ stock: products.stock })
    .from(bagItems)
    .innerJoin(products, eq(products.id, bagItems.productId))
    .where(and(eq(bagItems.userId, ownerId), eq(products.slug, productSlug)));
  if (!item) return { status: "not-in-bag" };
  return { status: "above-stock", available: item.stock };
}

/** Takes the Bag item out of the Bag, whatever its quantity. Nothing happens if it isn't there. */
export async function removeFromBag(db: Db, ownerId: string, productSlug: string): Promise<void> {
  // A removal leaves no Bag item to date it, so it marks the owner as changed instead (`deleteStaleGuests` reads
  // that). One statement: the update runs only if the delete took something out.
  await db.execute(sql`
    with removed as (
      delete from ${bagItems}
      where user_id = ${ownerId} and product_id in (${productIdBySlug(db, productSlug)})
      returning user_id
    )
    update ${schema.user} set updated_at = now() where id in (select user_id from removed)
  `);
}

/** The product's id, as a subquery; with `minStock`, only while its Stock is at least that. */
function productIdBySlug(db: Db, productSlug: string, minStock?: number) {
  return db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.slug, productSlug), minStock === undefined ? undefined : gte(products.stock, minStock)));
}

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

  const items = rows.map(({ images, ...row }) => ({
    ...row,
    packshot: images[0],
    stockStatus: stockStatusOf(row.quantity, row.stock),
    ...quantityStepsOf(row.quantity, row.stock),
  }));
  return {
    items,
    units: items.reduce((sum, item) => sum + item.quantity, 0),
    // A short Bag item still counts at its quantity: it is flagged, and the shopper lowers it themselves
    subtotalCents: items
      .filter((item) => item.stockStatus !== "sold-out")
      .reduce((sum, item) => sum + item.priceCents * item.quantity, 0),
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
 * Moves every Bag item of `fromOwnerId` (a Guest who just signed in or signed up) into the Bag of `toOwnerId`,
 * leaving the first Bag empty. For a product in both Bags the result is the larger quantity, not the sum.
 * Every merged quantity is capped at live Stock; a sold-out Bag item stays at 1 so `getBag` still shows it
 * as "Sold out" instead of it silently disappearing.
 */
export async function mergeBags(db: Db, fromOwnerId: string, toOwnerId: string): Promise<void> {
  // Merging a Bag into itself changes nothing (and would delete and upsert the same rows in one statement)
  if (fromOwnerId === toOwnerId) return;
  // The cap on a merged quantity: the Stock, but at least 1. Deliberate (spec story 16): a sold-out Bag item stays in
  // the Bag, flagged "Sold out", instead of disappearing without the Guest or User knowing.
  const cap = sql`greatest(${products.stock}, 1)`;
  // One statement (no interactive transactions on neon-http): the delete hands its rows to the insert
  await db.execute(sql`
    with moved as (
      delete from ${bagItems} where user_id = ${fromOwnerId}
      returning product_id, quantity, created_at
    )
    insert into ${bagItems} (user_id, product_id, quantity, created_at, updated_at)
    select ${toOwnerId}, moved.product_id, least(moved.quantity, ${cap}), moved.created_at, now()
    from moved
    join ${products} on ${products}.id = moved.product_id
    -- The same product in both Bags: the larger quantity, not the sum, with the same cap
    on conflict (user_id, product_id) do update
      set quantity = least(
            greatest(${bagItems}.quantity, excluded.quantity),
            (select ${cap} from ${products} where ${products}.id = ${bagItems}.product_id)
          ),
          updated_at = now()
  `);
}

/**
 * Deletes Guests whose Bag has not changed since `olderThan`; their Bag items go with them (cascade).
 * A Bag's last change is the later of its latest Bag item update and the Guest's own `updatedAt` (set when the first
 * "Add to bag" created them, and by every `removeFromBag`). Users are never deleted.
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
