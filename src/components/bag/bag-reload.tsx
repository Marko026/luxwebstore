"use client";

import { useEffect } from "react";
import { useBag } from "@/components/bag/bag-provider";

/**
 * Reloads the Bag once it renders. The confirmation page streams it in after the Order took the bought units out of
 * the Bag, while the header may have loaded the Bag before that.
 */
export function BagReload() {
  const { reloadBag } = useBag();
  // Once per mount: `reloadBag` is a new function on every render of the provider
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reloadBag, []);
  return null;
}
