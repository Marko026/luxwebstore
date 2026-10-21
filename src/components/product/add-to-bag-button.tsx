"use client";

import { useState, useTransition } from "react";
import { useBag } from "@/components/bag/bag-provider";
import { authClient } from "@/lib/auth-client";
import { addToBagAction } from "@/lib/bag-actions";

type AddResult = Awaited<ReturnType<typeof addToBagAction>>;

function messageFor(result: AddResult) {
  switch (result.status) {
    case "capped":
      return `Only ${result.available} available`;
    case "sold-out":
      return "Just sold out";
    case "unknown-product":
      return "This product is no longer available";
    default:
      return "";
  }
}

/**
 * "Add to bag" on the product page. Stock is checked live on the server, so the page's (cached) stock label can be
 * out of date: the result shows under the button and is announced. A Guest with no session yet is signed in
 * anonymously by the first add (ADR 0001), so the client session is refetched afterwards.
 */
export function AddToBagButton({ slug, soldOut }: { slug: string; soldOut: boolean }) {
  const { data: session, refetch: refetchSession } = authClient.useSession();
  const { setBag, openBag } = useBag();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const add = () => {
    if (pending) return;
    const hadSession = !!session;
    // Cleared first, so the same message twice in a row is announced again
    setMessage("");
    startTransition(async () => {
      let result: AddResult;
      try {
        result = await addToBagAction(slug);
      } catch {
        setMessage("Something went wrong. Please try again.");
        return;
      }
      // Shown at once, even for a Guest the client doesn't know is signed in yet: the result names the Bag's owner
      setBag(result);
      setMessage(messageFor(result));
      // Only a unit that went in opens the drawer; "Only N available" and "Just sold out" stay on the page
      if (result.status === "added") openBag();
      // A first add signed a Guest in on the server; once the client knows that session, the Bag loads for it
      if (!hadSession) refetchSession().catch((error) => console.error("Could not refresh the session", error));
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={add}
        disabled={soldOut}
        aria-busy={pending}
        className="btn btn-dark mt-4 h-12 w-full disabled:pointer-events-none disabled:opacity-40"
      >
        {soldOut ? "Sold out" : "Add to bag"}
      </button>
      <p aria-live="polite" className="mt-3 text-xs empty:mt-0">
        {message}
      </p>
    </>
  );
}
