# Changelog

- 2026-05-14: Initial scaffold.
- 2026-05-14: Database layer scaffold — Drizzle ORM + Neon HTTP driver, empty schema placeholder, drizzle-kit config & scripts (generate/migrate/push/studio), t3-env validation, `.env.local.example`.
- 2026-05-14: Better Auth wired with Drizzle adapter (email/password enabled). Generated `auth-schema.ts` with user/session/account/verification tables + relations. Auth route handler at `/api/auth/[...all]`. Initial migration `0000_amazing_terrax.sql`. DB client now lazy-initialized to keep `next build` working when `SKIP_ENV_VALIDATION=true`.
- 2026-05-14: shadcn/ui initialized (Neutral, CSS variables). Components installed: button, input, label, card. `cn` helper at `src/lib/utils.ts`.
