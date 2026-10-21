"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useBag } from "@/components/bag/bag-provider";
import { Drawer } from "@/components/drawer";
import type { Bag, BagItem } from "@/lib/bag";
import { removeFromBagAction, setQuantityAction } from "@/lib/bag-actions";
import { formatPrice, productHref } from "@/lib/products";

function noteFor(item: BagItem) {
  if (item.availability === "sold-out") return "Sold out";
  if (item.availability === "short") return `Only ${item.stock} left`;
  return "";
}

/**
 * The Bag drawer: each Bag item with a − n + stepper and "Remove", the Subtotal, and a disabled Checkout. Opens from the
 * header bag icon and after a successful "Add to bag". A sold-out or short Bag item stays and is flagged; nothing is
 * changed without the shopper doing it. One change at a time: the controls wait while one is on its way.
 */
export function BagDrawer() {
  const { bag, setBag, open, closeBag } = useBag();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const change = (write: () => Promise<Bag | null>) => {
    if (pending) return;
    setError("");
    startTransition(async () => {
      try {
        const next = await write();
        if (next) setBag(next);
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  };

  const setQuantity = (slug: string, quantity: number) =>
    change(async () => {
      const result = await setQuantityAction(slug, quantity);
      // A rejected quantity (Stock changed meanwhile) still returns the current Bag, which flags the Bag item
      return result.status === "signed-out" ? null : result.bag;
    });
  const remove = (slug: string) => change(() => removeFromBagAction(slug));

  const label = "text-xs font-bold tracking-[-0.05em] uppercase";

  return (
    <Drawer open={open} onClose={closeBag} id="bag" label="Bag" closeLabel="Close bag">
      <div className="flex h-full flex-col">
        <h2 className={`flex h-20 shrink-0 items-center px-8 sm:pl-16 ${label}`}>
          Bag{bag.units > 0 && ` (${bag.units})`}
        </h2>

        {bag.items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 pb-20 text-center">
            <p className="text-lg font-thin">Your bag is empty</p>
            <Link href="/new-arrivals" onClick={closeBag} className="link-wipe text-xs">
              Shop New Arrivals
            </Link>
          </div>
        ) : (
          <>
            <ul aria-busy={pending} className="flex-1 overflow-y-auto px-8 sm:pl-16">
              {bag.items.map((item) => {
                const note = noteFor(item);
                const soldOut = item.availability === "sold-out";
                return (
                  <li key={item.slug} className="flex gap-5 py-4">
                    <Link
                      href={productHref(item.slug)}
                      onClick={closeBag}
                      tabIndex={-1}
                      aria-hidden
                      className={`relative size-24 shrink-0 bg-tile ${soldOut ? "opacity-50" : ""}`}
                    >
                      {item.packshot && (
                        <Image src={item.packshot.src} alt="" fill sizes="6rem" className="object-contain" />
                      )}
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col text-xs">
                      <div className="flex justify-between gap-4">
                        <Link href={productHref(item.slug)} onClick={closeBag} className="link-reveal truncate">
                          {item.name}
                        </Link>
                        <span className="shrink-0">{formatPrice(item.priceCents)}</span>
                      </div>
                      {note && <p className="mt-1 font-bold">{note}</p>}
                      <div className="mt-auto flex items-center justify-between pt-3">
                        <div role="group" aria-label={`Quantity of ${item.name}`} className="-ml-3 flex items-center">
                          <button
                            type="button"
                            onClick={() => setQuantity(item.slug, Math.min(item.quantity - 1, item.stock))}
                            disabled={pending || soldOut || item.quantity <= 1}
                            aria-label={`One less ${item.name}`}
                            className="grid size-10 place-items-center text-base disabled:opacity-30"
                          >
                            −
                          </button>
                          <span className="min-w-4 text-center">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => setQuantity(item.slug, item.quantity + 1)}
                            disabled={pending || item.quantity >= item.stock}
                            aria-label={`One more ${item.name}`}
                            className="grid size-10 place-items-center text-base disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(item.slug)}
                          disabled={pending}
                          aria-label={`Remove ${item.name}`}
                          className="link-wipe"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="shrink-0 border-t border-line px-8 pt-6 pb-8 sm:pl-16">
              <p aria-live="polite" className="mb-3 text-xs empty:mb-0">
                {error}
              </p>
              <div className="flex items-baseline justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatPrice(bag.subtotalCents)}</span>
              </div>
              <p className="mt-1 text-xs text-muted">VAT included</p>
              <button
                type="button"
                disabled
                aria-describedby="checkout-soon"
                className="btn btn-dark mt-6 h-12 w-full disabled:pointer-events-none disabled:opacity-40"
              >
                Checkout
              </button>
              <p id="checkout-soon" className="mt-3 text-center text-xs text-muted">
                Checkout opens soon
              </p>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
