# Coding standards

Judgement calls for review (`/code-review` reads this file). Anything a linter or the type checker can enforce belongs in their config instead.

## Async results in client state

A client component that writes the result of a server function or fetch into state must handle a result that is late or failed:

- **Stale:** the result is applied only if what it was for still holds: the effect has not been cleaned up, the signed-in user is the same, and no newer local write landed while it was in flight. Example: `src/components/bag/bag-provider.tsx` (a version counter bumped by each load, each write and the effect's cleanup, so only the latest load lands; a current-user ref for writes).
- **Rejected:** every promise chain has a rejection path that leaves the UI usable, either a message to the shopper or the previous state kept and the error logged. A rejection must never reach an error boundary or go unhandled.

Flag any `.then(...)` or awaited call that sets state and misses one of these two.
