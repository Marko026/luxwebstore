import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { RefreshOnSignIn } from "@/components/auth/refresh-on-sign-in";
import { SignInPrompt } from "@/components/auth/sign-in-prompt";
import { SiteFooter } from "@/components/home/site-footer";
import { SiteHeader } from "@/components/home/site-header";
import { formatOrderDate } from "@/components/order/order-summary";
import { db } from "@/db";
import { listOrders } from "@/lib/checkout";
import { currentUser } from "@/lib/current-user";
import { formatPrice } from "@/lib/products";

export const metadata: Metadata = {
  title: "My orders — Luxwebstore",
};

/** How many packshots a row shows; an Order with more items shows the first ones. */
const packshotsPerRow = 3;

/** A User's Orders, newest first (spec #36). A Guest, or someone not signed in, is asked to sign in instead. */
export default function MyOrdersPage() {
  return (
    <>
      <SiteHeader overlay={false} />
      <main className="flex-1 px-gutter pt-32 pb-24">
        <RefreshOnSignIn />
        <div className="mx-auto max-w-xl">
          <h1 className="text-center text-2xl font-thin">My orders</h1>
          <Suspense fallback={<p className="mt-16 text-center text-sm text-muted">Loading your orders…</p>}>
            <Orders />
          </Suspense>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

async function Orders() {
  const owner = await currentUser();
  if (!owner || owner.isGuest) {
    return (
      <div className="mt-16">
        <SignInPrompt message="Sign in to see your orders." />
      </div>
    );
  }
  const orders = await listOrders(db, owner.id);
  if (orders.length === 0) {
    return (
      <div className="mt-16 text-center text-sm">
        <p>No orders yet.</p>
        <Link href="/products" className="link-wipe mt-6 inline-block text-xs">
          Browse the bags
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-16 border-t border-line">
      {orders.map(({ number, items, totalCents, createdAt }) => (
        <li key={number} className="border-b border-line">
          <Link href={`/account/orders/${number}`} className="group flex gap-5 py-4 text-xs">
            <div className="flex shrink-0 gap-1">
              {items.slice(0, packshotsPerRow).map((item) => (
                <div key={item.productSlug} className="relative size-16 bg-tile">
                  {item.packshot && (
                    <Image src={item.packshot.src} alt="" fill sizes="4rem" className="object-contain" />
                  )}
                </div>
              ))}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex justify-between gap-4">
                <span className="link-reveal font-bold">{number}</span>
                <span className="shrink-0">{formatPrice(totalCents)}</span>
              </div>
              <p className="mt-1 text-muted">{formatOrderDate(createdAt)}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
