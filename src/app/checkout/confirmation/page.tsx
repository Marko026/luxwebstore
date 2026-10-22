import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BagReload } from "@/components/bag/bag-reload";
import { SiteFooter } from "@/components/home/site-footer";
import { SiteHeader } from "@/components/home/site-header";
import { OrderSummary } from "@/components/order/order-summary";
import { db } from "@/db";
import { completeCheckout, getOrder } from "@/lib/checkout";
import { currentUser } from "@/lib/current-user";
import { stripePayments } from "@/lib/stripe-payments";

export const metadata: Metadata = {
  title: "Thank you — Luxwebstore",
};

/**
 * Where Stripe sends the Customer after paying (its success URL, with the session id). Makes the Order if Stripe's
 * webhook has not yet, then shows it, only to its owner: anyone else, or an unknown session, gets "not found".
 */
export default function CheckoutConfirmationPage({ searchParams }: PageProps<"/checkout/confirmation">) {
  return (
    <>
      <SiteHeader overlay={false} />
      <main className="flex-1 px-gutter pt-32 pb-24">
        <Suspense fallback={<p className="text-center text-sm text-muted">Confirming your payment…</p>}>
          <Confirmation searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function Confirmation({ searchParams }: Pick<PageProps<"/checkout/confirmation">, "searchParams">) {
  const sessionId = (await searchParams).session_id;
  const owner = await currentUser();
  if (typeof sessionId !== "string" || !owner) notFound();
  await completeCheckout(db, stripePayments, sessionId);
  const order = await getOrder(db, owner.id, sessionId);
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <BagReload />
      <div className="text-center">
        <h1 className="text-2xl font-thin">Thank you</h1>
        <p className="mt-3 text-sm">
          Your order <span className="font-bold">{order.number}</span> is confirmed.
        </p>
      </div>

      <OrderSummary order={order} />

      <p className="mt-16 flex justify-center gap-8 text-xs">
        {/* A Guest has no My orders yet: their Orders show there once they sign in */}
        {!owner.isGuest && (
          <Link href="/account/orders" className="link-wipe">
            See all your orders
          </Link>
        )}
        <Link href="/" className="link-wipe">
          Continue shopping
        </Link>
      </p>
    </div>
  );
}
