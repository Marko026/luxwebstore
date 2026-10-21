// The Checkout: all Checkout rules live here (spec #21, ADR 0004). Every function takes the database and the Payments
// port as parameters, so tests pass their own; nothing here imports Stripe.
// A Checkout is closed only after its Stripe session can no longer be paid, and closing puts its units back in Stock in
// the same transaction that marks it closed.
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { bagItems, checkoutItems, checkouts, products, user } from "@/db/schema";
import { getBag, type Bag, type Db } from "@/lib/bag";
import type { Payments } from "@/lib/payments";

/** How long a Checkout can be paid: Stripe's shortest session lifetime. */
const checkoutMinutes = 30;

/** Where Stripe sends the Guest or User after paying, and back from its page. */
export type CheckoutUrls = { successUrl: string; cancelUrl: string };

export type StartCheckoutResult =
  | { status: "started"; url: string }
  | { status: "empty-bag" }
  /** A Bag item sold out or ran short; no Checkout started. The Bag as it is now, with the item flagged. */
  | { status: "bag-not-ready"; bag: Bag }
  /** The owner's open Checkout turned out paid on Stripe, so it was left open and no new one started. */
  | { status: "earlier-checkout-paid" };

type OpenCheckout = { id: number; stripeSessionId: string | null };

/**
 * Starts a Checkout for the owner's Bag: ends the owner's open Checkout, takes the Bag's units out of Stock, fixes
 * their prices and names, and creates the Stripe session. Only when every Bag item is in Stock at its full quantity.
 * If creating the session fails, the Checkout is closed again and the error is thrown.
 */
export async function startCheckout(
  db: Db,
  payments: Payments,
  ownerId: string,
  urls: CheckoutUrls,
): Promise<StartCheckoutResult> {
  await expireCheckouts(db, payments, new Date());

  // The earlier Checkout's page stops taking payment before its units go back
  const [earlier] = await db
    .select({ id: checkouts.id, stripeSessionId: checkouts.stripeSessionId })
    .from(checkouts)
    .where(and(eq(checkouts.userId, ownerId), eq(checkouts.state, "open")));
  if (earlier && (await endSession(payments, earlier)) === "already-paid") return { status: "earlier-checkout-paid" };

  const expiresAt = new Date(Date.now() + checkoutMinutes * 60_000);
  const held = await db.transaction(async (tx) => {
    if (earlier) await closeOpenCheckout(tx, earlier.id);

    // Locks the Bag's products until their units are out of Stock, in id order so two Checkouts never deadlock
    const items = await tx
      .select({
        productId: products.id,
        name: products.name,
        unitPriceCents: products.priceCents,
        stock: products.stock,
        quantity: bagItems.quantity,
      })
      .from(bagItems)
      .innerJoin(products, eq(products.id, bagItems.productId))
      .where(eq(bagItems.userId, ownerId))
      .orderBy(asc(products.id))
      .for("update", { of: products });
    if (items.length === 0) return { status: "empty-bag" } as const;
    if (items.some((item) => item.quantity > item.stock)) return { status: "bag-not-ready" } as const;

    await tx
      .update(products)
      .set({ stock: sql`${products.stock} - ${bagItems.quantity}` })
      .from(bagItems)
      .where(and(eq(bagItems.userId, ownerId), eq(bagItems.productId, products.id)));
    const [checkout] = await tx
      .insert(checkouts)
      .values({ userId: ownerId, expiresAt })
      .returning({ id: checkouts.id });
    const checkoutId = checkout!.id;
    await tx.insert(checkoutItems).values(
      items.map(({ productId, name, unitPriceCents, quantity }) => ({
        checkoutId,
        productId,
        quantity,
        unitPriceCents,
        productName: name,
      })),
    );
    // Starting a Checkout counts as a Bag change, so a Guest who is paying is never deleted as stale (ADR 0001)
    const [owner] = await tx
      .update(user)
      .set({ updatedAt: sql`now()` })
      .where(eq(user.id, ownerId))
      .returning({ email: user.email, isAnonymous: user.isAnonymous });
    // A Guest's user row has no real email, so Stripe asks for one
    const email = owner && !owner.isAnonymous ? owner.email : null;
    return { status: "held", checkoutId, items, email } as const;
  });
  if (held.status === "empty-bag") return held;
  if (held.status === "bag-not-ready") return { status: "bag-not-ready", bag: await getBag(db, ownerId) };

  let session: { id: string; url: string };
  try {
    session = await payments.createSession({
      checkoutId: held.checkoutId,
      items: held.items.map(({ name, unitPriceCents, quantity }) => ({ name, unitPriceCents, quantity })),
      email: held.email,
      expiresAt,
      ...urls,
    });
  } catch (error) {
    await closeOpenCheckout(db, held.checkoutId);
    throw error;
  }

  // A newer start may have closed this Checkout while its session was being created (it had no session to end then)
  const [recorded] = await db
    .update(checkouts)
    .set({ stripeSessionId: session.id })
    .where(and(eq(checkouts.id, held.checkoutId), eq(checkouts.state, "open")))
    .returning({ id: checkouts.id });
  if (!recorded) {
    await payments.expireSession(session.id);
    throw new Error(`Checkout ${held.checkoutId} was closed while it started`);
  }
  return { status: "started", url: session.url };
}

/**
 * Closes every open Checkout past its expiry and returns how many it closed. One that turns out paid is left open for
 * completion; one whose session cannot be reached is left for the next sweep.
 */
export async function expireCheckouts(db: Db, payments: Payments, now: Date): Promise<number> {
  const expired = await db
    .select({ id: checkouts.id, stripeSessionId: checkouts.stripeSessionId })
    .from(checkouts)
    .where(and(eq(checkouts.state, "open"), lte(checkouts.expiresAt, now)));
  let closed = 0;
  for (const checkout of expired) {
    try {
      if ((await endSession(payments, checkout)) === "expired" && (await closeOpenCheckout(db, checkout.id))) closed++;
    } catch (error) {
      // One unreachable session must not hold up the others, nor the Checkout whose start runs this sweep
      console.error(`Could not close Checkout ${checkout.id}`, error);
    }
  }
  return closed;
}

/** Makes the Checkout's Stripe session unpayable, unless it was paid first. */
async function endSession(payments: Payments, checkout: OpenCheckout) {
  // No session: creating it failed, or it is still being created and its start will see the Checkout closed
  if (!checkout.stripeSessionId) return "expired";
  return payments.expireSession(checkout.stripeSessionId);
}

/**
 * Marks an open Checkout closed and puts its units back in Stock, both or neither. False if it was no longer open, so
 * two closings never return its units twice. Call it only once its session can no longer be paid.
 */
async function closeOpenCheckout(db: Db, checkoutId: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [closed] = await tx
      .update(checkouts)
      .set({ state: "closed" })
      .where(and(eq(checkouts.id, checkoutId), eq(checkouts.state, "open")))
      .returning({ id: checkouts.id });
    if (!closed) return false;
    await tx
      .update(products)
      .set({ stock: sql`${products.stock} + ${checkoutItems.quantity}` })
      .from(checkoutItems)
      .where(and(eq(checkoutItems.checkoutId, checkoutId), eq(checkoutItems.productId, products.id)));
    return true;
  });
}
