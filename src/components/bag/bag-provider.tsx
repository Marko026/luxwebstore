"use client";

import { createContext, use, useEffect, useRef, useState, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import type { Bag } from "@/lib/bag";
import { getBagAction } from "@/lib/bag-actions";

type BagContextValue = {
  /** The Bag of whoever has a session, Guest or User; empty before a Guest's first "Add to bag". */
  bag: Bag;
  /** Shows a Bag a server function just returned. */
  setBag: (bag: Bag) => void;
  /** Whether the Bag drawer is open. */
  open: boolean;
  /** Opens the Bag drawer and reloads the Bag, so its prices and Stock flags are current. */
  openBag: () => void;
  closeBag: () => void;
};

// Not `emptyBag` from the Bag module: importing a value from it would pull the database code into the browser bundle
const noBag: Bag = { items: [], units: 0, subtotalCents: 0 };

const BagContext = createContext<BagContextValue | null>(null);

/**
 * Shares the Bag and the Bag drawer's open state between the header, "Add to bag" and the drawer. Loads the Bag
 * whenever the signed-in user changes and each time the drawer opens; the Bag is kept with the user it belongs to,
 * so signing out (or in as someone else) never shows a stale one.
 */
export function BagProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const [state, setState] = useState<{ ownerId: string; bag: Bag } | null>(null);
  const [open, setOpen] = useState(false);
  // Counts local writes, so a load that started before a write can't overwrite the newer Bag when it lands later
  const writes = useRef(0);
  // The signed-in user now; a write or load that resolves after the user changed belongs to the old one and is ignored
  const currentUserId = useRef(userId);

  // On failure the Bag keeps what it showed; it reloads when the user changes, the drawer opens or after the next write
  const load = (ownerId: string) => {
    const writesAtStart = writes.current;
    getBagAction()
      .then((bag) => {
        if (currentUserId.current === ownerId && writes.current === writesAtStart) setState({ ownerId, bag });
      })
      .catch((error) => console.error("Could not load the Bag", error));
  };

  useEffect(() => {
    currentUserId.current = userId;
    if (userId) load(userId);
  }, [userId]);

  const setBag = (bag: Bag) => {
    if (!userId || userId !== currentUserId.current) return;
    writes.current += 1;
    setState({ ownerId: userId, bag });
  };

  const openBag = () => {
    setOpen(true);
    if (userId) load(userId);
  };

  const bag = userId && state?.ownerId === userId ? state.bag : noBag;
  return (
    <BagContext value={{ bag, setBag, open, openBag, closeBag: () => setOpen(false) }}>{children}</BagContext>
  );
}

export function useBag() {
  const value = use(BagContext);
  if (!value) throw new Error("useBag must be used within a BagProvider");
  return value;
}
