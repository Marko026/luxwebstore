import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RefreshOnSignIn } from "@/components/auth/refresh-on-sign-in";
import { SiteFooter } from "@/components/home/site-footer";
import { SiteHeader } from "@/components/home/site-header";
import { formatOrderDate, OrderSummary } from "@/components/order/order-summary";
import { db } from "@/db";
import { getOrderByNumber } from "@/lib/checkout";
import { currentUser } from "@/lib/current-user";

export const metadata: Metadata = {
  title: "Order — Luxwebstore",
};

/**
 * One of a User's Orders, by its Order number (spec #36). Anyone else, a Guest, or an Order number that is not theirs
 * gets "not found", so the page never tells whether that Order exists.
 */
export default function OrderPage({ params }: PageProps<"/account/orders/[number]">) {
  return (
    <>
      <SiteHeader overlay={false} />
      <main className="flex-1 px-gutter pt-32 pb-24">
        <RefreshOnSignIn />
        <Suspense fallback={<p className="text-center text-sm text-muted">Loading your order…</p>}>
          <OrderDetails params={params} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function OrderDetails({ params }: Pick<PageProps<"/account/orders/[number]">, "params">) {
  const { number } = await params;
  const owner = await currentUser();
  if (!owner || owner.isGuest) notFound();
  const order = await getOrderByNumber(db, owner.id, number);
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <div className="text-center">
        <h1 className="text-2xl font-thin">Order {order.number}</h1>
        <p className="mt-3 text-sm text-muted">{formatOrderDate(order.createdAt)}</p>
      </div>

      <OrderSummary order={order} />

      <p className="mt-16 text-center">
        <Link href="/account/orders" className="link-wipe text-xs">
          Back to my orders
        </Link>
      </p>
    </div>
  );
}
