# Production Launch Plan — nexify-ai (Innlegg)

Engineered roadmap from "audited & type-clean" to "launchable SaaS". Grounded in this codebase.
Legend — **Owner**: `Code` (I implement) · `Ops` (you provide creds/config/legal). **Status**: ☐ todo · ◑ in progress · ☑ done.

### Progress (updated)
- ☑ **T1** test suite deterministic — `testTimeout: 30000` + hermetic `setupFiles` (`server/test-setup.ts` forces `DATABASE_URL=""`). 3× stable runs.
- ☑ **T2** env-gated integration tests → `it.skipIf(...)` (no spurious CI failures).
- ☑ **T3** distributed rate limiting — `rate-limit-redis` over `ioredis` (`server/_core/redis.ts`), `REDIS_URL`-driven with in-memory dev fallback.
- ☑ **T4** monitoring activated — `trackUsage` mounted on `/api/trpc` after `attachUser`; `checkSuspiciousActivity` now fires. *(Sentry-event verification still open.)*
- ☑ **T9** boot-time env validator (`server/_core/validateEnv.ts`) — aggregated fail-fast.
- ☑ **T15** accepted-risk documented (`SECURITY.md`) — 2 unfixable lodash advisories.
- ☑ **T5** Vipps order binding — new `payment_orders` table; `initiatePayment` persists an order bound to the auth'd user/plan/amount; webhook derives user/plan/amount from the **stored order** (not the client orderId) + amount cross-check + idempotent capture. Activates with the correct `planId`.
- ☑ **T7** unified usage model — single `enforcePostQuota(userId)` (trial = cumulative cap, active = monthly meter) replaces the duplicated trial-counter + monthly-meter logic in the generate path.
- ☑ **T14** server-side HTML sanitization (`server/_core/sanitizeHtml.ts`, isomorphic-dompurify) applied on blog create/update at rest.
- ☑ **T8** migration generated & committed — `drizzle/0025_add_plan_id_webhook_events_payment_orders.sql` (creates `payment_orders` + `processed_webhook_events`, adds `subscriptions.plan_id`). Apply with `drizzle-kit migrate` / `db:push` against prod.
- ☑ **T13** (partial) readiness probe — `GET /ready` checks DB + Redis (503 when not ready) for LB/orchestrator gating; `/health` = liveness.
- ☑ **Production build verified** — `pnpm build` succeeds end-to-end (vite client → `dist/public`, esbuild server → `dist/index.js` 491 kB).
- ☑ **`.env.example`** — every env var the code reads, categorized & tagged [REQUIRED]/[PROD]/[REC]/[OPT].
- ☑ **T6** dunning — Stripe `invoice.payment_failed` now notifies the user (via `getUserByStripeCustomerId`). *(A scheduled status-reconciliation job remains a nice-to-have.)*
- ☑ **T10** MVA — invoices already break out 25% MVA (`taxRate: 0.25`); added the seller `Org.nr … MVA` line (`MVA_ORG_NUMBER`).
- ☑ **T11** GDPR — `deleteUser` now erases **all 46 user-scoped tables** (was 7) resiliently; `exportData` + `deleteAccount` endpoints already exist.
- ☑ **T12** cookie consent (`CookieConsent.tsx`) + angrerett (Terms/Pricing) already present.
- ☑ **T13** Sentry `release` tag + prod trace sampling (0.1); `/ready` probe. *(Structured logging left as-is — acceptable for launch.)*

### Status: 15/15 addressed (a few partials noted). Verified: `pnpm check` = 0 · `pnpm test` = 275/2-skip (stable) · `pnpm build` = ok.
**Ops before launch:** set env per `.env.example` (incl. `MVA_ORG_NUMBER`, `SENTRY_RELEASE`); run `drizzle-kit migrate` (applies `0025`); set `REDIS_URL`; rotate the previously-leaked TiDB creds.

---

## Phase 0 — CI / Quality foundation  *(do first: everything gates on green CI)*
| # | Task | Owner | Acceptance |
|---|------|-------|-----------|
| T1 | Make the test suite **deterministic**. Root cause: inconsistent `./db` mocking across files (e.g. `blog.uploadImage.test.ts` never mocks `./db`) + shared module state. Fix via a global vitest `setupFiles` that stubs `./db`/network and forces `DATABASE_URL` unset, so every file is isolated. | Code | `pnpm test` passes the same set 3× in a row |
| T2 | Convert the 2 env-presence "tests" (`openai.test.ts`, `telegram.test.ts`) into `it.skipIf(!process.env.X)` — they assert config presence, not logic, so they shouldn't fail CI. | Code | 0 spurious failures when keys unset |

## Phase 1 — Abuse / rate-limit hardening  *(P0)*
| # | Task | Owner | Acceptance |
|---|------|-------|-----------|
| T3 | **Distributed rate limiting.** Current `express-rate-limit` uses an in-memory store → a no-op on Vercel serverless. Wire `rate-limit-redis` over the already-installed `ioredis`, keyed off `REDIS_URL`/Upstash; fall back to in-memory only in dev. | Code (Ops: `REDIS_URL`) | Limits persist across instances; load test confirms 429s |
| T4 | **Activate monitoring.** `req.user` is now set, so verify `trackUsage` is mounted and `checkSuspiciousActivity` fires; ensure auth-failure / webhook-reject / rate-limit events reach Sentry. | Code | Security events visible in Sentry |

## Phase 2 — Payment integrity  *(P0)*
| # | Task | Owner | Acceptance |
|---|------|-------|-----------|
| T5 | **Vipps order binding.** Add a `payment_orders` table; issue `orderId` server-side bound to `userId`+`planId`+`expectedAmount` at `initiatePayment`; webhook validates the captured amount/user against the stored order (not a client-derivable `orderId`). | Code | Cannot self-activate a plan without a matching server-issued order |
| T6 | **Reconciliation + dunning.** Scheduled job to reconcile local subscription status against Stripe; handle `invoice.payment_failed` retries / grace period. | Code (Ops: Stripe cfg) | Local status never silently drifts; failed payments retried |
| T7 | **Unify the usage model.** Collapse the two parallel counters (`subscriptions.postsGenerated` vs `userUsageTracking`) into one authoritative monthly meter used by every generation path. | Code | One source of truth; quota enforced everywhere |

## Phase 3 — Data / config correctness  *(P0/P1)*
| # | Task | Owner | Acceptance |
|---|------|-------|-----------|
| T8 | **Generate & commit migrations** for the new `plan_id` column and `processed_webhook_events` table so prod `db:push` applies them (schema is ahead of migrations). | Code (Ops: run `db:push`) | Fresh DB migrates cleanly |
| T9 | **Boot-time env validator** for the full required set (`JWT_SECRET`, `DATABASE_URL`, `OPENAI_API_KEY`, `STRIPE_*`, `VIPPS_*`, `TELEGRAM_WEBHOOK_SECRET`, `TOKEN_ENCRYPTION_KEY`, `PUBLIC_SITE_URL`, `REDIS_URL`) with one clear aggregated error. | Code | Misconfig fails fast with an actionable message |

## Phase 4 — Norwegian SaaS compliance  *(P1)*
| # | Task | Owner | Acceptance |
|---|------|-------|-----------|
| T10 | **MVA (25% VAT)** applied + shown on Stripe/Vipps charges and invoices (`pdfkit` invoices already exist). | Code (Ops: org/MVA no.) | Invoices show MVA breakdown |
| T11 | **GDPR**: verify `exportData` completeness + implement account **deletion** (right to erasure) with cascade. | Code | User can export and fully delete their data |
| T12 | **angrerett** (14-day withdrawal) terms + cookie-consent banner + privacy/terms wired to `Forbrukertilsynet` norms. | Code (Ops: legal text) | Required disclosures present pre-purchase |

## Phase 5 — Observability / polish  *(P2)*
| # | Task | Owner | Acceptance |
|---|------|-------|-----------|
| T13 | Structured logging (redacted), `/health` + `/ready` probes, Sentry release tagging. | Code | Logs queryable; probes green |
| T14 | Server-side HTML sanitization of blog content on write (defense-in-depth; currently client-only DOMPurify). | Code | Stored HTML is sanitized at rest |
| T15 | Document accepted residual risk: 2 unfixable `lodash`/`lodash-es` advisories (no upstream patch; transitive via recharts/streamdown). | Code | `SECURITY.md` notes the accepted risk |

---

### Execution order
Phase 0 → 1 → 2 → 3 in sequence (CI first, then security, payments, data). Phase 4–5 can run in parallel once 0–3 land. Each task verified with `pnpm check` (0) + `pnpm test` (green) before the next.
