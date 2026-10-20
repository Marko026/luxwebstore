# A Guest's Bag belongs to an anonymous Better Auth user

A Guest can fill a Bag without signing in. Instead of our own `bagId` cookie or a browser-only Bag in localStorage, the first "Add to bag" signs the Guest in with Better Auth's anonymous plugin, so every Bag belongs to a user row. When the Guest signs in or signs up, the plugin's `onLinkAccount` hook merges their Bag into the account's Bag: Bag items for the same product keep the larger quantity, capped at Stock, and are not added together.

## Considered Options

- **Own `bagId` cookie**: rejected. We would write and secure the cookie and the sign-in merge ourselves, and keep two kinds of Bag owner.
- **localStorage for Guests, database for Users**: rejected. That means two code paths, and the server could not see a Guest's Bag to check it against Stock.

## Consequences

- Every Guest who adds something gets a `user` and a `session` row (`isAnonymous = true`). An anonymous user whose Bag has not changed for 30 days is deleted. A signed-in User's Bag does not expire.
- The plugin adds a column to the auth schema, so `src/db/auth-schema.ts` must be regenerated and migrated.
- Code that means "a real account" must check `isAnonymous` and not just test that a session exists.
