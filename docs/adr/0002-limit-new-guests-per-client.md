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
- When no client IP can be trusted, for example a host that does not set `x-forwarded-for` or has proxies `auth` isn't told about, all such clients share one limit. Set `advanced.ipAddress` in `src/lib/auth.ts` for the chosen host.
- The window is fixed, starting at a key's first request, so up to twice the limit can pass around a window's end.
- `addToBag` still makes the Stock check that counts. A product that sells out between the check and the add still leaves a new Guest with an empty Bag.
