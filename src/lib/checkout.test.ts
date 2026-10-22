import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { bagItems, categories, checkouts, orders, products, user } from "@/db/schema";
import { createTestDb } from "@/test/db";
import { anAddress, fakePayments } from "@/test/fake-payments";
import { addToBag, deleteStaleGuests, getBag, setQuantity } from "./bag";
import {
  cancelCheckout,
  completeCheckout,
  expireCheckout,
  expireCheckouts,
  getOrder,
  getOrderByNumber,
  listOrders,
  moveCheckoutsAndOrders,
  startCheckout,
} from "./checkout";

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

/** Stock as the catalogue, and every Bag but the holder's, shows it. */
async function catalogueStock(slug: string) {
  const [product] = await db.select({ stock: products.stock }).from(products).where(eq(products.slug, slug));
  return product?.stock;
}

const start = (owner: string) => startCheckout(db, stripe.payments, owner, urls);
const complete = (sessionId: string) => completeCheckout(db, stripe.payments, sessionId);
const lastSession = () => stripe.sessions.at(-1)!;
const bagOf = async (owner: string) =>
  (await getBag(db, owner)).items.map(({ slug, quantity }) => ({ slug, quantity }));

/** Pays for one unit of the product as `owner` and returns the Order it became. */
async function paidOrder(owner: string, slug: string) {
  await inBag(owner, slug);
  await start(owner);
  stripe.markPaid(lastSession().id);
  const result = await complete(lastSession().id);
  if (result.status !== "completed") throw new Error("Not completed");
  return result.order;
}

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
    expect(await catalogueStock(tote)).toBe(1);
    expect(await catalogueStock(clutch)).toBe(0);
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
    expect(await catalogueStock(ready)).toBe(3);
    expect(await catalogueStock(flagged)).toBe(stockLeft);
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
    expect(await catalogueStock(slug)).toBe(1);
  });

  it("lets the owner start again with the units their earlier Checkout held", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 1 });
    await inBag(owner, slug);
    await start(owner);

    expect(await start(owner)).toMatchObject({ status: "started" });

    expect(await catalogueStock(slug)).toBe(0);
  });

  it("completes an earlier Checkout that was already paid: it becomes an Order, and nothing new starts", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 2 });
    await inBag(owner, slug);
    await start(owner);
    const first = lastSession();
    stripe.markPaid(first.id);

    expect(await start(owner)).toEqual({ status: "earlier-checkout-paid" });

    expect(lastSession()).toBe(first);
    expect(await getOrder(db, owner, first.id)).toMatchObject({ items: [expect.objectContaining({ productSlug: slug })] });
    expect(await bagOf(owner)).toEqual([]);
    expect(await catalogueStock(slug)).toBe(1);
  });

  it("lets a start that began meanwhile win: the slower start's page is ended and its units come back", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 2 });
    await inBag(owner, slug);
    let faster: Awaited<ReturnType<typeof start>> | undefined;
    stripe.duringNextCreate(async () => {
      faster = await start(owner);
    });

    await expect(start(owner)).rejects.toThrow();

    expect(faster).toMatchObject({ status: "started" });
    const [fasterSession, slowerSession] = stripe.sessions.slice(-2);
    expect(fasterSession!.state).toBe("open");
    expect(slowerSession!.state).toBe("expired");
    expect(await catalogueStock(slug)).toBe(1);
  });

  it("puts the units back when the payment page cannot be created", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 2 });
    await inBag(owner, slug, 2);
    stripe.failNextCreate();

    await expect(start(owner)).rejects.toThrow();

    expect(await catalogueStock(slug)).toBe(2);
    // Nothing is left open to block the next try
    expect(await start(owner)).toMatchObject({ status: "started" });
  });
});

// 10 starts per owner per hour
describe("startCheckout's limit", () => {
  /** An owner with one unit in their Bag who has started a Checkout `times` times, each one closing the one before. */
  async function anOwnerWhoStarted(times: number) {
    const owner = await aUser();
    const slug = await aProduct({ stock: 2 });
    await inBag(owner, slug);
    const results = [];
    for (let i = 0; i < times; i++) results.push(await start(owner));
    return { owner, slug, results };
  }

  it("lets an owner start up to 10 Checkouts", async () => {
    const { results } = await anOwnerWhoStarted(10);

    expect(results).toEqual(Array(10).fill(expect.objectContaining({ status: "started" })));
  });

  it("refuses the next start before anything is held or sent to the payment page", async () => {
    const { owner, slug } = await anOwnerWhoStarted(10);
    const held = lastSession();
    // A start that went through would take this one's unit out of Stock
    const added = await aProduct({ stock: 2 });
    await inBag(owner, added);
    const sessionsBefore = stripe.sessions.length;

    expect(await start(owner)).toEqual({ status: "too-many-starts" });

    expect(stripe.sessions).toHaveLength(sessionsBefore);
    expect(await catalogueStock(added)).toBe(2);
    // The open Checkout keeps its page and its unit
    expect(held.state).toBe("open");
    expect(await catalogueStock(slug)).toBe(1);
  });

  it("counts every start, also one that starts nothing", async () => {
    const owner = await aUser();
    for (let i = 0; i < 10; i++) expect(await start(owner)).toEqual({ status: "empty-bag" });
    await inBag(owner, await aProduct());

    expect(await start(owner)).toEqual({ status: "too-many-starts" });
  });

  it("counts each owner apart", async () => {
    await anOwnerWhoStarted(11);
    const other = await aGuest();
    await inBag(other, await aProduct());

    expect(await start(other)).toMatchObject({ status: "started" });
  });
});

describe("the owner's own open Checkout", () => {
  it("leaves the units it holds available in the owner's Bag only: another Bag sees them gone", async () => {
    const owner = await aUser();
    const other = await aUser();
    const slug = await aProduct({ stock: 1 });
    await inBag(owner, slug);
    await inBag(other, slug);
    await start(owner);

    expect((await getBag(db, owner)).items).toEqual([
      expect.objectContaining({ slug, stock: 1, stockStatus: "in-stock", oneMore: null }),
    ]);
    expect((await getBag(db, other)).items).toEqual([
      expect.objectContaining({ slug, stock: 0, stockStatus: "sold-out" }),
    ]);
    expect(await catalogueStock(slug)).toBe(0);
  });

  it("lets the owner lower a Bag item it holds, as the drawer offers", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 2 });
    await inBag(owner, slug, 2);
    await start(owner);
    const [item] = (await getBag(db, owner)).items;
    expect(item).toMatchObject({ stockStatus: "in-stock", oneLess: 1, oneMore: null });

    expect(await setQuantity(db, owner, slug, item!.oneLess!)).toEqual({ status: "updated", quantity: 1 });
    expect(await setQuantity(db, owner, slug, 3)).toEqual({ status: "above-stock", available: 2 });
  });

  it("lets the owner add the units it holds again, and no more", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 2 });
    await inBag(owner, slug);
    await start(owner);

    expect(await addToBag(db, owner, slug)).toEqual({ status: "added", quantity: 2 });
    expect(await addToBag(db, owner, slug)).toEqual({ status: "capped", available: 2 });
    expect(await addToBag(db, await aUser(), slug)).toEqual({ status: "added", quantity: 1 });
  });

  it("does not block starting again on the last unit: the old one closes, and one hold is left", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 1 });
    await inBag(owner, slug);
    await start(owner);
    const first = lastSession();

    expect(await start(owner)).toEqual({ status: "started", url: lastSession().url });

    expect(first.state).toBe("expired");
    expect(lastSession().state).toBe("open");
    expect(await catalogueStock(slug)).toBe(0);
    // Leaving the new one gives back the one unit: no other Checkout of the owner still holds it
    await cancelCheckout(db, stripe.payments, owner, lastSession().id);
    expect(await catalogueStock(slug)).toBe(1);
  });
});

describe("cancelCheckout", () => {
  const cancel = (owner: string, sessionId: string) => cancelCheckout(db, stripe.payments, owner, sessionId);

  it("closes the owner's open Checkout at once: its page stops taking payment and its units come back", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 2 });
    await inBag(owner, slug, 2);
    await start(owner);
    const session = lastSession();

    await cancel(owner, session.id);

    expect(session.state).toBe("expired");
    expect(await catalogueStock(slug)).toBe(2);
    expect(await bagOf(owner)).toEqual([{ slug, quantity: 2 }]);
    // Closed: the next start has no earlier Checkout to end
    expect(await start(owner)).toMatchObject({ status: "started" });
    expect(lastSession()).not.toBe(session);
  });

  it("changes nothing for another owner's Checkout", async () => {
    const owner = await aUser();
    const other = await aUser();
    const slug = await aProduct({ stock: 2 });
    await inBag(owner, slug);
    await start(owner);
    const session = lastSession();

    await cancel(other, session.id);

    expect(session.state).toBe("open");
    expect(await catalogueStock(slug)).toBe(1);
  });

  it("changes nothing for a paid Checkout", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 2 });
    await inBag(owner, slug);
    await start(owner);
    const session = lastSession();
    stripe.markPaid(session.id);
    await complete(session.id);

    await cancel(owner, session.id);

    expect(session.state).toBe("paid");
    expect(await getOrder(db, owner, session.id)).toBeDefined();
    expect(await catalogueStock(slug)).toBe(1);
  });

  it("changes nothing for a closed Checkout: its units come back once, and the newer one keeps its hold", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 2 });
    await inBag(owner, slug);
    await start(owner);
    const closed = lastSession();
    await start(owner);
    const newer = lastSession();

    await cancel(owner, closed.id);

    expect(newer.state).toBe("open");
    expect(await catalogueStock(slug)).toBe(1);
  });

  it("knows no session that is not a Checkout's", async () => {
    await expect(cancel(await aUser(), "cs_test_unknown")).resolves.toBeUndefined();
  });
});

describe("completeCheckout", () => {
  it("makes one Order from the Checkout and takes only the bought units out of the Bag", async () => {
    const owner = await aUser();
    const tote = await aProduct({ stock: 3, priceCents: 120_000 });
    const clutch = await aProduct({ stock: 3, priceCents: 80_000 });
    const wallet = await aProduct({ stock: 3 });
    await inBag(owner, tote, 2);
    await inBag(owner, clutch);
    await start(owner);
    const session = lastSession();
    // Added in another tab while paying
    await setQuantity(db, owner, clutch, 2);
    await inBag(owner, wallet);
    stripe.markPaid(session.id, { deliveryAddress: anAddress });

    const result = await complete(session.id);

    const order = {
      number: expect.stringMatching(/^LUX-\d+$/),
      items: [
        expect.objectContaining({ productSlug: tote, quantity: 2, unitPriceCents: 120_000 }),
        expect.objectContaining({ productSlug: clutch, quantity: 1, unitPriceCents: 80_000 }),
      ],
      totalCents: 320_000,
      email: `${owner}@example.com`,
      deliveryAddress: anAddress,
      createdAt: expect.any(Date),
    };
    expect(result).toEqual({ status: "completed", order });
    expect(await getOrder(db, owner, session.id)).toEqual(order);
    expect(await bagOf(owner)).toEqual([
      { slug: clutch, quantity: 1 },
      { slug: wallet, quantity: 1 },
    ]);
    // Already out of Stock since the start
    expect(await catalogueStock(tote)).toBe(1);
    expect(await catalogueStock(clutch)).toBe(2);
  });

  it("keeps the email a Guest gave on the payment page", async () => {
    const guest = await aGuest();
    await inBag(guest, await aProduct());
    await start(guest);
    stripe.markPaid(lastSession().id, { email: "ana@example.test" });

    expect(await complete(lastSession().id)).toMatchObject({ order: { email: "ana@example.test" } });
  });

  it("makes one Order however often it is called, also at once (webhook and confirmation page)", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 3 });
    await inBag(owner, slug);
    await start(owner);
    const session = lastSession();
    stripe.markPaid(session.id);

    const [first, second] = await Promise.all([complete(session.id), complete(session.id)]);
    await inBag(owner, slug);
    const third = await complete(session.id);

    const number = first.status === "completed" && first.order.number;
    expect(second).toMatchObject({ status: "completed", order: { number } });
    expect(third).toMatchObject({ status: "completed", order: { number } });
    // A later call takes nothing more out of the Bag
    expect(await bagOf(owner)).toEqual([{ slug, quantity: 1 }]);
  });

  it("makes nothing for a session that is not paid", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 3 });
    await inBag(owner, slug);
    await start(owner);
    const session = lastSession();

    expect(await complete(session.id)).toEqual({ status: "not-paid" });

    expect(await getOrder(db, owner, session.id)).toBeUndefined();
    expect(await bagOf(owner)).toEqual([{ slug, quantity: 1 }]);
    expect(await catalogueStock(slug)).toBe(2);
  });

  it("makes the Order of a Checkout already marked paid, as moving a Guest's Checkouts can leave one", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 3 });
    await inBag(owner, slug);
    await start(owner);
    const session = lastSession();
    stripe.markPaid(session.id);
    // Setup only: what `moveCheckoutsAndOrders` does to an older open Checkout that Stripe reports paid
    await db.update(checkouts).set({ state: "paid" }).where(eq(checkouts.stripeSessionId, session.id));

    expect(await complete(session.id)).toMatchObject({ status: "completed" });

    expect(await getOrder(db, owner, session.id)).toBeDefined();
    expect(await bagOf(owner)).toEqual([]);
  });

  it("knows no session that is not a Checkout's", async () => {
    expect(await complete("cs_test_not_ours")).toEqual({ status: "unknown-session" });
  });

  it("keeps the prices and names fixed at the start, whatever the catalogue does meanwhile", async () => {
    const owner = await aUser();
    const slug = await aProduct({ priceCents: 100_000 });
    await inBag(owner, slug);
    await start(owner);
    const session = lastSession();
    const { name } = session.items[0]!;
    await db.update(products).set({ priceCents: 150_000, name: "Renamed" }).where(eq(products.slug, slug));
    stripe.markPaid(session.id);

    expect(await complete(session.id)).toMatchObject({
      order: { items: [expect.objectContaining({ productName: name, unitPriceCents: 100_000 })], totalCents: 100_000 },
    });
  });
});

describe("getOrder", () => {
  it("shows an Order only to its owner", async () => {
    const owner = await aUser();
    const someoneElse = await aUser();
    await inBag(owner, await aProduct());
    await start(owner);
    const session = lastSession();
    stripe.markPaid(session.id);
    await complete(session.id);

    expect(await getOrder(db, owner, session.id)).toBeDefined();
    expect(await getOrder(db, someoneElse, session.id)).toBeUndefined();
    expect(await getOrder(db, owner, "cs_test_not_ours")).toBeUndefined();
  });
});

describe("listOrders", () => {
  it("lists the owner's Orders newest first, each with its date, total and items, and nobody else's", async () => {
    const owner = await aUser();
    const older = await paidOrder(owner, await aProduct({ priceCents: 120_000 }));
    const newer = await paidOrder(owner, await aProduct({ priceCents: 80_000 }));
    await paidOrder(await aUser(), await aProduct());

    const list = await listOrders(db, owner);

    expect(list).toEqual([newer, older]);
    expect(newer).toMatchObject({ totalCents: 80_000, items: [expect.objectContaining({ quantity: 1 })] });
    expect(newer.createdAt.getTime()).toBeGreaterThanOrEqual(older.createdAt.getTime());
  });

  it("gives an owner with no Orders an empty list", async () => {
    expect(await listOrders(db, await aUser())).toEqual([]);
  });

  it("lists the Orders a Guest made under the account they signed in to", async () => {
    const guest = await aGuest();
    const account = await aUser();
    const order = await paidOrder(guest, await aProduct());

    await moveCheckoutsAndOrders(db, stripe.payments, guest, account);
    await db.delete(user).where(eq(user.id, guest));

    expect(await listOrders(db, account)).toEqual([order]);
  });
});

describe("getOrderByNumber", () => {
  it("shows an Order by its Order number only to its owner", async () => {
    const owner = await aUser();
    const order = await paidOrder(owner, await aProduct());

    expect(await getOrderByNumber(db, owner, order.number)).toEqual(order);
    expect(await getOrderByNumber(db, await aUser(), order.number)).toBeUndefined();
  });

  it.each([
    ["an unknown number", "LUX-1"],
    ["a number too large to be one", "LUX-99999999999"],
    ["a number without its prefix", "10001"],
    ["a lower-case prefix", "lux-10001"],
    ["something else", "LUX-abc"],
    ["an empty string", ""],
  ])("finds nothing for %s", async (_, number) => {
    const owner = await aUser();
    await paidOrder(owner, await aProduct());

    expect(await getOrderByNumber(db, owner, number)).toBeUndefined();
  });

  it("keeps the price and name the Order was bought at after the catalogue changes", async () => {
    const owner = await aUser();
    const slug = await aProduct({ priceCents: 100_000 });
    const order = await paidOrder(owner, slug);
    const { productName } = order.items[0]!;
    await db.update(products).set({ priceCents: 150_000, name: "Renamed" }).where(eq(products.slug, slug));

    expect(await getOrderByNumber(db, owner, order.number)).toMatchObject({
      items: [expect.objectContaining({ productName, unitPriceCents: 100_000 })],
      totalCents: 100_000,
    });
  });
});

describe("an ordered product and a deleted Guest", () => {
  async function anOrder(owner: string, slug: string) {
    await inBag(owner, slug);
    await start(owner);
    stripe.markPaid(lastSession().id, { email: "ana@example.test" });
    const result = await complete(lastSession().id);
    if (result.status !== "completed") throw new Error("Not completed");
    return result.order;
  }

  it("refuses to delete a product that has been ordered", async () => {
    const slug = await aProduct();
    await anOrder(await aUser(), slug);

    await expect(db.delete(products).where(eq(products.slug, slug))).rejects.toThrow();

    expect(await catalogueStock(slug)).toBe(4);
  });

  it("keeps a deleted Guest's Order, with its email and address and no owner", async () => {
    const guest = await aGuest();
    const order = await anOrder(guest, await aProduct());

    await db.delete(user).where(eq(user.id, guest));

    // No owner is left to ask `getOrder`, so the Order is read straight from its table
    const [kept] = await db
      .select({ userId: orders.userId, checkoutId: orders.checkoutId, email: orders.email, city: orders.deliveryCity })
      .from(orders)
      .where(eq(orders.number, Number(order.number.slice("LUX-".length))));
    expect(kept).toEqual({ userId: null, checkoutId: null, email: "ana@example.test", city: anAddress.city });
  });
});

describe("expireCheckout", () => {
  it("closes the Checkout of a session Stripe reports expired, returning its units", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 2 });
    await inBag(owner, slug);
    await start(owner);
    stripe.markExpired(lastSession().id);

    await expireCheckout(db, stripe.payments, lastSession().id);

    expect(await catalogueStock(slug)).toBe(2);
    // Closed: the owner's next start finds no open Checkout to end
    expect(await start(owner)).toMatchObject({ status: "started" });
  });

  it("makes a Checkout whose session turns out paid an Order instead", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 2 });
    await inBag(owner, slug);
    await start(owner);
    const session = lastSession();
    stripe.markPaid(session.id);

    await expireCheckout(db, stripe.payments, session.id);

    expect(await getOrder(db, owner, session.id)).toBeDefined();
    expect(await catalogueStock(slug)).toBe(1);
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
    expect(await catalogueStock(slug)).toBe(2);
    // Already closed: a second sweep finds nothing
    expect(await expireCheckouts(db, stripe.payments, new Date())).toBe(0);
  });

  it("makes an expired Checkout that was paid an Order, its units still out of Stock", async () => {
    const owner = await aUser();
    const slug = await aProduct({ stock: 2 });
    await inBag(owner, slug);
    await start(owner);
    const session = lastSession();
    stripe.markPaid(session.id);
    await expire(session.id);

    expect(await expireCheckouts(db, stripe.payments, new Date())).toBe(0);

    expect(await getOrder(db, owner, session.id)).toBeDefined();
    expect(await catalogueStock(slug)).toBe(1);
  });
});

describe("moveCheckoutsAndOrders", () => {
  const move = (guest: string, account: string) => moveCheckoutsAndOrders(db, stripe.payments, guest, account);
  /** The anonymous user is deleted once their Bag, Checkouts and Orders have moved (ADR 0001). */
  const deleteGuest = (guest: string) => db.delete(user).where(eq(user.id, guest));

  it("hands a Guest's open Checkout to the account: its units stay held, and the account's next start ends it", async () => {
    const guest = await aGuest();
    const account = await aUser();
    const slug = await aProduct({ stock: 2 });
    await inBag(guest, slug);
    await start(guest);
    const guestSession = lastSession();

    await move(guest, account);
    await deleteGuest(guest);

    expect(guestSession.state).toBe("open");
    await inBag(account, slug);
    expect(await catalogueStock(slug)).toBe(1);
    await start(account);
    // The moved Checkout was the account's: closed, its unit back, then held again by the new one
    expect(guestSession.state).toBe("expired");
    expect(await catalogueStock(slug)).toBe(1);
  });

  it("closes the older of two open Checkouts, keeping the newer one", async () => {
    const guest = await aGuest();
    const account = await aUser();
    const accountSlug = await aProduct({ stock: 2 });
    const guestSlug = await aProduct({ stock: 2 });
    await inBag(account, accountSlug);
    await start(account);
    const olderSession = lastSession();
    await inBag(guest, guestSlug);
    await start(guest);
    const newerSession = lastSession();

    await move(guest, account);
    await deleteGuest(guest);

    expect(olderSession.state).toBe("expired");
    expect(newerSession.state).toBe("open");
    expect(await catalogueStock(accountSlug)).toBe(2);
    expect(await catalogueStock(guestSlug)).toBe(1);
  });

  it("keeps both when the older one was already paid: its units stay bought, the newer one stays open", async () => {
    const guest = await aGuest();
    const account = await aUser();
    const accountSlug = await aProduct({ stock: 2 });
    const guestSlug = await aProduct({ stock: 2 });
    await inBag(account, accountSlug);
    await start(account);
    const olderSession = lastSession();
    stripe.markPaid(olderSession.id);
    await inBag(guest, guestSlug);
    await start(guest);
    const newerSession = lastSession();

    await move(guest, account);
    await deleteGuest(guest);

    expect(olderSession.state).toBe("paid");
    expect(newerSession.state).toBe("open");
    // Marked paid before it had an Order, it still became one: the account's, its units out of the Bag
    expect(await getOrder(db, account, olderSession.id)).toMatchObject({
      items: [expect.objectContaining({ productSlug: accountSlug })],
    });
    expect(await bagOf(account)).toEqual([]);
    expect(await catalogueStock(accountSlug)).toBe(1);
    await inBag(account, guestSlug);
    expect(await catalogueStock(guestSlug)).toBe(1);
    // The newer one is the account's one open Checkout: its next start ends it, and the paid one is no longer open
    expect(await start(account)).toMatchObject({ status: "started" });
    expect(newerSession.state).toBe("expired");
  });

  /** Pays for the owner's Bag of one product and makes the Order; returns its session id and Order number. */
  async function anOrder(owner: string) {
    await inBag(owner, await aProduct());
    await start(owner);
    const session = lastSession();
    stripe.markPaid(session.id, { email: "ana@example.test" });
    const result = await complete(session.id);
    if (result.status !== "completed") throw new Error("Not completed");
    return { sessionId: session.id, number: result.order.number };
  }

  it("hands a Guest's Orders to the account, whatever its email, and leaves other owners' alone", async () => {
    const guest = await aGuest();
    const account = await aUser();
    const someoneElse = await aUser();
    const first = await anOrder(guest);
    const second = await anOrder(guest);
    const theirs = await anOrder(someoneElse);

    await move(guest, account);
    await deleteGuest(guest);

    expect(await getOrder(db, account, first.sessionId)).toMatchObject({
      number: first.number,
      email: "ana@example.test",
    });
    expect(await getOrder(db, account, second.sessionId)).toMatchObject({ number: second.number });
    expect(await getOrder(db, someoneElse, theirs.sessionId)).toMatchObject({ number: theirs.number });
  });

  it("makes the Order of a Checkout a Guest started before signing in, and paid after, the account's", async () => {
    const guest = await aGuest();
    const account = await aUser();
    await inBag(guest, await aProduct());
    await start(guest);
    const session = lastSession();

    await move(guest, account);
    await deleteGuest(guest);
    stripe.markPaid(session.id);

    expect(await complete(session.id)).toMatchObject({ status: "completed" });
    expect(await getOrder(db, account, session.id)).toBeDefined();
  });

  it("changes nothing for an account when the Guest has no Orders", async () => {
    const guest = await aGuest();
    const account = await aUser();
    const own = await anOrder(account);

    await move(guest, account);
    await deleteGuest(guest);

    expect(await getOrder(db, account, own.sessionId)).toMatchObject({ number: own.number });
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
