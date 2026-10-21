// Stripe's back link (its cancel URL, with the session id): closes the Checkout and goes home with the Bag drawer open.
// No Checkout rules here.
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { cancelCheckout } from "@/lib/checkout";
import { currentUserId } from "@/lib/current-user";
import { stripePayments } from "@/lib/stripe-payments";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  const ownerId = await currentUserId();
  if (sessionId && ownerId) {
    // Going home must not fail over it: the Checkout stays open, its units still count as the owner's in their Bag,
    // and their next start or the sweep closes it
    // The session id comes from the address, so it is logged as an argument, never as the format string
    await cancelCheckout(db, stripePayments, ownerId, sessionId).catch((error) =>
      console.error("Could not cancel the Checkout of session", sessionId, error),
    );
  }
  // `BagProvider` opens the drawer on arrival
  redirect("/?bag=open");
}
