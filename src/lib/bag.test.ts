import { deleteStaleGuests } from "./bag";
import { bagItems } from "@/db/schema";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { categories, products, user } from "@/db/schema";
import { createTestDb } from "@/test/db";
import { addToBag, getBag, mergeBags, removeFromBag, setQuantity } from "./bag";

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
      expect.objectContaining({ slug: tote, stockStatus: "in-stock" }),
      expect.objectContaining({ slug: clutch, quantity: 1, stockStatus: "sold-out" }),
    ]);
    expect(bag.subtotalCents).toBe(120_000);
  });

  it("flags a Bag item with more units than are left as short", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 5, priceCents: 10_000 });
    for (let i = 0; i < 4; i++) await addToBag(db, owner, slug);

    await setStock(slug, 2);

    const bag = await getBag(db, owner);
    expect(bag.items).toEqual([expect.objectContaining({ slug, quantity: 4, stock: 2, stockStatus: "short" })]);
  });

  it("offers one more and one less unit, within 1 and the Stock", async () => {
    const owner = await aUser();
    const single = await aProduct({ stock: 5 });
    const middle = await aProduct({ stock: 5 });
    const atStock = await aProduct({ stock: 2 });
    await addToBag(db, owner, single);
    for (let i = 0; i < 3; i++) await addToBag(db, owner, middle);
    for (let i = 0; i < 2; i++) await addToBag(db, owner, atStock);

    expect((await getBag(db, owner)).items).toEqual([
      expect.objectContaining({ slug: single, quantity: 1, oneLess: null, oneMore: 2 }),
      expect.objectContaining({ slug: middle, quantity: 3, oneLess: 2, oneMore: 4 }),
      expect.objectContaining({ slug: atStock, quantity: 2, oneLess: 1, oneMore: null }),
    ]);
  });

  it("lowers a short Bag item straight to the Stock, and a sold-out one not at all", async () => {
    const owner = await aUser();
    const short = await aProduct({ stock: 5 });
    const soldOut = await aProduct({ stock: 5 });
    for (let i = 0; i < 4; i++) await addToBag(db, owner, short);
    for (let i = 0; i < 3; i++) await addToBag(db, owner, soldOut);

    await setStock(short, 2);
    await setStock(soldOut, 0);

    expect((await getBag(db, owner)).items).toEqual([
      expect.objectContaining({ slug: short, quantity: 4, oneLess: 2, oneMore: null }),
      expect.objectContaining({ slug: soldOut, quantity: 3, oneLess: null, oneMore: null }),
    ]);
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

describe("mergeBags", () => {
  it("moves a Guest's Bag items into the User's Bag when they share no product", async () => {
    const guest = await aGuest();
    const owner = await aUser();
    const fromGuest = await aProduct();
    const fromUser = await aProduct();
    await addToBag(db, guest, fromGuest);
    await addToBag(db, guest, fromGuest);
    await addToBag(db, owner, fromUser);

    await mergeBags(db, guest, owner);

    const bag = await getBag(db, owner);
    expect(bag.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: fromUser, quantity: 1 }),
        expect.objectContaining({ slug: fromGuest, quantity: 2 }),
      ]),
    );
    expect(bag.units).toBe(3);
    expect((await getBag(db, guest)).items).toEqual([]);
  });

  it("keeps the larger quantity, not the sum, for a product in both Bags", async () => {
    const guest = await aGuest();
    const owner = await aUser();
    const moreAsGuest = await aProduct({ stock: 10 });
    const moreAsUser = await aProduct({ stock: 10 });
    for (let i = 0; i < 3; i++) await addToBag(db, guest, moreAsGuest);
    await addToBag(db, owner, moreAsGuest);
    await addToBag(db, guest, moreAsUser);
    for (let i = 0; i < 2; i++) await addToBag(db, owner, moreAsUser);

    await mergeBags(db, guest, owner);

    const bag = await getBag(db, owner);
    expect(bag.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: moreAsGuest, quantity: 3 }),
        expect.objectContaining({ slug: moreAsUser, quantity: 2 }),
      ]),
    );
    expect(bag.items).toHaveLength(2);
    expect((await getBag(db, guest)).items).toEqual([]);
  });

  it("caps the merged quantity at the Stock", async () => {
    const guest = await aGuest();
    const owner = await aUser();
    const inBoth = await aProduct({ stock: 5 });
    const guestOnly = await aProduct({ stock: 5 });
    for (let i = 0; i < 4; i++) await addToBag(db, guest, inBoth);
    for (let i = 0; i < 2; i++) await addToBag(db, owner, inBoth);
    for (let i = 0; i < 4; i++) await addToBag(db, guest, guestOnly);

    await setStock(inBoth, 3);
    await setStock(guestOnly, 2);
    await mergeBags(db, guest, owner);

    const bag = await getBag(db, owner);
    expect(bag.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: inBoth, quantity: 3, stockStatus: "in-stock" }),
        expect.objectContaining({ slug: guestOnly, quantity: 2, stockStatus: "in-stock" }),
      ]),
    );
    expect(bag.items).toHaveLength(2);
  });

  it("turns a Guest's Bag into the Bag of a new account that had none", async () => {
    const guest = await aGuest();
    const newUser = await aUser();
    const tote = await aProduct({ priceCents: 120_000 });
    const clutch = await aProduct({ priceCents: 45_000 });
    await addToBag(db, guest, tote);
    await addToBag(db, guest, clutch);
    await addToBag(db, guest, clutch);

    await mergeBags(db, guest, newUser);

    expect(await getBag(db, newUser)).toMatchObject({
      items: [expect.objectContaining({ slug: tote, quantity: 1 }), expect.objectContaining({ slug: clutch, quantity: 2 })],
      units: 3,
      subtotalCents: 210_000,
    });
    expect(await getBag(db, guest)).toMatchObject({ items: [], units: 0 });
  });

  it("keeps a sold-out Bag item, flagged, so nothing disappears in the merge", async () => {
    const guest = await aGuest();
    const owner = await aUser();
    const guestOnly = await aProduct();
    const inBoth = await aProduct();
    await addToBag(db, guest, guestOnly);
    await addToBag(db, guest, guestOnly);
    await addToBag(db, guest, inBoth);
    await addToBag(db, owner, inBoth);

    await setStock(guestOnly, 0);
    await setStock(inBoth, 0);
    await mergeBags(db, guest, owner);

    const bag = await getBag(db, owner);
    expect(bag.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: guestOnly, quantity: 1, stockStatus: "sold-out" }),
        expect.objectContaining({ slug: inBoth, quantity: 1, stockStatus: "sold-out" }),
      ]),
    );
    expect(bag.items).toHaveLength(2);
    expect(bag.subtotalCents).toBe(0);
  });

  it("leaves a Bag as it was when merged into itself", async () => {
    const owner = await aUser();
    const slug = await aProduct();
    await addToBag(db, owner, slug);
    await addToBag(db, owner, slug);

    await mergeBags(db, owner, owner);

    expect((await getBag(db, owner)).items).toEqual([expect.objectContaining({ slug, quantity: 2 })]);
  });
});

describe("deleteStaleGuests", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const daysAgo = (days: number) => new Date(Date.now() - days * DAY);
  const thirtyDaysAgo = () => daysAgo(30);

  // Setup only: move a user's last changes into the past, as if time had passed.
  async function lastChanged(owner: string, { user: userDaysAgo, bag: bagDaysAgo }: { user: number; bag?: number }) {
    await db
      .update(user)
      .set({ createdAt: daysAgo(userDaysAgo), updatedAt: daysAgo(userDaysAgo) })
      .where(eq(user.id, owner));
    await db
      .update(bagItems)
      .set({ createdAt: daysAgo(bagDaysAgo ?? userDaysAgo), updatedAt: daysAgo(bagDaysAgo ?? userDaysAgo) })
      .where(eq(bagItems.userId, owner));
  }

  it("deletes a Guest whose Bag has not changed since the cut-off, Bag items included", async () => {
    const guest = await aGuest();
    await addToBag(db, guest, await aProduct());
    await lastChanged(guest, { user: 31 });

    expect(await deleteStaleGuests(db, thirtyDaysAgo())).toBe(1);

    expect(await getBag(db, guest)).toMatchObject({ items: [], units: 0 });
  });

  it("keeps a Guest who changed their Bag after the cut-off, however old the Guest is", async () => {
    const guest = await aGuest();
    const slug = await aProduct();
    await addToBag(db, guest, slug);
    await lastChanged(guest, { user: 60, bag: 2 });

    expect(await deleteStaleGuests(db, thirtyDaysAgo())).toBe(0);

    expect(await getBag(db, guest)).toMatchObject({ items: [expect.objectContaining({ slug, quantity: 1 })] });
  });

  it("keeps a Guest who emptied their Bag after the cut-off: removing is a change too", async () => {
    const guest = await aGuest();
    const slug = await aProduct();
    await addToBag(db, guest, slug);
    await lastChanged(guest, { user: 60 });

    await removeFromBag(db, guest, slug);

    expect(await deleteStaleGuests(db, thirtyDaysAgo())).toBe(0);
    // The Guest still exists: their Bag can still take a product.
    expect(await addToBag(db, guest, slug)).toEqual({ status: "added", quantity: 1 });
  });

  it("never deletes a User, however long their Bag has not changed", async () => {
    const owner = await aUser();
    const slug = await aProduct();
    await addToBag(db, owner, slug);
    await lastChanged(owner, { user: 400 });

    expect(await deleteStaleGuests(db, thirtyDaysAgo())).toBe(0);

    expect(await getBag(db, owner)).toMatchObject({ items: [expect.objectContaining({ slug, quantity: 1 })] });
  });

  it("judges a Guest with an empty Bag by when the Guest last changed", async () => {
    const stale = await aGuest();
    const recent = await aGuest();
    await lastChanged(stale, { user: 31 });
    await lastChanged(recent, { user: 29 });

    expect(await deleteStaleGuests(db, thirtyDaysAgo())).toBe(1);

    // The recent Guest still exists: their Bag can still take a product.
    const slug = await aProduct();
    expect(await addToBag(db, recent, slug)).toEqual({ status: "added", quantity: 1 });
  });
});
