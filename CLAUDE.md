@AGENTS.md

# luxwebstore

Next.js 16 (App Router) + React 19 + Tailwind 4, Drizzle ORM on Neon Postgres, Better Auth.

## Commands
- Package manager: npm. Do not mix in pnpm/yarn (no second lockfile).
- `npm run dev` / `build` / `lint`
- `npm run db:generate` then `db:migrate` — schema changes (preferred, keeps migration history)
- `npm run db:push` — dev only; can drop data, never against a production DB
- `npm run db:studio`
- No test script exists yet.

## Layout
- `src/db/schema.ts` — Drizzle tables (currently empty; auth tables come from `npx auth generate`)
- `src/lib/auth.ts` (server) / `auth-client.ts` (client) — Better Auth
- `src/app/api/auth/[...all]` — auth route handler

## Architecture notes
- `src/db/index.ts` uses the `neon-http` Drizzle driver: no connection pool, no interactive transactions. Switch to `neon-serverless` if transactions are needed.
- `src/lib/auth.ts` wires Better Auth to Drizzle via `drizzleAdapter(db, { provider: "pg" })`; auth tables must exist in `src/db/schema.ts` (generate with `npx auth generate`) or auth fails at runtime.
- Path alias: `@/*` → `src/*`.

## Rules
- Next 16 has breaking changes: read `node_modules/next/dist/docs/` before writing Next code.
- Secrets live in `.env` (see `.env.example`). Never commit or print them.
- Ask before running any migration or `db:push`.
- Before calling work done, run `npm run lint` and `npm run build`.
