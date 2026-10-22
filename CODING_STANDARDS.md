# Coding standards

Judgement calls for review (`/code-review` reads this file). Anything a linter or the type checker can enforce belongs in their config instead.

## Async results in client state

A client component that writes the result of a server function or fetch into state must handle a result that is late or failed:

- **Stale:** the result is applied only if what it was for still holds: the effect has not been cleaned up, the signed-in user is the same, and no newer local write landed while it was in flight. Example: `src/components/bag/bag-provider.tsx` (a version counter bumped by each load, each write and the effect's cleanup, so only the latest load lands; a current-user ref for writes).
- **Rejected:** every promise chain has a rejection path that leaves the UI usable, either a message to the Guest or User or the previous state kept and the error logged. A rejection must never reach an error boundary or go unhandled.

Flag any `.then(...)` or awaited call that sets state and misses one of these two.

## Writes without a session

A server function or route handler is reachable by a direct POST from anyone. When it writes rows for a caller with no session (for example creating an anonymous user), repeated requests must be bounded by a limit per client (or an idempotency key), with the choice recorded in an ADR. Checking that the request can succeed before anything is created is a useful extra guard, but it does not bound repeated valid requests. Flag any such write that a script could repeat without limit.

## Writes that must land together

When a function makes two or more database writes and a failure between them would leave a state that no code later repairs (for example Checkouts moved to the account while the Orders stay with a Guest about to be deleted), the writes run in one `db.transaction` (ADR 0003), or are folded into one statement. Keep network calls such as Stripe's out of the transaction, so no lock is held while waiting on them. Example: `moveCheckoutsAndOrders` in `src/lib/checkout.ts`. Flag consecutive awaited writes outside a transaction where a crash after the first leaves rows orphaned, half moved or counted twice.

## Tests that expect nothing

A test that expects nothing back (undefined, an empty list, a refusal) builds its input from a record the same caller would otherwise get, so only the rule under test can make it come back empty. A fixed id, number or slug usually belongs to another test's owner or to nobody, and the test then passes on ownership or absence whatever the rule does. Example: the `getOrderByNumber` spellings in `src/lib/checkout.test.ts`, each made from the owner's own Order number. Flag a negative case whose input is a literal that no record of the test's own caller matches, unless absence itself is what it tests (an unknown number).

## Scripts that write auth rows

A seed or dev script that creates or changes users, accounts or sessions touches only identities it owns: an address on the reserved `example.test` domain, never one taken from input as is. It must never reset the password or sessions of an account it did not create. Example: `seedTestUser` in `src/db/seed.ts`. The same goes for credentials in committed files: `.env.example` holds empty values or `@example.test` placeholders, never a usable password.
