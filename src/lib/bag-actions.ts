"use server";

// Server functions for the Bag: each resolves the session and calls the Bag module. No Bag rules here.
// They are reachable by a direct POST, so every one checks the session and treats its arguments as untrusted.
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { addToBag, emptyBag, getBag, type AddToBagResult, type Bag } from "@/lib/bag";

async function currentUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id;
}

/**
 * Adds one unit and returns the new unit count. Someone with no session is a Guest adding for the first time: they
 * are signed in anonymously here (the session cookie is set on this response), never earlier (ADR 0001).
 */
export async function addToBagAction(productSlug: string): Promise<AddToBagResult & { units: number }> {
  const ownerId =
    (await currentUserId()) ?? (await auth.api.signInAnonymous({ headers: await headers() })).user.id;
  const result = await addToBag(db, ownerId, String(productSlug));
  return { ...result, units: (await getBag(db, ownerId)).units };
}

/** The Bag of whoever is signed in, Guest or User; empty when there is no session yet. */
export async function getBagAction(): Promise<Bag> {
  const userId = await currentUserId();
  if (!userId) return emptyBag;
  return getBag(db, userId);
}
