# Coding standards

Judgement calls for review (`/code-review` reads this file). Anything a linter or the type checker can enforce belongs in their config instead.

## Async results in client state

A client component that writes the result of a server function or fetch into state must handle a result that is late or failed:

- **Stale:** the result is applied only if what it was for still holds: the effect has not been cleaned up, the signed-in user is the same, and no newer local write landed while it was in flight. Example: `src/components/bag/bag-provider.tsx` (a version counter bumped by each load, each write and the effect's cleanup, so only the latest load lands; a current-user ref for writes).
- **Rejected:** every promise chain has a rejection path that leaves the UI usable, either a message to the Guest or User or the previous state kept and the error logged. A rejection must never reach an error boundary or go unhandled.

Flag any `.then(...)` or awaited call that sets state and misses one of these two.

## Writes without a session

A server function or route handler is reachable by a direct POST from anyone. When it writes rows for a caller with no session (for example creating an anonymous user), repeated requests must be bounded by a limit per client (or an idempotency key), with the choice recorded in an ADR. Checking that the request can succeed before anything is created is a useful extra guard, but it does not bound repeated valid requests. Flag any such write that a script could repeat without limit.

## Scripts that write auth rows

A seed or dev script that creates or changes users, accounts or sessions touches only identities it owns: an address on the reserved `example.test` domain, never one taken from input as is. It must never reset the password or sessions of an account it did not create. Example: `seedTestUser` in `src/db/seed.ts`. The same goes for credentials in committed files: `.env.example` holds empty values or `@example.test` placeholders, never a usable password.
