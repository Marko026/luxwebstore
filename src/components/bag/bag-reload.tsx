"use client";

import { useEffect, useEffectEvent } from "react";
import { useBag } from "@/components/bag/bag-provider";

/**
 * Reloads the Bag once it renders. The confirmation page streams it in after the Order took the bought units out of
 * the Bag, while the header may have loaded the Bag before that.
 */
export function BagReload() {
  const { reloadBag } = useBag();
  // Once per mount, with whoever is signed in by then
  const onShown = useEffectEvent(reloadBag);
  useEffect(() => onShown(), []);
  return null;
}
