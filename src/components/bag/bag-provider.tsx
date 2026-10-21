"use client";

import { createContext, use, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import type { Bag } from "@/lib/bag";
import { getBagAction, type OwnedBag } from "@/lib/bag-actions";

type BagContextValue = {
  /** The Bag of whoever has a session, Guest or User; empty before a Guest's first "Add to bag". */
  bag: Bag;
  /** Shows a Bag a server function just returned; false if it belongs to someone no longer signed in. */
  setBag: (owned: OwnedBag) => boolean;
  /** Whether the Bag drawer is open. */
  open: boolean;
  /** Opens the Bag drawer and reloads the Bag, so its prices and Stock flags are current. */
  openBag: () => void;
  closeBag: () => void;
  /** Reloads the Bag after it changed elsewhere (an Order took its bought units). */
  reloadBag: () => void;
};

// Not `emptyBag` from the Bag module: importing a value from it would pull the database code into the browser bundle
const noBag: Bag = { items: [], units: 0, subtotalCents: 0 };

const BagContext = createContext<BagContextValue | null>(null);

// Stripe's back link lands on `/?bag=open` (the Checkout cancel route). Read once per page load, so the drawer opens on
// arrival only, not again after the flag is dropped from the address.
let arrivedToOpenBag: boolean | undefined;
const arrivedToOpenBagNow = () =>
  (arrivedToOpenBag ??= new URLSearchParams(window.location.search).get("bag") === "open");
const neverChanges = () => () => {};

/**
 * Shares the Bag and the Bag drawer's open state between the header, "Add to bag" and the drawer. Loads the Bag
 * whenever the signed-in user changes and each time the drawer opens; the Bag is kept with the user it belongs to,
 * so signing out (or in as someone else) never shows a stale one.
 */
export function BagProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  // `beforeSession`: written by a Guest's first "Add to bag", which signed them in on the server before the client
  // knows their session. Shown until that session arrives; it then belongs to the user it names.
  const [shownBag, setShownBag] = useState<(OwnedBag & { beforeSession: boolean }) | null>(null);
  // Closed on the server and while hydrating; open from the first client render after arriving by Stripe's back link
  const arrivedOpen = useSyncExternalStore(neverChanges, arrivedToOpenBagNow, () => false);
  // Null until the drawer is first opened or closed here
  const [openChoice, setOpen] = useState<boolean | null>(null);
  const open = openChoice ?? arrivedOpen;
  // Bumped by every load, every local write and every change of user. A load is applied only if nothing bumped it
  // while it was in flight, so it never overwrites a newer load, a newer write or the next user's Bag.
  const version = useRef(0);
  // The signed-in user now; a write that resolves after the user changed belongs to the old one and is ignored
  const currentUserId = useRef(userId);

  // On failure the Bag keeps what it showed; it reloads when the user changes, the drawer opens or after the next write
  const load = (ownerId: string) => {
    const loadVersion = ++version.current;
    getBagAction()
      .then((bag) => {
        if (version.current === loadVersion) setShownBag({ ownerId, bag, beforeSession: false });
      })
      .catch((error) => console.error("Could not load the Bag", error));
  };

  useEffect(() => {
    currentUserId.current = userId;
    if (userId) load(userId);
    return () => {
      version.current += 1;
    };
  }, [userId]);

  // Drops the flag, so a reload does not open the drawer again. The Bag itself loads with the session, as above.
  useEffect(() => {
    if (!arrivedOpen) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("bag");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [arrivedOpen]);

  const setBag = ({ ownerId, bag }: OwnedBag) => {
    // Started for a user who is no longer the signed-in one, or (server and client disagreeing) for someone else
    if (userId !== currentUserId.current || (userId && ownerId !== userId)) return false;
    version.current += 1;
    setShownBag({ ownerId, bag, beforeSession: !userId });
    return true;
  };

  const openBag = () => {
    setOpen(true);
    if (userId) load(userId);
  };

  const reloadBag = () => {
    if (userId) load(userId);
  };

  const shown = shownBag && (userId ? shownBag.ownerId === userId : shownBag.beforeSession);
  const bag = shown ? shownBag.bag : noBag;
  return (
    <BagContext value={{ bag, setBag, open, openBag, closeBag: () => setOpen(false), reloadBag }}>{children}</BagContext>
  );
}

export function useBag() {
  const value = use(BagContext);
  if (!value) throw new Error("useBag must be used within a BagProvider");
  return value;
}
