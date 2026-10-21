// Drizzle table definitions.
// Better Auth tables live in auth-schema.ts, generated (not hand-edited) with:
// npx auth generate --config src/lib/auth.ts --output src/db/auth-schema.ts
import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export type ProductImage = { src: string; alt: string };

export const categories = pgTable("categories", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable(
  "products",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    slug: text().notNull().unique(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    name: text().notNull(),
    description: text().notNull(),
    details: text().array().notNull().default(sql`'{}'::text[]`),
    care: text().notNull(),
    /** Price in euro cents, VAT included. */
    priceCents: integer("price_cents").notNull(),
    /** Units available to order online. */
    stock: integer().notNull().default(0),
    /** First image is the packshot (object on white); the rest are editorial. */
    images: jsonb().$type<ProductImage[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("products_category_id_idx").on(t.categoryId),
    check("products_price_cents_check", sql`${t.priceCents} >= 0`),
    check("products_stock_check", sql`${t.stock} >= 0`),
  ],
);

/**
 * One product in a User's Bag. A Bag is the set of Bag items of one user; there is no Bag table.
 * No price is stored: the Bag always shows the current catalogue price.
 */
export const bagItems = pgTable(
  "bag_items",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.productId] }),
    index("bag_items_product_id_idx").on(t.productId),
    check("bag_items_quantity_check", sql`${t.quantity} >= 1`),
  ],
);

/** Requests counted per key, for `src/lib/rate-limit.ts`. An expired row is deleted by the next count. */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text().primaryKey(),
    count: integer().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("rate_limits_expires_at_idx").on(t.expiresAt)],
);

/** "open": its units are out of Stock and it can be paid. "paid": Stripe took the payment. "closed": it can no longer be paid and its units are back in Stock. */
export const checkoutState = pgEnum("checkout_state", ["open", "paid", "closed"]);

/** One attempt to pay for a Bag (ADR 0004). Rules live in `src/lib/checkout.ts`. */
export const checkouts = pgTable(
  "checkouts",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    state: checkoutState().notNull().default("open"),
    /** Null only while the Stripe session is being created, or if creating it failed. */
    stripeSessionId: text("stripe_session_id").unique(),
    /** When it can no longer be paid; it is closed at the first sweep after that. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("checkouts_user_id_idx").on(t.userId),
    // A Guest or User has at most one open Checkout
    uniqueIndex("checkouts_one_open_per_user_idx").on(t.userId).where(sql`${t.state} = 'open'`),
    index("checkouts_open_expires_at_idx").on(t.expiresAt).where(sql`${t.state} = 'open'`),
  ],
);

/** One product of a Checkout, with its price and name fixed when the Checkout started. */
export const checkoutItems = pgTable(
  "checkout_items",
  {
    checkoutId: integer("checkout_id")
      .notNull()
      .references(() => checkouts.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: integer().notNull(),
    /** Price in euro cents, VAT included, when the Checkout started. */
    unitPriceCents: integer("unit_price_cents").notNull(),
    productName: text("product_name").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.checkoutId, t.productId] }),
    index("checkout_items_product_id_idx").on(t.productId),
    check("checkout_items_quantity_check", sql`${t.quantity} >= 1`),
    check("checkout_items_unit_price_cents_check", sql`${t.unitPriceCents} >= 0`),
  ],
);

export const categoriesRelations =relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
}));

export * from "./auth-schema";
