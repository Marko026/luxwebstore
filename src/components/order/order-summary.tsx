import Image from "next/image";
import Link from "next/link";
import type { Order } from "@/lib/checkout";
import { formatPrice, productHref } from "@/lib/products";

const sectionTitle = "text-sm font-bold uppercase tracking-normal";
const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
// One zone for every reader, so the date does not depend on where the server runs
const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });

/** The day an Order was made, such as "22 October 2026". */
export function formatOrderDate(date: Date) {
  return dateFormat.format(date);
}

/**
 * An Order as its Customer sees it: Order items, total, email and delivery address. The same on the confirmation page
 * and on the Order's own page under My orders.
 */
export function OrderSummary({ order }: { order: Order }) {
  const { deliveryAddress: address, totalCents } = order;
  return (
    <>
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
    </>
  );
}
