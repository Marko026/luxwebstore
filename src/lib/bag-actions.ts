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

/** Adds one unit for the signed-in User and returns the new unit count. Guests get "signed-out" until Guest Bags exist. */
export async function addToBagAction(
  productSlug: string,
): Promise<(AddToBagResult & { units: number }) | { status: "signed-out" }> {
  const userId = await currentUserId();
  if (!userId) return { status: "signed-out" };
  const result = await addToBag(db, userId, String(productSlug));
  return { ...result, units: (await getBag(db, userId)).units };
}

/** The signed-in User's Bag; a Guest's is empty. */
export async function getBagAction(): Promise<Bag> {
  const userId = await currentUserId();
  if (!userId) return emptyBag;
  return getBag(db, userId);
}
