import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { anonymous } from "better-auth/plugins";
import { db } from "@/db";
import { mergeBags } from "@/lib/bag";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  plugins: [
    // A Guest's Bag belongs to an anonymous user, created on their first "Add to bag" (ADR 0001)
    anonymous({
      // A Guest who signs in or signs up keeps their Bag. The plugin then deletes the anonymous user,
      // and its emptied Bag goes with it.
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        await mergeBags(db, anonymousUser.user.id, newUser.user.id);
      },
    }),
    // Lets a server function set the session cookie (the anonymous sign-in); must stay last
    nextCookies(),
  ],
});
