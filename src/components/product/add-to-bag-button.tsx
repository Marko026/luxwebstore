"use client";

import { useState, useTransition } from "react";
import { AuthModal } from "@/components/auth/auth-modal";
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
 * out of date: the result shows under the button and is announced. A Guest is asked to sign in for now.
 */
export function AddToBagButton({ slug, soldOut }: { slug: string; soldOut: boolean }) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const { setBag, openBag } = useBag();
  const [message, setMessage] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const add = () => {
    if (pending) return;
    if (!sessionPending && !session) {
      setAuthOpen(true);
      return;
    }
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
      if (result.status === "signed-out") {
        setAuthOpen(true);
        return;
      }
      setBag(result.bag);
      setMessage(messageFor(result));
      // Only a unit that went in opens the drawer; "Only N available" and "Just sold out" stay on the page
      if (result.status === "added") openBag();
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
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
