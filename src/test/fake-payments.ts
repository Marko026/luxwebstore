// A Payments fake for tests: records every session and lets a test mark one paid or make the next create fail.
import type { NewSession, Payments } from "@/lib/payments";

type FakeSession = NewSession & { id: string; url: string; state: "open" | "paid" | "expired" };

export function fakePayments() {
  const sessions: FakeSession[] = [];
  let failNextCreate = false;

  const find = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error(`No such session: ${sessionId}`);
    return session;
  };

  const payments: Payments = {
    async createSession(newSession) {
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
      return { paid: session.state === "paid", email: session.email, deliveryAddress: null };
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
    /** The Guest or User paid on the provider's page. */
    markPaid(sessionId: string) {
      find(sessionId).state = "paid";
    },
    failNextCreate() {
      failNextCreate = true;
    },
  };
}
