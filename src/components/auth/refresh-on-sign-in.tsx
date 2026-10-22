"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Renders the page again on the server when a User signs in or out here (or a Guest signs in), so a page that shows a
 * User's own data never keeps showing it to the wrong person, nor a sign-in prompt to someone who just signed in.
 */
export function RefreshOnSignIn() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  // A Guest counts as signed out (ADR 0001)
  const userId = isPending ? undefined : session && !session.user.isAnonymous ? session.user.id : null;
  // Who the page was shown to: the first settled session, which the server rendered for
  const shownTo = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (userId === undefined) return;
    if (shownTo.current !== undefined && shownTo.current !== userId) router.refresh();
    shownTo.current = userId;
  }, [userId, router]);
  return null;
}
