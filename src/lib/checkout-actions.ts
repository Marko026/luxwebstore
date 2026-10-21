"use server";

// Server function for "Checkout" in the Bag drawer: resolves the session and calls the Checkout module. No Checkout
// rules here. Reachable by a direct POST, so it checks the session itself.
import { db } from "@/db";
import { getBag } from "@/lib/bag";
import type { OwnedBag, SignedOut } from "@/lib/bag-actions";
import { startCheckout, type StartCheckoutResult } from "@/lib/checkout";
import { currentUserId } from "@/lib/current-user";
import { stripePayments } from "@/lib/stripe-payments";

/** A start's result (Stripe's payment page, or why not), with the owner's Bag as it is now. */
export type CheckoutStart = StartCheckoutResult & OwnedBag;

/**
 * Starts a Checkout for whoever is signed in. The client goes to the returned payment page itself: a `redirect` here
 * would reject the call on the client, where it reads as a failure.
 */
export async function startCheckoutAction(): Promise<CheckoutStart | SignedOut> {
  const ownerId = await currentUserId();
  if (!ownerId) return { status: "signed-out" };
  // Checked before anything is held: without it Stripe refuses the session only after the units left Stock
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is not set");
  const result = await startCheckout(db, stripePayments, ownerId, {
    // Stripe fills in the session id. A placeholder page until a paid Checkout becomes an Order (#25).
    successUrl: `${appUrl}/checkout/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    // Stripe's back link; it releases the Checkout once that route exists (#26)
    cancelUrl: `${appUrl}/`,
  });
  return { ...result, ownerId, bag: "bag" in result ? result.bag : await getBag(db, ownerId) };
}
