"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useBag } from "@/components/bag/bag-provider";
import { Drawer } from "@/components/drawer";
import { MinusIcon, PlusIcon } from "@/components/home/icons";
import type { BagItem } from "@/lib/bag";
import { removeFromBagAction, setQuantityAction, type OwnedBag, type SignedOut } from "@/lib/bag-actions";
import { startCheckoutAction, type CheckoutStart } from "@/lib/checkout-actions";
import { formatPrice, productHref } from "@/lib/products";

// A round 48px icon button (design reference §6), outlined with the hairline used around form fields (§7)
const stepperButton =
  "grid size-12 place-items-center rounded-full border border-line transition-[border-color,scale] duration-(--t-press) hover:border-ink active:scale-95 disabled:pointer-events-none disabled:opacity-30";

// Why pressing "Checkout" started nothing
const checkoutRefusals: Record<Exclude<CheckoutStart["status"], "started">, string> = {
  "empty-bag": "Your bag is empty.",
  "bag-not-ready": "An item in your bag sold out or ran short meanwhile.",
  "earlier-checkout-paid": "Your earlier checkout has already been paid.",
  "too-many-starts": "Too many attempts. Please try again later.",
};

function noteFor(item: BagItem) {
  if (item.stockStatus === "sold-out") return "Sold out";
  if (item.stockStatus === "short") return `Only ${item.stock} left`;
  return "";
}

/**
 * The Bag drawer: each Bag item with a − n + stepper and "Remove", the Subtotal, and "Checkout". Opens from the header
 * bag icon and after a successful "Add to bag". A sold-out or short Bag item stays and is flagged, and blocks
 * "Checkout"; nothing is changed without the Guest or User doing it. One change at a time: the controls wait while one
 * is on its way.
 */
export function BagDrawer() {
  const { bag, setBag, open, closeBag } = useBag();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  // On the way to Stripe's payment page: the controls stay disabled until it opens
  const [leaving, setLeaving] = useState(false);

  // Coming back with the browser's back button can restore this page as it was left, controls disabled
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setLeaving(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);
  const busy = pending || leaving;

  // Shows the Bag the change returns, even a rejected quantity's (Stock changed meanwhile): it flags the Bag item.
  // Signed out meanwhile: nothing changed, and the provider stops showing the Bag once the session is gone.
  const runBagChange = (bagChange: () => Promise<OwnedBag | SignedOut>) => {
    if (busy) return;
    setError("");
    startTransition(async () => {
      try {
        const result = await bagChange();
        if ("bag" in result) setBag(result);
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  };

  const setQuantity = (slug: string, quantity: number) => runBagChange(() => setQuantityAction(slug, quantity));
  const remove = (slug: string) => runBagChange(() => removeFromBagAction(slug));

  // Started: goes to Stripe's payment page. Otherwise shows the Bag as it is now, with any sold-out or short Bag item
  // flagged, and says why. Signed out meanwhile, or a result for someone no longer signed in: nothing to show.
  const checkout = () => {
    if (busy) return;
    setError("");
    startTransition(async () => {
      try {
        const result = await startCheckoutAction();
        if (!("bag" in result) || !setBag(result)) return;
        if (result.status === "started") {
          setLeaving(true);
          window.location.assign(result.url);
          return;
        }
        setError(checkoutRefusals[result.status]);
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  };

  const flagged = bag.items.some((item) => item.stockStatus !== "in-stock");

  return (
    <Drawer open={open} onClose={closeBag} id="bag" label="Bag" closeLabel="Close bag">
      <div className="flex h-full flex-col">
        <h2 className="flex h-20 shrink-0 items-center px-8 uppercase ui-label sm:pl-16">
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
            <ul aria-busy={busy} className="flex-1 overflow-y-auto px-8 sm:pl-16">
              {bag.items.map((item) => {
                const note = noteFor(item);
                const soldOut = item.stockStatus === "sold-out";
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
                        <div role="group" aria-label={`Quantity of ${item.name}`} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => item.oneLess && setQuantity(item.slug, item.oneLess)}
                            disabled={busy || item.oneLess === null}
                            aria-label={`One less ${item.name}`}
                            className={stepperButton}
                          >
                            <MinusIcon />
                          </button>
                          <span className="min-w-4 text-center">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => item.oneMore && setQuantity(item.slug, item.oneMore)}
                            disabled={busy || item.oneMore === null}
                            aria-label={`One more ${item.name}`}
                            className={stepperButton}
                          >
                            <PlusIcon />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(item.slug)}
                          disabled={busy}
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
                onClick={checkout}
                disabled={busy || flagged}
                aria-describedby="checkout-blocked"
                className="btn btn-dark mt-6 h-12 w-full disabled:pointer-events-none disabled:opacity-40"
              >
                Checkout
              </button>
              <p id="checkout-blocked" aria-live="polite" className="mt-3 text-center text-xs text-muted empty:mt-0">
                {flagged && "Lower or remove the marked items to check out."}
              </p>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
