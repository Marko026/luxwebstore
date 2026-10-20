// Drizzle table definitions.
// Better Auth tables live in auth-schema.ts, generated (not hand-edited) with:
// npx auth generate --config src/lib/auth.ts --output src/db/auth-schema.ts
import { relations, sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
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

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
}));

export * from "./auth-schema";
