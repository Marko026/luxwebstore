import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { categories, products, user } from "@/db/schema";
import { createTestDb } from "@/test/db";
import { addToBag, getBag } from "./bag";

let db: Awaited<ReturnType<typeof createTestDb>>;
let categoryId: number;
let seq = 0;

beforeAll(async () => {
  db = await createTestDb();
  const [category] = await db.insert(categories).values({ slug: "totes", name: "Totes" }).returning();
  categoryId = category!.id;
});

// Each test gets its own User and products, so tests never see each other's Bags.
async function aUser() {
  const id = `user-${++seq}`;
  await db.insert(user).values({ id, name: "Ana", email: `${id}@example.com` });
  return id;
}

async function aProduct({ stock = 5, priceCents = 100_000 } = {}) {
  const slug = `bag-${++seq}`;
  await db.insert(products).values({
    slug,
    categoryId,
    name: `Bag ${seq}`,
    description: "",
    care: "",
    priceCents,
    stock,
    images: [{ src: `/${slug}.jpg`, alt: `Bag ${seq}` }],
  });
  return slug;
}

describe("addToBag", () => {
  it("puts one unit of the product in an empty Bag", async () => {
    const owner = await aUser();
    const slug = await aProduct({ priceCents: 120_000 });

    expect(await addToBag(db, owner, slug)).toEqual({ status: "added", quantity: 1 });

    const bag = await getBag(db, owner);
    expect(bag.items).toEqual([
      expect.objectContaining({ slug, quantity: 1, priceCents: 120_000, packshot: { src: `/${slug}.jpg`, alt: expect.any(String) } }),
    ]);
    expect(bag.units).toBe(1);
  });

  it("adds one more unit to a product already in the Bag", async () => {
    const owner = await aUser();
    const slug = await aProduct();
    await addToBag(db, owner, slug);

    expect(await addToBag(db, owner, slug)).toEqual({ status: "added", quantity: 2 });

    const bag = await getBag(db, owner);
    expect(bag.items).toEqual([expect.objectContaining({ slug, quantity: 2 })]);
  });

  it("stops at the Stock and says how many are available", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 2 });
    await addToBag(db, owner, slug);
    await addToBag(db, owner, slug);

    expect(await addToBag(db, owner, slug)).toEqual({ status: "capped", available: 2 });

    const bag = await getBag(db, owner);
    expect(bag.items).toEqual([expect.objectContaining({ slug, quantity: 2 })]);
  });

  it("refuses a sold-out product and leaves the Bag empty", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 0 });

    expect(await addToBag(db, owner, slug)).toEqual({ status: "sold-out" });

    expect(await getBag(db, owner)).toMatchObject({ items: [], units: 0 });
  });

  it("refuses a product that is not in the catalogue", async () => {
    const owner = await aUser();

    expect(await addToBag(db, owner, "no-such-bag")).toEqual({ status: "unknown-product" });

    expect(await getBag(db, owner)).toMatchObject({ items: [], units: 0 });
  });
});

describe("getBag", () => {
  it("adds up the units and the Subtotal at current catalogue prices", async () => {
    const owner = await aUser();
    const tote = await aProduct({ priceCents: 120_000 });
    const clutch = await aProduct({ priceCents: 45_000 });
    await addToBag(db, owner, tote);
    await addToBag(db, owner, clutch);
    await addToBag(db, owner, clutch);

    const bag = await getBag(db, owner);
    expect(bag.units).toBe(3);
    expect(bag.subtotalCents).toBe(210_000);
  });

  it("drops a Bag item when its product is removed from the catalogue", async () => {
    const owner = await aUser();
    const kept = await aProduct();
    const removed = await aProduct();
    await addToBag(db, owner, kept);
    await addToBag(db, owner, removed);

    await db.delete(products).where(eq(products.slug, removed));

    const bag = await getBag(db, owner);
    expect(bag.items).toEqual([expect.objectContaining({ slug: kept })]);
    expect(bag.units).toBe(1);
  });
});
