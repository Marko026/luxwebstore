// A Payments fake for tests: records every session and lets a test mark one paid, make the next create fail, or run
// something while the next session is being created.
import type { DeliveryAddress, NewSession, Payments } from "@/lib/payments";

type FakeSession = NewSession & {
  id: string;
  url: string;
  state: "open" | "paid" | "expired";
  /** What the Guest or User gave on the provider's page, once paid. */
  paidWith?: { email: string; deliveryAddress: DeliveryAddress };
};

export const anAddress: DeliveryAddress = {
  name: "Ana Petrović",
  line1: "Knez Mihailova 1",
  line2: null,
  city: "Ljubljana",
  postalCode: "1000",
  country: "SI",
};

export function fakePayments() {
  const sessions: FakeSession[] = [];
  let failNextCreate = false;
  let duringNextCreate: (() => Promise<unknown>) | undefined;

  const find = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error(`No such session: ${sessionId}`);
    return session;
  };

  const payments: Payments = {
    async createSession(newSession) {
      const during = duringNextCreate;
      duringNextCreate = undefined;
      await during?.();
      if (failNextCreate) {
        failNextCreate = false;
        throw new Error("Payment provider unavailable");
      }
      const id = `cs_test_${sessions.length + 1}`;
      const session = { ...newSession, id, url: `https://pay.example.test/${id}`, state: "open" as const };
      sessions.push(session);
      return { id, url: session.url };
    },
    async readSession(sessionId) {
      const session = find(sessionId);
      return {
        paid: session.state === "paid",
        email: session.paidWith?.email ?? session.email,
        deliveryAddress: session.paidWith?.deliveryAddress ?? null,
      };
    },
    async expireSession(sessionId) {
      const session = find(sessionId);
      if (session.state === "paid") return "already-paid";
      session.state = "expired";
      return "expired";
    },
  };

  return {
    payments,
    sessions,
    /** The Guest or User paid on the provider's page, giving an email (a User's is prefilled) and a delivery address. */
    markPaid(sessionId: string, { email, deliveryAddress = anAddress }: { email?: string; deliveryAddress?: DeliveryAddress } = {}) {
      const session = find(sessionId);
      session.state = "paid";
      session.paidWith = { email: email ?? session.email ?? "guest@example.test", deliveryAddress };
    },
    /** The session ran out on the provider's side, as Stripe's expiry event reports. */
    markExpired(sessionId: string) {
      find(sessionId).state = "expired";
    },
    failNextCreate() {
      failNextCreate = true;
    },
    /** Runs `action` (another start, say) while the next session is being created, before it exists. */
    duringNextCreate(action: () => Promise<unknown>) {
      duringNextCreate = action;
    },
  };
}
