"use server";

// Server functions for the Bag: each resolves the session and calls the Bag module. No Bag rules here.
// They are reachable by a direct POST, so every one checks the session and treats its arguments as untrusted.
import { getIP } from "better-auth/api";
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import {
  addToBag,
  addToBagAsNewGuest,
  emptyBag,
  getBag,
  removeFromBag,
  setQuantity,
  type AddToBagResult,
  type Bag,
  type NewGuestRefusal,
  type SetQuantityResult,
} from "@/lib/bag";
import { currentUserId } from "@/lib/current-user";
import { consumeRateLimit } from "@/lib/rate-limit";

/** A Bag as it is now and whose it is, so the client can tell whether it still belongs to who is signed in. */
export type OwnedBag = { ownerId: string; bag: Bag };

/** A change asked for with no session (it expired, or the Guest never had one): nothing changed. */
export type SignedOut = { status: "signed-out" };

/** The result of one Bag change, with the owner's Bag as it is after it. */
async function withBag<Result>(ownerId: string, result: Result): Promise<Result & OwnedBag> {
  return { ...result, ownerId, bag: await getBag(db, ownerId) };
}

/** Runs one Bag change for whoever is signed in, Guest or User. */
async function changeSignedInBag<Result>(
  change: (ownerId: string) => Promise<Result>,
): Promise<(Result & OwnedBag) | SignedOut> {
  const ownerId = await currentUserId();
  if (!ownerId) return { status: "signed-out" };
  return withBag(ownerId, await change(ownerId));
}

// New Guests per client IP (ADR 0002). Generous for Guests sharing one IP, small next to scripted sign-ins.
const newGuestsPerClient = { max: 10, windowSeconds: 60 * 60 };

/** Signs a new Guest in anonymously (the session cookie is set on this response); null when the client is over the limit. */
async function signInNewGuest() {
  const requestHeaders = await headers();
  // Better Auth's own reading of the client IP, so it trusts forwarded headers only as `auth` is configured. With no
  // trustworthy IP every such client shares one limit: it stays bounded, as Better Auth's own rate limit does.
  const ip = getIP(requestHeaders, auth.options) ?? "unknown";
  if (!(await consumeRateLimit(db, `new-guest:${ip}`, newGuestsPerClient))) return null;
  return (await auth.api.signInAnonymous({ headers: requestHeaders })).user.id;
}

/**
 * Adds one unit and returns the Bag as it is now. Someone with no session is a Guest adding for the first time: they
 * are signed in anonymously here, never earlier (ADR 0001), and only for a product that can go in the Bag (ADR 0002).
 */
export async function addToBagAction(
  productSlug: string,
): Promise<(AddToBagResult & OwnedBag) | NewGuestRefusal> {
  const slug = String(productSlug);
  const ownerId = await currentUserId();
  if (ownerId) return withBag(ownerId, await addToBag(db, ownerId, slug));
  const result = await addToBagAsNewGuest(db, slug, signInNewGuest);
  return "ownerId" in result ? withBag(result.ownerId, result) : result;
}

/** Sets a Bag item's quantity and returns the Bag as it is now, changed or not. */
export async function setQuantityAction(
  productSlug: string,
  quantity: number,
): Promise<(SetQuantityResult & OwnedBag) | SignedOut> {
  return changeSignedInBag((ownerId) => setQuantity(db, ownerId, String(productSlug), Number(quantity)));
}

/** Takes a Bag item out and returns the Bag as it is now. */
export async function removeFromBagAction(
  productSlug: string,
): Promise<({ status: "removed" } & OwnedBag) | SignedOut> {
  return changeSignedInBag(async (ownerId) => {
    await removeFromBag(db, ownerId, String(productSlug));
    return { status: "removed" as const };
  });
}

/** The Bag of whoever is signed in, Guest or User; empty when there is no session yet. */
export async function getBagAction(): Promise<Bag> {
  const userId = await currentUserId();
  if (!userId) return emptyBag;
  return getBag(db, userId);
}
