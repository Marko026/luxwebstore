// The Checkout: all Checkout rules live here (spec #21, ADR 0004). Every function takes the database and the Payments
// port as parameters, so tests pass their own; nothing here imports Stripe.
// A Checkout is closed only after its Stripe session can no longer be paid, and closing puts its units back in Stock in
// the same transaction that marks it closed.
import { and, asc, eq, exists, gte, isNull, lte, sql, type SQL } from "drizzle-orm";
import { bagItems, checkoutItems, checkouts, orderItems, orders, products, user, type ProductImage } from "@/db/schema";
import { getBag, type Bag, type Db } from "@/lib/bag";
import type { DeliveryAddress, Payments } from "@/lib/payments";
import { consumeRateLimit, type RateLimit } from "@/lib/rate-limit";

/** How long a Checkout can be paid: Stripe's shortest session lifetime. */
const checkoutMinutes = 30;

// Checkout starts per owner. Every start calls Stripe and moves Stock, so a script that keeps restarting would spend
// our Stripe request quota and churn the few units; a Guest or User who goes back and forth stays well under it.
const checkoutStartsPerOwner: RateLimit = { max: 10, windowSeconds: 60 * 60 };

/** Where Stripe sends the Guest or User after paying, and back from its page. */
export type CheckoutUrls = { successUrl: string; cancelUrl: string };

export type StartCheckoutResult =
  | { status: "started"; url: string }
  | { status: "empty-bag" }
  /** A Bag item sold out or ran short; no Checkout started. The Bag as it is now, with the item flagged. */
  | { status: "bag-not-ready"; bag: Bag }
  /** The owner's open Checkout turned out paid on Stripe, so it became an Order and no new one started. */
  | { status: "earlier-checkout-paid" }
  /** The owner tried to start too many Checkouts lately; this try was counted, nothing else changed. */
  | { status: "too-many-starts" };

type OpenCheckout = { id: number; stripeSessionId: string | null };

export type OrderItem = {
  productSlug: string;
  /** The product's name as bought. */
  productName: string;
  packshot: ProductImage | undefined;
  quantity: number;
  /** Euro cents, VAT included, as bought. */
  unitPriceCents: number;
};

export type Order = {
  /** The Order number as the Customer sees it, such as "LUX-10042". */
  number: string;
  items: OrderItem[];
  /** Euro cents, VAT included; delivery is free. */
  totalCents: number;
  email: string;
  deliveryAddress: DeliveryAddress;
};

export type CompleteCheckoutResult =
  | { status: "completed"; order: Order }
  | { status: "not-paid" }
  /** No Checkout has this session. */
  | { status: "unknown-session" };

/**
 * Starts a Checkout for the owner's Bag: ends the owner's open Checkout, takes the Bag's units out of Stock, fixes
 * their prices and names, and creates the Stripe session. Only when every Bag item is in Stock at its full quantity.
 * If creating the session fails, the Checkout is closed again and the error is thrown. Every attempt counts against
 * the owner's limit, and one over it changes nothing: no Stock moves and Stripe is not called.
 */
export async function startCheckout(
  db: Db,
  payments: Payments,
  ownerId: string,
  urls: CheckoutUrls,
): Promise<StartCheckoutResult> {
  if (!(await consumeRateLimit(db, `checkout-start:${ownerId}`, checkoutStartsPerOwner))) {
    return { status: "too-many-starts" };
  }
  await expireCheckouts(db, payments, new Date());

  // The earlier Checkout's page stops taking payment before its units go back. If it was paid first, it becomes an
  // Order instead, which takes its units out of the Bag
  const earlier = await openCheckoutOf(db, ownerId);
  if (earlier?.stripeSessionId && (await endSession(payments, earlier)) === "already-paid") {
    await completeCheckout(db, payments, earlier.stripeSessionId);
    return { status: "earlier-checkout-paid" };
  }

  const expiresAt = new Date(Date.now() + checkoutMinutes * 60_000);
  const held = await db.transaction(async (tx) => {
    // If its start recorded a session meanwhile, it stays open and the insert below fails on "one open Checkout per
    // owner": that session was never ended, so its units must stay held
    if (earlier) await closeOpenCheckout(tx, earlier);

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

    // The quantities just checked, not the Bag read again: a change in another tab cannot slip in between
    for (const { productId, quantity } of items) {
      await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${quantity}` })
        .where(eq(products.id, productId));
    }
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
    // The sweep closes it after its expiry if this fails; the caller still learns why the start failed
    await closeOpenCheckout(db, { id: held.checkoutId, stripeSessionId: null }).catch((closeError) =>
      console.error(`Could not close Checkout ${held.checkoutId}`, closeError),
    );
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
 * Closes every open Checkout past its expiry and returns how many it closed. One that turns out paid becomes an Order
 * instead; one whose session cannot be reached is left for the next sweep.
 */
export async function expireCheckouts(db: Db, payments: Payments, now: Date): Promise<number> {
  const expired = await db
    .select({ id: checkouts.id, stripeSessionId: checkouts.stripeSessionId })
    .from(checkouts)
    .where(and(eq(checkouts.state, "open"), lte(checkouts.expiresAt, now)));
  let closed = 0;
  for (const checkout of expired) {
    try {
      if ((await closeOrComplete(db, payments, checkout)) === "closed") closed++;
    } catch (error) {
      // One unreachable session must not hold up the others, nor the Checkout whose start runs this sweep
      console.error(`Could not close Checkout ${checkout.id}`, error);
    }
  }
  return closed;
}

/**
 * Moves every Checkout of `fromOwnerId` (a Guest who just signed in or signed up), open, paid or closed, to
 * `toOwnerId`, before the Guest is deleted with whatever is still theirs (ADR 0001). A payment in progress then
 * completes as the User's, and its units stay held. If both have an open Checkout, the older one is closed by the
 * closing rule. If it turns out paid, it is marked paid instead (its units stay out of Stock) and the newer one stays
 * open, so the account keeps at most one open and loses no payment in progress. Once moved, the paid one becomes the
 * account's Order, its units leaving the merged Bag.
 */
export async function moveCheckouts(db: Db, payments: Payments, fromOwnerId: string, toOwnerId: string) {
  if (fromOwnerId === toOwnerId) return;
  const [fromOpen, toOpen] = await Promise.all([openCheckoutOf(db, fromOwnerId), openCheckoutOf(db, toOwnerId)]);
  let paidSessionId: string | undefined;
  if (fromOpen && toOpen) {
    // Ids grow with time, so the smaller one started first
    const [older, newer] = fromOpen.id < toOpen.id ? [fromOpen, toOpen] : [toOpen, fromOpen];
    if ((await closeCheckout(db, payments, older)) === "already-paid") {
      await db
        .update(checkouts)
        .set({ state: "paid" })
        .where(and(eq(checkouts.id, older.id), eq(checkouts.state, "open")));
      paidSessionId = older.stripeSessionId!;
    }
  }
  await db.update(checkouts).set({ userId: toOwnerId }).where(eq(checkouts.userId, fromOwnerId));
  if (paidSessionId) {
    // Signing in must not fail over it: Stripe's webhook or the confirmation page completes it later
    await completeCheckout(db, payments, paidSessionId).catch((error) =>
      console.error(`Could not complete the Checkout of session ${paidSessionId}`, error),
    );
  }
}

/**
 * Makes the paid Checkout of a Stripe session an Order, once: copies its items, prices and names from our Checkout
 * (not from Stripe's line items) and its email and delivery address from Stripe, marks the Checkout paid and takes the
 * bought units out of the owner's Bag (units added meanwhile stay). Called by Stripe's webhook and the confirmation
 * page, whichever comes first; calling it again returns the same Order. Decides by whether the Checkout has an Order,
 * not by its state: a Checkout can be marked paid before its Order exists (`moveCheckouts`).
 */
export async function completeCheckout(db: Db, payments: Payments, sessionId: string): Promise<CompleteCheckoutResult> {
  const [checkout] = await db
    .select({ id: checkouts.id })
    .from(checkouts)
    .where(eq(checkouts.stripeSessionId, sessionId));
  if (!checkout) return { status: "unknown-session" };
  const made = await findOrder(db, eq(orders.checkoutId, checkout.id));
  if (made) return { status: "completed", order: made };

  const session = await payments.readSession(sessionId);
  if (!session.paid) return { status: "not-paid" };
  const { email, deliveryAddress } = session;
  if (!email || !deliveryAddress) throw new Error(`Paid session ${sessionId} has no email or delivery address`);

  await db.transaction(async (tx) => {
    // Locks the Checkout, so the webhook and the confirmation page arriving together make one Order
    const [locked] = await tx
      .select({ ownerId: checkouts.userId })
      .from(checkouts)
      .where(eq(checkouts.id, checkout.id))
      .for("update");
    if (!locked) throw new Error(`Checkout ${checkout.id} was deleted while it completed`);
    const [existing] = await tx
      .select({ number: orders.number })
      .from(orders)
      .where(eq(orders.checkoutId, checkout.id));
    if (existing) return;
    // Not checked against "closed": closing ends the session first, so a closed Checkout is never paid

    const items = await tx
      .select({
        productId: checkoutItems.productId,
        quantity: checkoutItems.quantity,
        unitPriceCents: checkoutItems.unitPriceCents,
        productName: checkoutItems.productName,
      })
      .from(checkoutItems)
      .where(eq(checkoutItems.checkoutId, checkout.id));
    const [order] = await tx
      .insert(orders)
      .values({
        checkoutId: checkout.id,
        userId: locked.ownerId,
        email,
        deliveryName: deliveryAddress.name,
        deliveryLine1: deliveryAddress.line1,
        deliveryLine2: deliveryAddress.line2,
        deliveryCity: deliveryAddress.city,
        deliveryPostalCode: deliveryAddress.postalCode,
        deliveryCountry: deliveryAddress.country,
        totalCents: items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0),
      })
      .returning({ number: orders.number });
    await tx.insert(orderItems).values(items.map((item) => ({ ...item, orderNumber: order!.number })));
    // Its units are already out of Stock since it started
    await tx.update(checkouts).set({ state: "paid" }).where(eq(checkouts.id, checkout.id));

    // The bought units leave the Bag: a Bag item bought whole goes, one with units added meanwhile keeps those
    const boughtWhole = tx
      .select({ one: sql`1` })
      .from(checkoutItems)
      .where(
        and(
          eq(checkoutItems.checkoutId, checkout.id),
          eq(checkoutItems.productId, bagItems.productId),
          gte(checkoutItems.quantity, bagItems.quantity),
        ),
      );
    await tx.delete(bagItems).where(and(eq(bagItems.userId, locked.ownerId), exists(boughtWhole)));
    await tx
      .update(bagItems)
      .set({ quantity: sql`${bagItems.quantity} - ${checkoutItems.quantity}`, updatedAt: sql`now()` })
      .from(checkoutItems)
      .where(
        and(
          eq(bagItems.userId, locked.ownerId),
          eq(checkoutItems.checkoutId, checkout.id),
          eq(checkoutItems.productId, bagItems.productId),
        ),
      );
  });

  const order = await findOrder(db, eq(orders.checkoutId, checkout.id));
  if (!order) throw new Error(`Checkout ${checkout.id} has no Order after completing`);
  return { status: "completed", order };
}

/**
 * Closes the Checkout of a Stripe session that expired (Stripe's expiry event), returning its units; one that turns
 * out paid becomes an Order instead. Nothing happens for a Checkout no longer open.
 */
export async function expireCheckout(db: Db, payments: Payments, sessionId: string): Promise<void> {
  const [checkout] = await db
    .select({ id: checkouts.id, stripeSessionId: checkouts.stripeSessionId })
    .from(checkouts)
    .where(and(eq(checkouts.stripeSessionId, sessionId), eq(checkouts.state, "open")));
  if (checkout) await closeOrComplete(db, payments, checkout);
}

/**
 * Stripe's back link: closes the owner's open Checkout of this session by the closing rule, so its units come back at
 * once; one that turns out paid becomes an Order instead. Nothing happens for another owner's Checkout, or one that is
 * no longer open.
 */
export async function cancelCheckout(db: Db, payments: Payments, ownerId: string, sessionId: string): Promise<void> {
  const [checkout] = await db
    .select({ id: checkouts.id, stripeSessionId: checkouts.stripeSessionId })
    .from(checkouts)
    .where(and(eq(checkouts.stripeSessionId, sessionId), eq(checkouts.userId, ownerId), eq(checkouts.state, "open")));
  if (checkout) await closeOrComplete(db, payments, checkout);
}

/** The Order of the Checkout with this Stripe session, only if it belongs to `ownerId`. */
export async function getOrder(db: Db, ownerId: string, sessionId: string): Promise<Order | undefined> {
  return findOrder(db, and(eq(checkouts.stripeSessionId, sessionId), eq(orders.userId, ownerId))!);
}

async function findOrder(db: Db, where: SQL): Promise<Order | undefined> {
  const [order] = await db
    .select({
      number: orders.number,
      email: orders.email,
      name: orders.deliveryName,
      line1: orders.deliveryLine1,
      line2: orders.deliveryLine2,
      city: orders.deliveryCity,
      postalCode: orders.deliveryPostalCode,
      country: orders.deliveryCountry,
      totalCents: orders.totalCents,
    })
    .from(orders)
    .innerJoin(checkouts, eq(checkouts.id, orders.checkoutId))
    .where(where);
  if (!order) return undefined;
  const items = await db
    .select({
      productSlug: products.slug,
      productName: orderItems.productName,
      images: products.images,
      quantity: orderItems.quantity,
      unitPriceCents: orderItems.unitPriceCents,
    })
    .from(orderItems)
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(eq(orderItems.orderNumber, order.number))
    .orderBy(asc(orderItems.productId));
  const { number, email, totalCents, ...deliveryAddress } = order;
  return {
    number: `LUX-${number}`,
    items: items.map(({ images, ...item }) => ({ ...item, packshot: images[0] })),
    totalCents,
    email,
    deliveryAddress,
  };
}

/** The closing rule: ends the Checkout's session first, and returns its units only once it can no longer be paid. */
async function closeCheckout(db: Db, payments: Payments, checkout: OpenCheckout) {
  if ((await endSession(payments, checkout)) === "already-paid") return "already-paid";
  return (await closeOpenCheckout(db, checkout)) ? "closed" : "not-open";
}

/** The closing rule, and a Checkout that turns out paid becomes an Order instead. */
async function closeOrComplete(db: Db, payments: Payments, checkout: OpenCheckout) {
  const result = await closeCheckout(db, payments, checkout);
  // Only a Checkout with a session can turn out paid
  if (result === "already-paid") await completeCheckout(db, payments, checkout.stripeSessionId!);
  return result;
}

async function openCheckoutOf(db: Db, ownerId: string): Promise<OpenCheckout | undefined> {
  const [checkout] = await db
    .select({ id: checkouts.id, stripeSessionId: checkouts.stripeSessionId })
    .from(checkouts)
    .where(and(eq(checkouts.userId, ownerId), eq(checkouts.state, "open")));
  return checkout;
}

/** Makes the Checkout's Stripe session unpayable, unless it was paid first. */
async function endSession(payments: Payments, checkout: OpenCheckout) {
  // No session: creating it failed, or it is still being created and its start will see the Checkout closed
  if (!checkout.stripeSessionId) return "expired";
  return payments.expireSession(checkout.stripeSessionId);
}

/**
 * Marks an open Checkout closed and puts its units back in Stock, both or neither. Call it only once the session the
 * caller saw (`stripeSessionId`) can no longer be paid. False if the Checkout is no longer open, so two closings never
 * return its units twice, or if a session was recorded since, which nobody has ended.
 */
async function closeOpenCheckout(db: Db, { id, stripeSessionId }: OpenCheckout): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [closed] = await tx
      .update(checkouts)
      .set({ state: "closed" })
      .where(
        and(
          eq(checkouts.id, id),
          eq(checkouts.state, "open"),
          stripeSessionId ? eq(checkouts.stripeSessionId, stripeSessionId) : isNull(checkouts.stripeSessionId),
        ),
      )
      .returning({ id: checkouts.id });
    if (!closed) return false;
    await tx
      .update(products)
      .set({ stock: sql`${products.stock} + ${checkoutItems.quantity}` })
      .from(checkoutItems)
      .where(and(eq(checkoutItems.checkoutId, id), eq(checkoutItems.productId, products.id)));
    return true;
  });
}
