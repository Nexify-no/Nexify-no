# Security

## Reporting
Report vulnerabilities privately to the maintainers before public disclosure.

## Required production secrets
The server validates these at boot (`server/_core/validateEnv.ts`) and fails fast if missing:
`JWT_SECRET` (≥32 chars), `DATABASE_URL`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `TOKEN_ENCRYPTION_KEY`, `PUBLIC_SITE_URL`. Strongly recommended:
`REDIS_URL` (distributed rate limiting), `VIPPS_SECRET_KEY`, `TELEGRAM_WEBHOOK_SECRET`.

## Accepted residual risk — `pnpm audit`
After the dependency hardening pass, `pnpm audit` reports **0 critical** and **2 high**:

- **`lodash` / `lodash-es`** — advisory lists the patched version as `>=4.18.0`, which **does not exist** (lodash is archived at 4.17.x; the advisory is effectively unactionable). Both are transitive, pulled in by **`recharts`** (dashboard charts) and **`streamdown`** (AI chat markdown rendering) — actively-used UI dependencies. There is no upstream fix short of removing those features.

**Decision:** accepted. The remaining moderate/low advisories are transitive dev/build-time (DOMPurify edge cases, babel, qs) with no production exposure. Re-run `pnpm audit` in CI and revisit if `recharts`/`streamdown` ship a patched transitive tree.
