"use server";

// Server functions for the Bag: each resolves the session and calls the Bag module. No Bag rules here.
// They are reachable by a direct POST, so every one checks the session and treats its arguments as untrusted.
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import {
  addToBag,
  emptyBag,
  getBag,
  removeFromBag,
  setQuantity,
  type AddToBagResult,
  type Bag,
  type SetQuantityResult,
} from "@/lib/bag";

async function currentUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id;
}

/** Adds one unit for the signed-in User and returns the Bag as it is now. Guests get "signed-out" until Guest Bags exist. */
export async function addToBagAction(
  productSlug: string,
): Promise<(AddToBagResult & { bag: Bag }) | { status: "signed-out" }> {
  const userId = await currentUserId();
  if (!userId) return { status: "signed-out" };
  const result = await addToBag(db, userId, String(productSlug));
  return { ...result, bag: await getBag(db, userId) };
}

/** Sets a Bag item's quantity and returns the Bag as it is now, changed or not. */
export async function setQuantityAction(
  productSlug: string,
  quantity: number,
): Promise<(SetQuantityResult & { bag: Bag }) | { status: "signed-out" }> {
  const userId = await currentUserId();
  if (!userId) return { status: "signed-out" };
  const result = await setQuantity(db, userId, String(productSlug), Number(quantity));
  return { ...result, bag: await getBag(db, userId) };
}

/** Takes a Bag item out and returns the Bag as it is now. */
export async function removeFromBagAction(productSlug: string): Promise<Bag> {
  const userId = await currentUserId();
  if (!userId) return emptyBag;
  await removeFromBag(db, userId, String(productSlug));
  return getBag(db, userId);
}

/** The signed-in User's Bag; a Guest's is empty. */
export async function getBagAction(): Promise<Bag> {
  const userId = await currentUserId();
  if (!userId) return emptyBag;
  return getBag(db, userId);
}
