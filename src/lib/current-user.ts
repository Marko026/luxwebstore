import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/** The id of whoever is signed in, Guest or User; undefined when there is no session. */
export async function currentUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id;
}
