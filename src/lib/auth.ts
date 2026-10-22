import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { anonymous } from "better-auth/plugins";
import { db } from "@/db";
import { mergeBags } from "@/lib/bag";
import { moveCheckoutsAndOrders } from "@/lib/checkout";
import { stripePayments } from "@/lib/stripe-payments";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  // Guests are signed in only by "Add to bag", behind its limit (ADR 0002); the HTTP route would bypass it
  disabledPaths: ["/sign-in/anonymous"],
  plugins: [
    // A Guest's Bag belongs to an anonymous user, created on their first "Add to bag" (ADR 0001)
    anonymous({
      // A Guest who signs in or signs up keeps their Bag, their Checkouts and their Orders. The plugin then deletes
      // the anonymous user, and its emptied Bag goes with it.
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        await mergeBags(db, anonymousUser.user.id, newUser.user.id);
        await moveCheckoutsAndOrders(db, stripePayments, anonymousUser.user.id, newUser.user.id);
      },
    }),
    // Lets a server function set the session cookie (the anonymous sign-in); must stay last
    nextCookies(),
  ],
});
