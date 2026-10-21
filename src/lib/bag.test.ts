import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { categories, products, user } from "@/db/schema";
import { createTestDb } from "@/test/db";
import { addToBag, getBag, removeFromBag, setQuantity } from "./bag";

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

// A Guest is the anonymous Better Auth user created by their first "Add to bag" (ADR 0001).
async function aGuest() {
  const id = `guest-${++seq}`;
  await db.insert(user).values({ id, name: "Anonymous", email: `${id}@anonymous.invalid`, isAnonymous: true });
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

/** Stock changing in the catalogue after the product went into a Bag (sold elsewhere, or restocked). */
async function setStock(slug: string, stock: number) {
  await db.update(products).set({ stock }).where(eq(products.slug, slug));
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

  it("gives a Guest a Bag that works like a User's, Stock cap included", async () => {
    const guest = await aGuest();
    const slug = await aProduct({ stock: 2 });

    expect(await addToBag(db, guest, slug)).toEqual({ status: "added", quantity: 1 });
    expect(await addToBag(db, guest, slug)).toEqual({ status: "added", quantity: 2 });
    expect(await addToBag(db, guest, slug)).toEqual({ status: "capped", available: 2 });

    expect(await getBag(db, guest)).toMatchObject({ items: [expect.objectContaining({ slug, quantity: 2 })], units: 2 });
  });
});

describe("setQuantity", () => {
  it("sets a quantity between 1 and the Stock", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 4 });
    await addToBag(db, owner, slug);

    expect(await setQuantity(db, owner, slug, 4)).toEqual({ status: "updated", quantity: 4 });
    expect((await getBag(db, owner)).items).toEqual([expect.objectContaining({ slug, quantity: 4 })]);

    expect(await setQuantity(db, owner, slug, 1)).toEqual({ status: "updated", quantity: 1 });
    expect((await getBag(db, owner)).items).toEqual([expect.objectContaining({ slug, quantity: 1 })]);
  });

  it("rejects a quantity above the Stock and leaves the Bag item as it was", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 3 });
    await addToBag(db, owner, slug);

    expect(await setQuantity(db, owner, slug, 4)).toEqual({ status: "above-stock", available: 3 });

    expect((await getBag(db, owner)).items).toEqual([expect.objectContaining({ slug, quantity: 1 })]);
  });

  it("rejects 0 and keeps the Bag item: removing is a separate, deliberate step", async () => {
    const owner = await aUser();
    const slug = await aProduct();
    await addToBag(db, owner, slug);
    await addToBag(db, owner, slug);

    expect(await setQuantity(db, owner, slug, 0)).toEqual({ status: "invalid-quantity" });
    expect(await setQuantity(db, owner, slug, -1)).toEqual({ status: "invalid-quantity" });
    expect(await setQuantity(db, owner, slug, 1.5)).toEqual({ status: "invalid-quantity" });

    expect((await getBag(db, owner)).items).toEqual([expect.objectContaining({ slug, quantity: 2 })]);
  });

  it("does not put a product in the Bag: one that isn't there is reported, not added", async () => {
    const owner = await aUser();
    const slug = await aProduct();

    expect(await setQuantity(db, owner, slug, 1)).toEqual({ status: "not-in-bag" });
    expect(await setQuantity(db, owner, "no-such-bag", 1)).toEqual({ status: "not-in-bag" });

    expect((await getBag(db, owner)).items).toEqual([]);
  });
});

describe("removeFromBag", () => {
  it("takes the Bag item out, whatever its quantity, and leaves the others", async () => {
    const owner = await aUser();
    const kept = await aProduct();
    const removed = await aProduct();
    await addToBag(db, owner, kept);
    await addToBag(db, owner, removed);
    await addToBag(db, owner, removed);

    await removeFromBag(db, owner, removed);

    const bag = await getBag(db, owner);
    expect(bag.items).toEqual([expect.objectContaining({ slug: kept })]);
    expect(bag.units).toBe(1);
  });

  it("leaves another owner's Bag alone", async () => {
    const owner = await aUser();
    const other = await aUser();
    const slug = await aProduct();
    await addToBag(db, owner, slug);
    await addToBag(db, other, slug);

    await removeFromBag(db, owner, slug);

    expect((await getBag(db, owner)).items).toEqual([]);
    expect((await getBag(db, other)).items).toEqual([expect.objectContaining({ slug })]);
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

  it("keeps a sold-out Bag item, flags it and leaves it out of the Subtotal", async () => {
    const owner = await aUser();
    const tote = await aProduct({ priceCents: 120_000 });
    const clutch = await aProduct({ priceCents: 45_000 });
    await addToBag(db, owner, tote);
    await addToBag(db, owner, clutch);

    await setStock(clutch, 0);

    const bag = await getBag(db, owner);
    expect(bag.items).toEqual([
      expect.objectContaining({ slug: tote, availability: "available" }),
      expect.objectContaining({ slug: clutch, quantity: 1, availability: "sold-out" }),
    ]);
    expect(bag.subtotalCents).toBe(120_000);
  });

  it("flags a Bag item with more units than are left as short", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 5, priceCents: 10_000 });
    for (let i = 0; i < 4; i++) await addToBag(db, owner, slug);

    await setStock(slug, 2);

    const bag = await getBag(db, owner);
    expect(bag.items).toEqual([expect.objectContaining({ slug, quantity: 4, stock: 2, availability: "short" })]);
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
