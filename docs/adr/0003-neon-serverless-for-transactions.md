# The app talks to Postgres over neon-serverless, for transactions

_Accepted 2026-10-21. Built by ticket #23 (PR #29); until that merges, `src/db/index.ts` still uses `neon-http`._

Checkout takes several products' units out of Stock at once, and a paid Checkout becomes an Order, its Order items and a smaller Bag at once. Each must happen whole or not at all. `neon-http` has no interactive transactions, and the one-statement workaround used so far (`mergeBags`, `consumeRateLimit`) is not safe here: under `READ COMMITTED`, two concurrent Checkouts can both pass an "all in Stock" check and leave a reservation half done. So the whole app moves to the `neon-serverless` driver (a WebSocket `Pool`), which runs real transactions.

## Considered Options

- **Two clients, `neon-http` for reads and `neon-serverless` for Checkout and Order**: rejected. Two drivers and two connection setups for a small saving on read latency.
- **Keep `neon-http` with one-statement writes**: rejected. The reservation's all-or-nothing check races, as above.

## Consequences

- The first query of a request opens a WebSocket, so it is a little slower than an HTTP query.
- The existing one-statement writes keep working; they need not be rewritten as transactions.
- Tests are unaffected: PGlite supports transactions, and the Bag module already takes any `PgDatabase`.
