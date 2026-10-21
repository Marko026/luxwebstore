# New Guests are limited per client IP, in a Postgres counter

ADR 0001 signs a Guest in anonymously on their first "Add to bag". That server function is reachable by a direct POST, so a script that drops its cookie could create a `user` and a `session` row per request, without limit, and nothing deletes them yet (`deleteStaleGuests` is not scheduled). So a Guest is now created only for a product in Stock, and at most 10 new Guests per client IP per hour. The count lives in a `rate_limits` table, counted in one statement. The client IP is read with Better Auth's `getIP`, so forwarded headers are trusted only as `auth` is configured.

## Considered Options

- **Better Auth's `rateLimit`**: rejected. It runs in Better Auth's HTTP router only, and our server function calls `auth.api.signInAnonymous` directly, past it. Its HTTP route `/sign-in/anonymous` is now disabled, so that route can't bypass our limit either.
- **An in-memory counter**: rejected. On serverless hosting every instance would count apart and forget on a cold start, and the deploy target is not decided yet.
- **Counting recent anonymous sessions by IP** (no new table): rejected. Count-then-create lets a burst of concurrent requests through, and `session.ip_address` has no index.
- **Only checking the product first**: not enough on its own. Any product in Stock still creates a Guest per request.

## Consequences

- The first "Add to bag" without a session costs one more write. Later adds don't touch the counter.
- Shoppers behind one shared IP (an office, carrier NAT) share the 10 per hour. A refused Guest sees "Too many requests. Please try again later."
- The limit is only as good as the client IP, so `advanced.ipAddress` in `src/lib/auth.ts` must match the chosen host:
  - A host that sets a single `x-forwarded-for` (Vercel, for one) works as is.
  - A host that passes the client's own `x-forwarded-for` through, such as `next start` with no proxy in front, lets a script send a new IP each time and so skip the limit.
  - A host that appends to the header, through proxies `auth` isn't told about, leaves no IP to trust. All such clients then share one limit, which a script can use up for everyone.
- The window is fixed, starting at a key's first request, so up to twice the limit can pass around a window's end.
- `addToBag` still makes the Stock check that counts. A product that sells out between the check and the add still leaves a new Guest with an empty Bag.
