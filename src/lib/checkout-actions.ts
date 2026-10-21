"use server";

// Server function for "Checkout" in the Bag drawer: resolves the session and calls the Checkout module. No Checkout
// rules here. Reachable by a direct POST, so it checks the session itself.
import { redirect } from "next/navigation";
import { db } from "@/db";
import { getBag } from "@/lib/bag";
import type { OwnedBag, SignedOut } from "@/lib/bag-actions";
import { startCheckout, type StartCheckoutResult } from "@/lib/checkout";
import { currentUserId } from "@/lib/current-user";
import { stripePayments } from "@/lib/stripe-payments";

/** Why no Checkout started, with the owner's Bag as it is now. */
export type CheckoutRefusal = Exclude<StartCheckoutResult, { status: "started" }> & OwnedBag;

/** Starts a Checkout for whoever is signed in and redirects to Stripe's payment page; otherwise says why not. */
export async function startCheckoutAction(): Promise<CheckoutRefusal | SignedOut> {
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
  // Outside any try: `redirect` throws to navigate
  if (result.status === "started") redirect(result.url);
  return { ...result, ownerId, bag: "bag" in result ? result.bag : await getBag(db, ownerId) };
}
