import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { anonymous } from "better-auth/plugins";
import { db } from "@/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  plugins: [
    // A Guest's Bag belongs to an anonymous user, created on their first "Add to bag" (ADR 0001)
    anonymous(),
    // Lets a server function set the session cookie (the anonymous sign-in); must stay last
    nextCookies(),
  ],
});
