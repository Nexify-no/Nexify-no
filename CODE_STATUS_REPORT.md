# Code Status Report — nexify-ai (Innlegg)
**Date:** 2026-06-20 · **Scope:** full day's work, single session

---

## Session 3 — 2026-06-23 (production-readiness & hardening pass)

Senior-engineer deep-dive on branch `fix/drizzle-migration-history`. Every change
is committed separately by category and verified: `pnpm check` clean, **287 tests
pass** (2 skipped), `pnpm build` OK, and a **live boot smoke** (`node dist/index.js`
→ `/health` 200, graceful shutdown confirmed). See `docs/PRODUCTION_READINESS_BACKLOG.md`
for the items intentionally deferred.

### Migration strategy (was the #1 risk)
- **No more schema changes at app boot.** The Dockerfile no longer runs
  `drizzle-kit push --force` on start — runtime CMD is `node dist/index.js` only,
  so a restart can't alter the DB. Migrations run as a **separate one-shot
  `migrate` service** (`drizzle-kit migrate`); the app waits for it via
  `service_completed_successfully`. New scripts: `db:generate`, `db:migrate`,
  `db:push` (dev-only). History is consistent (no duplicate `CREATE TABLE`).

### Docker / deploy
- **Multi-stage image:** builder → migrator → slim **non-root** runtime (prod deps
  only, no drizzle-kit), with a real `HEALTHCHECK` hitting `/health`.

### Security & runtime hardening
- **Graceful shutdown:** SIGTERM/SIGINT drains in-flight requests (`server.close`),
  stops the scheduler, quits Redis, then exits (10 s force-guard); fatal boot → `exit(1)`.
- **tRPC error redaction** in production (no stack/internal message leaks).
- **Secure cookies forced** in prod; **dev-login hard-refused** on a real HTTPS prod deploy.

### Observability
- **Sentry actually wired** (was configured but `initSentry()` was never called):
  early init via `instrument.ts`, `setupExpressErrorHandler`, Stripe-webhook capture,
  and `unhandledRejection`/`uncaughtException` handlers.

### Multi-tenant safety
- **Atomic quota** increment (race-safe conditional update) — was read-then-update.
- **Scheduler no longer double-publishes:** atomic per-row claim
  (`scheduled→publishing`) + in-process overlap guard + a reaper for rows stuck in
  `publishing` after a crash.
- **IDOR fixed:** `schedulePost` verifies post ownership (+ regression test).

### CI & performance
- **CI pipeline added** (`.github/workflows/ci.yml`): typecheck / test / build /
  **boot-smoke** — fails the PR on any broken gate.
- **Cold start cut:** LangChain and Stripe SDKs are now **lazy-loaded** off the boot
  path (they were imported eagerly via `appRouter`).
- Admin revenue derived from `shared/pricing.ts`; dead code removed.

### Follow-up hardening (same branch, 2026-06-23)
- **Scheduler deployment safety:** the in-process cron is now gated behind
  `RUN_SCHEDULER` — run it on exactly one instance (`false` on web instances when
  scaling) so it doesn't multiply or silently fail on serverless.
- **AI cost backstop:** new `aiProcedure` (per-user rate limit,
  `AI_RATE_PER_MINUTE`/`AI_RATE_PER_DAY`, Redis-or-memory) on every previously
  unmetered paid LLM/image endpoint — caps runaway OpenAI cost/abuse. (Per-plan AI
  quota remains a product decision — see backlog §1.)
- **OAuth login CSRF fixed:** the Google login flow now uses `state` + PKCE
  (short-lived httpOnly cookies; constant-time verify on callback). Needs a live
  end-to-end login test before merge.

### Also (from the prior expanded-options work on this branch)
- Expanded generation options + named **presets** (`generation_presets`, migration
  `0027`), a structured **prompt-builder** layer + LLM "enhance idea", Norwegian
  output hardening, and env-driven model/provider config (`CONTENT_MODEL`,
  `LLM_MODEL`, `IMAGE_PROVIDER`/`IMAGE_MODEL`/`FAL_API_KEY`).

---

## Session 2 — 2026-06-22 (runtime bug-fix pass)

The first report verified the bundle *boots*. This pass **ran the real app end-to-end**
(local MySQL + dev server, logged-in user) and fixed a series of bugs that only surface
at runtime — most found by clicking through features and reading server/console logs.

### Fixed (all verified live, `pnpm check` green, 278/280 tests)
- **White screen of death (prod-grade):** the global IP rate-limiter (100/min) counted
  *every* request — JS chunks, fonts, Vite dev modules — so a normal user reloading a
  couple of times got `429` on the app's own bootstrap and the SPA never mounted. Scoped
  the limiter to `/api` only. Also guarded the GA4/Umami scripts in `index.html` (the
  unsubstituted `%VITE_ANALYTICS_ENDPOINT%/umami` placeholder fired a malformed
  same-origin request every load).
- **Every `invokeLLM` AI feature was 400-ing:** `_core/llm.ts` hardcoded
  `payload.thinking = {…}` (not an OpenAI param — a Manus leftover) → OpenAI rejected
  every request ("Unrecognized request argument"). This broke AI Coach, Gjenbruk/repurpose,
  content series, A/B generation, engagement replies, hashtag suggestions. Removed it +
  capped `max_tokens` to a valid value.
- **Relational queries dead:** `getDb()` built Drizzle *without* a schema, so `db.query.*`
  was `undefined` ("Cannot read properties of undefined"). Broke the whole Settings feature
  + RSS/sitemap generators. Now passes `{ schema, mode: "default" }`.
- **Generated content was never saved:** `content.generate`/`repurpose`/`series.generatePost`
  counted quota but wrote no `posts` row, so "Mine innlegg" stayed empty. They now persist a
  draft (+return `postId`); `linkedin.createPost` records the publication.
- **Scheduling was architecturally dead:** the scheduler read `posts.status='scheduled'`
  (never set) while the API wrote to `scheduled_posts`. Scheduler now reads `scheduled_posts`;
  `content.reschedule` writes there too.
- **Quota/Vipps:** `subscription_plans` was never seeded (→ unlimited quota + Vipps amount
  mismatch). Added `ensureSubscriptionPlans()` (boot, from `@shared/pricing`); Stripe activation
  now sets `planId` so the monthly cap is enforced.
- **Pricing unified:** 3 tiers (Gratis 2 / Pro 15·199 / Premium 30·399), 10% annual, mirrored
  across landing, `/pricing`, backend and quotas via the new `shared/pricing.ts` single source.
- **Trends:** Google Trends fetch (CJS/ESM interop) + AI analysis JSON parse fixed earlier;
  this pass fixed the **idea panel crashing** the Generate page ("Objects are not valid as a
  React child" — rendered `{topic,contentIdeas}` objects), and the **search/platform filter**
  (per-word match so "VM norge" finds "vm i fotball"; trends now tagged for all 4 platforms so
  the Facebook/Instagram filter doesn't drop everything).
- **Data correctness:** admin activity log reads the real `activity_log` (was a mock);
  `post_analytics` is now written on publish (was permanently zero); Vipps cancel/refund
  persists state; dead Stripe webhook stub deleted; dashboard shows the real plan name +
  monthly quota (was hardcoded "Pro" / trial limit).
- **Migration history repaired** (missing `CREATE TABLE`, duplicate migration, 3 tables never
  created); **Manus de-branded** from docs.

### Still open (need external services / a migration)
Stripe billing-history + invoice PDF (live Stripe), test-report email (SendGrid), generated-image
persistence (`imageUrl` column migration), Facebook local persistence, analytics *engagement*
numbers (needs a LinkedIn metrics-refresh job). The "Trending Topics" sidebar still shows a
generic label for some items (cosmetic).

---

## 1. Executive summary
The project moved from *"non-compiling, insecure, never run"* to *"type-clean, security-hardened, and verified to boot as a real production bundle."* Started with 33 hidden type errors and an undeployable state; ended with a green pipeline and a production artifact that boots and serves. Two **launch-blocking crashes** were caught only by running the actual bundle (not by tsc/tests) and fixed.

**Verdict:** Engineering-ready for production. Remaining items are operational (env/creds/migrations) or product/legal, not code blockers.

## 2. Verification status (all green)
| Gate | Command | Result |
|------|---------|--------|
| Types | `pnpm check` (`tsc --noEmit`) | **0 errors** (now includes test files) |
| Tests | `pnpm test` (vitest) | **275 passed / 2 skipped** — deterministic across runs |
| Build | `pnpm build` (vite + esbuild) | **OK** — `dist/public` + `dist/index.js` (~495 kB) |
| Boot | `node dist/index.js` (prod env) | **Boots & serves** — `/health` 200, `/ready` reports dependency health, `enforceHttps` redirects to canonical host |
| Supply chain | `pnpm audit` | **0 critical** · 2 high (unfixable upstream) · 22 moderate · 5 low |

## 3. What was done today (by workstream)

### A. Decoupling & correctness
- **Manus platform fully disconnected** — removed telemetry/debug collector, redirected LLM/image gen from `forge.manus.im` to OpenAI/DALL·E, removed Manus OAuth (Google-only), de-branded `manus.space` → `PUBLIC_SITE_URL`, **deleted a leaked live TiDB credential** committed under `.manus/`.
- **33 TypeScript errors fixed** — chiefly a `await getDb().select()` (querying an unresolved Promise) bug across `subscriptionRouter`, plus webhook/router/page mismatches. Surfaced a missing `subscriptions.plan_id` column (added).

### B. Security (OWASP Top 10 audit → fixed)
4 critical + 9 high + mediums, all remediated:
- **Secrets/auth:** boot-time fail-fast on weak `JWT_SECRET`; deleted dead `your-secret-key` fallback; AES-256-GCM **encryption of OAuth tokens at rest** across 3 token tables; HMAC-signed OAuth `state`.
- **Payments:** Vipps webhook now fail-closed (raw-body HMAC + constant-time compare); **server-side order binding** (`payment_orders`) so webhooks trust a persisted order, not a client-derivable id; Stripe `checkout.session.completed` + idempotency table; amount validated against real plan price.
- **Abuse:** keystone `attachUser` Express middleware (the rate-limit/abuse layer was dead because `req.user` was never set); **distributed rate limiting** via `rate-limit-redis`/`ioredis`; mounted `trackUsage`.
- **Misc:** error handler relocated (was leaking stack traces); CSP cleaned (no `unsafe-eval`, deduped); Telegram webhook secret-token auth; IDOR owner-scoping; server-side HTML sanitization of blog content; admin-gated global LinkedIn creds; cookie `sameSite=lax`.

### C. Supply chain
- Replaced unmaintained `xlsx` → `@e965/xlsx`; bumped `drizzle-orm` 0.45.2 (SQLi), `vite` 8.0.16; added overrides for undici/ws/tar/etc. From **1 critical + 20 high → 0 critical + 2 high** (the 2 are `lodash`/`lodash-es`, patched version `>=4.18.0` does not exist upstream; transitive via recharts/streamdown — accepted, see `SECURITY.md`).

### D. Test suite health
- Removed the `**/*.test.ts` tsc exclusion → **61 test-file type errors fixed** (stale mock fixtures, outdated tRPC inputs, `.not` via `@types/chai@4`, deleted-module test).
- Made the suite **deterministic** (`testTimeout: 30000` + hermetic setup; was flaky 2–4 failures); env-gated integration tests → `it.skipIf`.

### E. Production-launch plan (15/15 addressed)
Test determinism · Redis rate limiting · env validator · **GDPR erasure now covers 46 user tables (was 7)** · Vipps order binding · unified usage meter (`enforcePostQuota`) · offline-generated migration `0025` · MVA 25% + Org.nr on invoices · Stripe dunning (`invoice.payment_failed`) · `/ready` probe · Sentry release tagging · server-side HTML sanitize · accepted-risk doc.

### F. Production verification (caught 2 launch blockers)
Running the real bundle exposed crashes that green tsc/tests hid — both from security overrides using loose `>=` values that jumped majors and broke transitive deps:
- `undici` override → jumped jsdom's undici to 8.x (missing internal file) → pinned to `7.28.0`.
- `path-to-regexp` override → jumped Express 4's to 8.x (`pathRegexp is not a function`) → pinned to `0.1.13`.
Both stay patched. **Lesson: override values must be pinned, not `>=`.**

### G. Also delivered
- Aurora Background shadcn component integrated (Tailwind v4 CSS-first) at route `/aurora`.
- Docs: `CLAUDE.md`, `PRODUCTION_LAUNCH_PLAN.md`, `.env.example` (every env var, categorized), `SECURITY.md`, this report.

## 4. New/changed artifacts (highlights)
- **New code:** `_core/redis.ts`, `_core/validateEnv.ts`, `_core/tokenCrypto.ts`, `_core/oauthState.ts`, `_core/sanitizeHtml.ts`, `server/test-setup.ts`, `pages/AuroraDemo.tsx`, `components/ui/aurora-background.tsx`.
- **Schema:** `+plan_id`, `+payment_orders`, `+processed_webhook_events` → migration `drizzle/0025_*.sql` (apply with `drizzle-kit migrate`).
- **Docs:** `CLAUDE.md`, `.env.example`, `SECURITY.md`, `PRODUCTION_LAUNCH_PLAN.md`, `CODE_STATUS_REPORT.md`.

## 5. Known residual (non-blocking)
- 2 high `lodash` advisories — no upstream fix (documented).
- Cold-start: the heaviest SDKs (LangChain, Stripe) are now lazy-loaded off the boot path (Session 3); remaining boot cost is the eager router graph itself.
- Stripe status-reconciliation job (dunning notify done; periodic sync is a nice-to-have).
- Structured logging (current console + Sentry is acceptable).
- Compliance text (angrerett/privacy) present; **MVA org number + final legal copy are Ops/legal inputs.**

## 6. Operational checklist before launch (Ops, not code)
1. Set env per `.env.example` — esp. `JWT_SECRET` (≥32), `DATABASE_URL`, `OPENAI_API_KEY`, `STRIPE_*`, `TOKEN_ENCRYPTION_KEY`, `REDIS_URL`, `PUBLIC_SITE_URL`, `MVA_ORG_NUMBER`.
2. Run migrations as a **separate step** — `pnpm db:migrate` (or the compose `migrate` service), never at app boot. Applies up to `0027` (`plan_id`, `payment_orders`, `processed_webhook_events`, `generation_presets`). An existing push-built DB must be **baselined** once first (see `docs/PRODUCTION_READINESS_BACKLOG.md` §4).
3. **Rotate the previously-leaked TiDB credentials.**
4. Register OAuth apps (Google/LinkedIn/Vipps) + set webhook secrets (Stripe/Vipps/Telegram).
5. Point a TLS-terminating proxy at the app (it enforces HTTPS via `x-forwarded-proto`).
