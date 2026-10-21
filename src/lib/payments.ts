// The Payments port: what the Checkout module needs from a payment provider. The module takes it as a parameter, like
// `db`, and never imports Stripe; `src/lib/stripe-payments.ts` is the real one, tests pass a fake.

export type PaymentItem = {
  name: string;
  /** Euro cents, VAT included. */
  unitPriceCents: number;
  quantity: number;
};

export type NewSession = {
  checkoutId: number;
  items: PaymentItem[];
  /** Prefilled for a User; null for a Guest, whose user row has no real email. */
  email: string | null;
  /** When the session can no longer be paid. */
  expiresAt: Date;
  successUrl: string;
  cancelUrl: string;
};

export type DeliveryAddress = {
  name: string;
  line1: string;
  line2: string | null;
  city: string;
  postalCode: string;
  /** Two-letter country code. */
  country: string;
};

export type SessionDetails = {
  paid: boolean;
  email: string | null;
  deliveryAddress: DeliveryAddress | null;
};

export interface Payments {
  /** Creates a hosted payment page for a Checkout; `url` is where the Guest or User pays. */
  createSession(session: NewSession): Promise<{ id: string; url: string }>;
  readSession(sessionId: string): Promise<SessionDetails>;
  /** Makes the session unpayable: "expired" once it can no longer be paid (also if it already was), "already-paid" if it was paid first. */
  expireSession(sessionId: string): Promise<"expired" | "already-paid">;
}
