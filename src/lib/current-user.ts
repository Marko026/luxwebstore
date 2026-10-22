import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/** Whoever is signed in, a Guest (an anonymous user, ADR 0001) or a User; undefined when there is no session. */
export async function currentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ? { id: session.user.id, isGuest: Boolean(session.user.isAnonymous) } : undefined;
}

/** The id of whoever is signed in, Guest or User; undefined when there is no session. */
export async function currentUserId() {
  return (await currentUser())?.id;
}
