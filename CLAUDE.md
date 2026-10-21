@AGENTS.md

# luxwebstore

Next.js 16 (App Router) + React 19 + Tailwind 4, Drizzle ORM on Neon Postgres, Better Auth.

## Commands
- Package manager: npm. Do not mix in pnpm/yarn (no second lockfile).
- `npm run dev` / `build` / `lint` / `typecheck`
- `npm run db:generate` then `db:migrate` — schema changes (preferred, keeps migration history)
- `npm run db:push` — dev only; can drop data, never against a production DB
- `npm run db:studio`
- `npm run db:seed` — upserts the sample catalog (idempotent)
- `npm test` — Vitest against PGlite (in-process Postgres) with the Drizzle migrations applied, a fresh database per test file; no network or secrets. Tests go through the Bag module (`src/lib/bag.ts`).
- Lockfile changes: use `npx npm@10 install ...` on Windows. npm 11 drops the top-level `@emnapi/*` entries and `npm ci` on Linux (CI) then fails.

## Layout
- `src/db/schema.ts` — Drizzle tables: `categories`, `products` (stock is a column); re-exports `auth-schema.ts`
- `src/db/auth-schema.ts` — Better Auth tables, generated: `npx auth generate --config src/lib/auth.ts --output src/db/auth-schema.ts` (never into `schema.ts`, it would overwrite it)
- `src/db/queries/products.ts` — cached catalog reads used by pages; `src/lib/products.ts` — `Product` type + display helpers
- `npm run build` queries the DB (prerender), so it needs `DATABASE_URL` and migrated tables
- `src/lib/auth.ts` (server) / `auth-client.ts` (client) — Better Auth
- `src/lib/checkout.ts` — the Checkout module (spec #21, ADR 0004); takes `db` and a `Payments` port (`src/lib/payments.ts`): `stripe-payments.ts` in the app, `src/test/fake-payments.ts` in tests
- `src/app/api/auth/[...all]` — auth route handler
- `docs/design-reference.md` — visual rules and deliberate departures (header, grid, buttons, drawer); read before UI or layout work

## Architecture notes
- `src/db/index.ts` uses the `neon-serverless` Drizzle driver (a WebSocket `Pool`), so `db.transaction` runs interactive transactions (ADR 0003). Writes that fit in one statement (`mergeBags`, `consumeRateLimit`) stay one statement. `src/db/seed.ts` is a one-off script and keeps its own `neon-http` client (it uses `db.batch`).
- `src/lib/auth.ts` wires Better Auth to Drizzle via `drizzleAdapter(db, { provider: "pg" })`; auth tables must exist in `src/db/schema.ts` (generate with `npx auth generate`) or auth fails at runtime.
- Path alias: `@/*` → `src/*`.

## Environment
- Required in `.env`: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`.
- Checkout needs `STRIPE_SECRET_KEY`, a test-mode key (`sk_test_`); the app refuses any other. Never use live keys.
- Stripe's webhook (`src/app/api/stripe/webhook`) needs `STRIPE_WEBHOOK_SECRET`. Locally it is optional: the confirmation page makes the Order, so the app works without the Stripe CLI and without the secret. To test the webhook, run `stripe listen --forward-to localhost:3000/api/stripe/webhook` and put the `whsec_` secret it prints in `.env`.

## Rules
- Next 16 has breaking changes: read `node_modules/next/dist/docs/` before writing Next code.
- Secrets live in `.env` (see `.env.example`). Never commit or print them.
- Ask before running any migration or `db:push`.
- Before calling work done, run `npm test`, `npm run lint`, `npm run typecheck` and `npm run build`. CI runs lint, typecheck and tests on every PR.
- Before checking UI in the browser pane, read `docs/agents/browser-checks.md`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `Marko026/luxwebstore`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root (created lazily). See `docs/agents/domain.md`.
