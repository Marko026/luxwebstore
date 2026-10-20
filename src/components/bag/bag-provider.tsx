"use client";

import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { getBagAction } from "@/lib/bag-actions";

type BagContextValue = {
  /** Units in the signed-in User's Bag; 0 for a Guest. */
  units: number;
  setUnits: (units: number) => void;
};

const BagContext = createContext<BagContextValue | null>(null);

/**
 * Shares the Bag's unit count between the header and "Add to bag". Loads it whenever the signed-in user changes;
 * the count is kept with the user it belongs to, so signing out (or in as someone else) never shows a stale one.
 */
export function BagProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const [bag, setBag] = useState<{ ownerId: string; units: number } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let current = true;
    // On failure the count keeps what it showed; it reloads when the user changes or after the next add
    getBagAction()
      .then((b) => {
        if (current) setBag({ ownerId: userId, units: b.units });
      })
      .catch((error) => console.error("Could not load the Bag", error));
    return () => {
      current = false;
    };
  }, [userId]);

  const setUnits = (units: number) => {
    if (userId) setBag({ ownerId: userId, units });
  };

  const units = userId && bag?.ownerId === userId ? bag.units : 0;
  return <BagContext value={{ units, setUnits }}>{children}</BagContext>;
}

export function useBag() {
  const value = use(BagContext);
  if (!value) throw new Error("useBag must be used within a BagProvider");
  return value;
}
