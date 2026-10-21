# A Guest's Bag belongs to an anonymous Better Auth user

A Guest can fill a Bag without signing in. Instead of our own `bagId` cookie or a browser-only Bag in localStorage, the first "Add to bag" signs the Guest in with Better Auth's anonymous plugin, so every Bag belongs to a user row. When the Guest signs in or signs up, the plugin's `onLinkAccount` hook merges their Bag into the account's Bag: Bag items for the same product keep the larger quantity, capped at Stock, and are not added together. A sold-out product is kept at quantity 1 rather than capped to 0, so it stays in the Bag marked "Sold out" instead of disappearing (a Bag item's quantity is at least 1).

## Considered Options

- **Own `bagId` cookie**: rejected. We would write and secure the cookie and the sign-in merge ourselves, and keep two kinds of Bag owner.
- **localStorage for Guests, database for Users**: rejected. That means two code paths, and the server could not see a Guest's Bag to check it against Stock.

## Consequences

- Every Guest who adds something gets a `user` and a `session` row (`isAnonymous = true`). An anonymous user whose Bag has not changed for 30 days is deleted. A change is adding, changing a quantity or removing a Bag item; removing also touches the user row, so a Guest who emptied their Bag yesterday is kept. A Guest with an empty Bag is judged by their user row alone. Once Checkout exists (spec #21), starting one counts as a change too, so a Guest with an open Checkout is never stale. A signed-in User's Bag does not expire.
- Once Checkout and Order exist (spec #21), the same `onLinkAccount` hook must also move the Guest's Checkouts (open, paid or closed) and Orders to the account, before the plugin deletes the anonymous user. A payment in progress then completes as the User's Order, and its units stay held. If the Guest and the account both have an open Checkout, the older one is closed, so an account still has at most one.
- The plugin adds a column to the auth schema, so `src/db/auth-schema.ts` must be regenerated and migrated.
- Code that means "a real account" must check `isAnonymous` and not just test that a session exists.
