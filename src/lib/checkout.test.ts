import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { bagItems, categories, checkouts, products, user } from "@/db/schema";
import { createTestDb } from "@/test/db";
import { fakePayments } from "@/test/fake-payments";
import { addToBag, deleteStaleGuests, getBag, setQuantity } from "./bag";
import { expireCheckouts, startCheckout } from "./checkout";

let db: Awaited<ReturnType<typeof createTestDb>>;
let categoryId: number;
let seq = 0;
// One fake for the file: every start sweeps all expired Checkouts, whichever test started them
const stripe = fakePayments();
const urls = { successUrl: "https://shop.example.test/done", cancelUrl: "https://shop.example.test/" };
const MINUTE = 60_000;

beforeAll(async () => {
  db = await createTestDb();
  const [category] = await db.insert(categories).values({ slug: "totes", name: "Totes" }).returning();
  categoryId = category!.id;
});

async function aUser() {
  const id = `user-${++seq}`;
  await db.insert(user).values({ id, name: "Ana", email: `${id}@example.com` });
  return id;
}

// A Guest is the anonymous Better Auth user created by their first "Add to bag" (ADR 0001)
async function aGuest() {
  const id = `guest-${++seq}`;
  await db.insert(user).values({ id, name: "Anonymous", email: `${id}@anonymous.invalid`, isAnonymous: true });
  return id;
}

async function aProduct({ stock = 5, priceCents = 100_000 } = {}) {
  const slug = `bag-${++seq}`;
  await db.insert(products).values({ slug, categoryId, name: `Bag ${seq}`, description: "", care: "", priceCents, stock });
  return slug;
}

/** Puts `quantity` units of the product in the owner's Bag. */
async function inBag(owner: string, slug: string, quantity = 1) {
  await addToBag(db, owner, slug);
  if (quantity > 1) await setQuantity(db, owner, slug, quantity);
}

/** Stock as the owner's Bag shows it. */
async function stockInBag(owner: string, slug: string) {
  const item = (await getBag(db, owner)).items.find((i) => i.slug === slug);
  return item?.stock;
}

const start = (owner: string) => startCheckout(db, stripe.payments, owner, urls);
const lastSession = () => stripe.sessions.at(-1)!;

describe("startCheckout", () => {
  it("takes a ready Bag's units out of Stock and sends its prices and names to the payment page", async () => {
    const owner = await aUser();
    const tote = await aProduct({ stock: 3, priceCents: 120_000 });
    const clutch = await aProduct({ stock: 1, priceCents: 80_000 });
    await inBag(owner, tote, 2);
    await inBag(owner, clutch);

    const result = await start(owner);

    expect(result).toEqual({ status: "started", url: lastSession().url });
    expect(lastSession()).toMatchObject({
      items: [
        { name: expect.stringMatching(/^Bag /), unitPriceCents: 120_000, quantity: 2 },
        { name: expect.stringMatching(/^Bag /), unitPriceCents: 80_000, quantity: 1 },
      ],
      email: `${owner}@example.com`,
      ...urls,
    });
    const minutesLeft = (lastSession().expiresAt.getTime() - Date.now()) / MINUTE;
    expect(minutesLeft).toBeGreaterThan(29);
    expect(minutesLeft).toBeLessThanOrEqual(30);
    expect(await stockInBag(owner, tote)).toBe(1);
    expect(await stockInBag(owner, clutch)).toBe(0);
  });

  it("leaves a Guest's email for the payment page to ask", async () => {
    const guest = await aGuest();
    await inBag(guest, await aProduct());

    expect(await start(guest)).toMatchObject({ status: "started" });

    expect(lastSession().email).toBeNull();
  });

  it("refuses an empty Bag", async () => {
    const owner = await aUser();
    const sessionsBefore = stripe.sessions.length;

    expect(await start(owner)).toEqual({ status: "empty-bag" });

    expect(stripe.sessions).toHaveLength(sessionsBefore);
  });

  it.each([
    ["sold out", 0],
    ["short", 1],
  ])("changes nothing when a Bag item is %s, and returns the Bag with it flagged", async (_, stockLeft) => {
    const owner = await aUser();
    const ready = await aProduct({ stock: 3 });
    const flagged = await aProduct({ stock: 2 });
    await inBag(owner, ready);
    await inBag(owner, flagged, 2);
    // Sold elsewhere after it went into the Bag
    await db.update(products).set({ stock: stockLeft }).where(eq(products.slug, flagged));
    const sessionsBefore = stripe.sessions.length;

    const result = await start(owner);

    expect(result).toMatchObject({
      status: "bag-not-ready",
      bag: {
        items: [
          expect.objectContaining({ slug: ready, stockStatus: "in-stock" }),
          expect.objectContaining({ slug: flagged, stockStatus: stockLeft === 0 ? "sold-out" : "short" }),
        ],
      },
    });
    expect(stripe.sessions).toHaveLength(sessionsBefore);
    expect(await stockInBag(owner, ready)).toBe(3);
    expect(await stockInBag(owner, flagged)).toBe(stockLeft);
  });

  it("closes the owner's earlier Checkout: its page stops taking payment and its units come back", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 2 });
    await inBag(owner, slug);
    await start(owner);
    const first = lastSession();

    expect(await start(owner)).toMatchObject({ status: "started" });

    expect(first.state).toBe("expired");
    expect(lastSession()).not.toBe(first);
    expect(await stockInBag(owner, slug)).toBe(1);
  });

  it("lets the owner start again with the units their earlier Checkout held", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 1 });
    await inBag(owner, slug);
    await start(owner);

    expect(await start(owner)).toMatchObject({ status: "started" });

    expect(await stockInBag(owner, slug)).toBe(0);
  });

  it("leaves an earlier Checkout that was already paid open, units still held, and starts nothing", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 2 });
    await inBag(owner, slug);
    await start(owner);
    const first = lastSession();
    stripe.markPaid(first.id);

    expect(await start(owner)).toEqual({ status: "earlier-checkout-paid" });

    expect(lastSession()).toBe(first);
    expect(await stockInBag(owner, slug)).toBe(1);
  });

  it("puts the units back when the payment page cannot be created", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 2 });
    await inBag(owner, slug, 2);
    stripe.failNextCreate();

    await expect(start(owner)).rejects.toThrow();

    expect(await stockInBag(owner, slug)).toBe(2);
    // Nothing is left open to block the next try
    expect(await start(owner)).toMatchObject({ status: "started" });
  });
});

describe("expireCheckouts", () => {
  /** Setup only: moves a Checkout's expiry into the past, as if 30 minutes had gone by. */
  async function expire(sessionId: string) {
    await db
      .update(checkouts)
      .set({ expiresAt: new Date(Date.now() - MINUTE) })
      .where(eq(checkouts.stripeSessionId, sessionId));
  }

  it("closes only open Checkouts past their expiry, ending their sessions and returning their units", async () => {
    const late = await aUser();
    const onTime = await aUser();
    const slug = await aProduct({ stock: 3 });
    await inBag(late, slug);
    await start(late);
    const lateSession = lastSession();
    await inBag(onTime, slug);
    await start(onTime);
    const onTimeSession = lastSession();
    await expire(lateSession.id);

    expect(await expireCheckouts(db, stripe.payments, new Date())).toBe(1);

    expect(lateSession.state).toBe("expired");
    expect(onTimeSession.state).toBe("open");
    expect(await stockInBag(onTime, slug)).toBe(2);
    // Already closed: a second sweep finds nothing
    expect(await expireCheckouts(db, stripe.payments, new Date())).toBe(0);
  });

  it("leaves an expired Checkout that was paid open, its units still held", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 2 });
    await inBag(owner, slug);
    await start(owner);
    stripe.markPaid(lastSession().id);
    await expire(lastSession().id);

    expect(await expireCheckouts(db, stripe.payments, new Date())).toBe(0);

    expect(await stockInBag(owner, slug)).toBe(1);
  });
});

describe("deleteStaleGuests", () => {
  it("keeps a Guest who just started a Checkout, however old their Bag", async () => {
    const guest = await aGuest();
    const slug = await aProduct();
    await inBag(guest, slug);
    const longAgo = new Date(Date.now() - 60 * 24 * 60 * MINUTE);
    await db.update(user).set({ createdAt: longAgo, updatedAt: longAgo }).where(eq(user.id, guest));
    await db.update(bagItems).set({ createdAt: longAgo, updatedAt: longAgo }).where(eq(bagItems.userId, guest));

    await start(guest);

    await deleteStaleGuests(db, new Date(Date.now() - 30 * 24 * 60 * MINUTE));
    expect(await getBag(db, guest)).toMatchObject({ items: [expect.objectContaining({ slug })] });
  });
});
