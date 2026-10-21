import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/home/site-footer";
import { SiteHeader } from "@/components/home/site-header";

export const metadata: Metadata = {
  title: "Thank you — Luxwebstore",
};

/** Where Stripe sends the Guest or User after paying. A placeholder until a paid Checkout becomes an Order (#25). */
export default function CheckoutConfirmationPage() {
  return (
    <>
      <SiteHeader overlay={false} />
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-gutter pt-32 pb-24 text-center">
        <h1 className="text-2xl font-thin">Thank you</h1>
        <p className="max-w-[48ch] text-sm text-muted">We are confirming your payment.</p>
        <Link href="/" className="link-wipe text-xs">
          Back to the shop
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
