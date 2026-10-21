// The Payments port on Stripe's hosted Checkout (spec #21), test mode only. Server code only: it holds the secret key.
import Stripe from "stripe";
import type { DeliveryAddress, Payments } from "@/lib/payments";

/** The 27 EU countries: delivery is EU only. */
const euCountries = [
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU",
  "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
] as const satisfies Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[];

// Stripe refuses an `expires_at` less than 30 minutes after it creates the session. The Checkout's expiry was set a
// moment before, so the session may end up to this much later; closing a Checkout ends its session first, so no
// payment can arrive after the Checkout is closed.
const minimumLifetimeSeconds = 30 * 60 + 60;

let client: Stripe | undefined;

// Created on first use, not at import, so `next build` needs no key
function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key?.startsWith("sk_test_")) throw new Error("STRIPE_SECRET_KEY must be a Stripe test-mode key");
  client ??= new Stripe(key);
  return client;
}

const toSeconds = (date: Date) => Math.ceil(date.getTime() / 1000);

function deliveryAddressOf(session: Stripe.Checkout.Session): DeliveryAddress | null {
  const shipping = session.collected_information?.shipping_details;
  if (!shipping) return null;
  const { address } = shipping;
  return {
    name: shipping.name,
    line1: address.line1 ?? "",
    line2: address.line2 || null,
    city: address.city ?? "",
    postalCode: address.postal_code ?? "",
    country: address.country ?? "",
  };
}

const isPaid = (session: Stripe.Checkout.Session) => session.status === "complete" || session.payment_status === "paid";

export const stripePayments: Payments = {
  async createSession({ checkoutId, items, email, expiresAt, successUrl, cancelUrl }) {
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      // Card only, so a session is paid or not at once (no delayed methods such as SEPA debit)
      allowed_payment_method_types: ["card"],
      // Catalogue prices already include VAT; no Stripe Tax
      line_items: items.map((item) => ({
        quantity: item.quantity,
        price_data: { currency: "eur", unit_amount: item.unitPriceCents, product_data: { name: item.name } },
      })),
      shipping_address_collection: { allowed_countries: [...euCountries] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 0, currency: "eur" },
            display_name: "Free delivery",
          },
        },
      ],
      customer_email: email ?? undefined,
      expires_at: Math.max(toSeconds(expiresAt), toSeconds(new Date()) + minimumLifetimeSeconds),
      client_reference_id: String(checkoutId),
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    if (!session.url) throw new Error(`Stripe returned no URL for session ${session.id}`);
    return { id: session.id, url: session.url };
  },

  async readSession(sessionId) {
    const session = await stripe().checkout.sessions.retrieve(sessionId);
    return {
      paid: isPaid(session),
      email: session.customer_details?.email ?? null,
      deliveryAddress: deliveryAddressOf(session),
    };
  },

  async expireSession(sessionId) {
    try {
      await stripe().checkout.sessions.expire(sessionId);
      return "expired";
    } catch (error) {
      // Stripe expires only an open session. Otherwise it was paid, or it already expired on its own.
      // If Stripe cannot be reached at all, the expire error says why
      const session = await stripe()
        .checkout.sessions.retrieve(sessionId)
        .catch(() => {
          throw error;
        });
      if (isPaid(session)) return "already-paid";
      if (session.status === "expired") return "expired";
      throw error;
    }
  },
};
