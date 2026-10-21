// Stripe's webhook: a paid session becomes an Order, an expired one closes its Checkout. No Checkout rules here.
// Stripe retries any answer other than 2xx, so a failure answers 500 and the idempotent step runs again.
import { db } from "@/db";
import { completeCheckout, expireCheckout } from "@/lib/checkout";
import { checkoutEventOf, stripePayments, type CheckoutEvent } from "@/lib/stripe-payments";

export async function POST(request: Request) {
  let event: CheckoutEvent;
  try {
    // The raw body: the signature is over the exact bytes Stripe sent
    event = checkoutEventOf(await request.text(), request.headers.get("stripe-signature"));
  } catch (error) {
    console.error("Refused a Stripe webhook request", error);
    return new Response("Invalid webhook request", { status: 400 });
  }
  if (event.type === "completed") await completeCheckout(db, stripePayments, event.sessionId);
  if (event.type === "expired") await expireCheckout(db, stripePayments, event.sessionId);
  return new Response(null, { status: 200 });
}
