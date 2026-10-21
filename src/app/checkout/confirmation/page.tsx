import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BagReload } from "@/components/bag/bag-reload";
import { SiteFooter } from "@/components/home/site-footer";
import { SiteHeader } from "@/components/home/site-header";
import { db } from "@/db";
import { completeCheckout, getOrder } from "@/lib/checkout";
import { currentUserId } from "@/lib/current-user";
import { formatPrice, productHref } from "@/lib/products";
import { stripePayments } from "@/lib/stripe-payments";

export const metadata: Metadata = {
  title: "Thank you — Luxwebstore",
};

const sectionTitle = "text-sm font-bold uppercase tracking-normal";
const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

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
  const ownerId = await currentUserId();
  if (typeof sessionId !== "string" || !ownerId) notFound();
  await completeCheckout(db, stripePayments, sessionId);
  const order = await getOrder(db, ownerId, sessionId);
  if (!order) notFound();
  const { deliveryAddress: address, totalCents } = order;

  return (
    <div className="mx-auto max-w-xl">
      <BagReload />
      <div className="text-center">
        <h1 className="text-2xl font-thin">Thank you</h1>
        <p className="mt-3 text-sm">
          Your Order <span className="font-bold">{order.number}</span> is confirmed.
        </p>
      </div>

      <h2 className={`mt-16 ${sectionTitle}`}>Order items</h2>
      <ul className="mt-4 border-t border-line">
        {order.items.map((item) => (
          <li key={item.productSlug} className="flex gap-5 border-b border-line py-4 text-xs">
            <div className="relative size-24 shrink-0 bg-tile">
              {item.packshot && <Image src={item.packshot.src} alt="" fill sizes="6rem" className="object-contain" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex justify-between gap-4">
                <Link href={productHref(item.productSlug)} className="link-reveal truncate">
                  {item.productName}
                </Link>
                <span className="shrink-0">{formatPrice(item.unitPriceCents)}</span>
              </div>
              <p className="mt-1 text-muted">Quantity {item.quantity}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-baseline justify-between text-sm">
        <span>Total</span>
        <span>{formatPrice(totalCents)}</span>
      </div>
      <p className="mt-1 text-xs text-muted">VAT included · Free delivery</p>

      <div className="mt-16 grid gap-10 text-xs sm:grid-cols-2">
        <section>
          <h2 className={sectionTitle}>Email</h2>
          <p className="mt-4 break-words">{order.email}</p>
        </section>
        <section>
          <h2 className={sectionTitle}>Delivery address</h2>
          <address className="mt-4 not-italic">
            {address.name}
            <br />
            {address.line1}
            {address.line2 && (
              <>
                <br />
                {address.line2}
              </>
            )}
            <br />
            {address.postalCode} {address.city}
            <br />
            {countryNames.of(address.country) ?? address.country}
          </address>
        </section>
      </div>

      <p className="mt-16 text-center">
        <Link href="/" className="link-wipe text-xs">
          Continue shopping
        </Link>
      </p>
    </div>
  );
}
