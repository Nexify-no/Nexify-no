# Production-Readiness Backlog (deferred)

> Created 2026-06-23. These items came out of the production-readiness audit on
> branch `fix/drizzle-migration-history`. They are **intentionally NOT done yet** —
> each needs a product decision, a test database, or careful per-package validation
> in real CI. This file is the to-do list to pick them up later. Nothing here is a
> regression; the shipped fixes are listed at the bottom for context.

---

## 1. AI quota gating (highest priority — financial risk) 🟡 (backstop shipped)

> **Update (2026-06-23):** a per-user **rate-limit backstop** now covers every
> endpoint listed below via the new `aiProcedure` (`server/_core/aiRateLimit.ts`,
> `AI_RATE_PER_MINUTE`/`AI_RATE_PER_DAY`) — this stops runaway-cost/abuse. What
> remains is the **per-plan AI quota/credit model** (the product decision below);
> the backstop is a safety net, not billing.

**Problem.** `enforcePostQuota` is wired into only `content.generate`
(`server/routers/contentRouter.ts`). Every other paid LLM path runs OpenAI work
with **no quota/credit check**, so a logged-in free / trial-exhausted user can
generate unlimited paid AI output (uncapped cost). Endpoints with no gate today:

- `server/langchainRouter.ts` — `generateWithVoice`, `improveContent`,
  `generateHashtags`, `createContentSeries`, `coachChat`, `analyzeTrends`
- `server/routers/hashtagRouter.ts` — `generateSuggestions`
- `server/routers/coachRouter.ts` — `chat`
- `server/routers/contentEnhancementRouter.ts` — all 8 procedures
- `server/routers/contentRouter.ts` — `improve`, `enhanceIdea`
- `server/routers/contentRouter.ts` — `generateImageNanoBanana` (no subscription
  AND no quota check; `generateImageDallE` is Pro-gated but never metered)

**Decisions needed before implementing (product):**
1. Which endpoints count against a quota vs. are free utilities?
2. Do AI actions decrement the existing **post** counter, or a **separate
   AI-credit / image** meter? (`userUsageTracking` already has an `imagesUsed`
   column that is never enforced.)
3. Free/trial limits per action type? Pro = unlimited or higher cap?

**Suggested approach (once decided):** a small reusable tRPC middleware
`meteredAiProcedure` (or a shared `await enforceAiQuota(ctx.user.id, "kind")`
helper) applied to the paid procedures, mirroring `enforcePostQuota`'s atomic
conditional-update pattern (already race-safe — see `server/db.ts`).
**Effort:** M.

---

## 2. Integration tests for revenue/safety-critical flows 🔴

**Problem.** Highest-blast-radius flows have **no real tests** (current tests
mock `./db` and assert mock shapes):
- Stripe webhook (`server/_core/index.ts` `POST /api/stripe/webhook`) — signature
  verification, plan activation, idempotency.
- Vipps webhook (`server/routes/vippsWebhook.ts`) — raw-body HMAC, amount match.
- `enforcePostQuota` behaviour (trial cap, monthly cap, atomic race-safety).
- Tenant isolation across routers (a couple of unit guards exist, e.g.
  `server/schedulingService.test.ts`, but not broad).

**Blocker:** needs a throwaway **test MySQL** (e.g. a CI service container) and
`index.ts` refactored to **export the Express `app`** (currently built inside
`startServer()` and not exported) so webhook routes can be driven with supertest.

**Suggested minimal set (≈7 tests):** see the test plan in the audit notes —
Stripe webhook happy-path + tampered-signature + idempotency; Vipps HMAC ok/bad;
quota trial+monthly; tenant isolation via `createCaller`; tRPC error redaction.
**Effort:** L.

---

## 3. Pin remaining `pnpm.overrides` to exact versions 🟡

**Problem.** Most security overrides in `package.json` still use `>=` ranges,
which CLAUDE.md warns can drift to a new major and break a transitive consumer.
(`undici`, `path-to-regexp`, `nanoid` are already exact-pinned.)

**Why deferred:** a blind bulk-pin **breaks peer deps** — pinning `vite` to its
floor `5.4.21` conflicts with the project's real `vite@8.0.16` (the old `>=5.4.21`
value resolved correctly to 8). Each override must be pinned to the **actually
resolved** version (not the range floor), then validated.

**Suggested approach:** for each override, read the resolved version from
`pnpm-lock.yaml` / `node_modules/.pnpm`, set the override **value** to that exact
version, run `pnpm install`, then `pnpm build` + `pnpm test` + boot smoke. Do it
in real CI where peer-dep warnings and a full `--frozen-lockfile` install are
checked. **Note:** the lockfile already freezes installs (CI/Docker use
`--frozen-lockfile`), so drift only bites on deliberate lock regeneration.
**Effort:** M.

---

## 4. Migration baseline for the existing (push-built) database 🟡

**Context:** deploy now runs `drizzle-kit migrate` as a separate one-shot job
(no more `push --force` at boot — see Dockerfile / docker-compose `migrate`
service). Migration history is internally consistent (no duplicate `CREATE
TABLE`). On a **fresh** DB, `migrate` works from `0000`.

**Action needed (requires DB access):** the existing production DB was built with
`drizzle-kit push`, so its schema exists but the `__drizzle_migrations` journal is
empty → `migrate` would try to re-create existing tables and fail. **Baseline it
once**: mark all current migrations as already-applied (insert their hashes into
`__drizzle_migrations`) so future `migrate` only applies new ones. Verify on a
clone before touching prod. **Effort:** S (but needs prod DB access + care).

---

## 5. Smaller follow-ups 🟢

- **Scheduler topology.** The cron is now gated behind `RUN_SCHEDULER` (run it on
  exactly one instance) + per-row claim + a reaper for stuck `publishing` rows.
  Still ideal for scale: a single leader-elected worker (or DB advisory lock)
  instead of relying on operators setting `RUN_SCHEDULER=false` on web instances.
- **`/ready` treats Redis `skipped` as ready** (`server/_core/index.ts`). Fine
  while running without Redis, but once Redis is mandatory in prod, make
  `redis:"skipped"` fail readiness (or at least alert). Tied to making
  `REDIS_URL` fatal in `validateEnv.ts` for production.
- **Session/JWT lifetime is ~1 year with no rotation/revocation**
  (`shared/const.ts`, `server/_core/sdk.ts`). Consider shorter sessions + sliding
  refresh + a revocation/token-version mechanism.
- ~~**OAuth login CSRF**~~ ✅ **DONE (2026-06-23):** the Google login flow now mints
  a random `state` + PKCE verifier (short-lived httpOnly cookies) and the callback
  verifies `state` constant-time + exchanges with the verifier. ⚠️ still needs a
  live end-to-end Google login test before merge.
- **CSP `script-src` includes `'unsafe-inline'`** (`server/_core/index.ts`) —
  move to nonce/hash-based inline scripts to restore XSS protection.
- **Hardcoded plan prices in client copy** (BillingManagement, Settings,
  VoiceTraining, PricingDemo, Terms) — derive from `shared/pricing.ts` where it's
  display logic (legal copy in Terms can stay literal).

---

## Already shipped on `fix/drizzle-migration-history` (for context)

- Migrations no longer run at app boot; multi-stage non-root Dockerfile + real
  HEALTHCHECK + one-shot `migrate` compose service.
- Graceful shutdown (SIGTERM drain + scheduler stop + Redis quit); fatal-boot
  exit(1).
- tRPC error redaction in prod; Secure cookies in prod; dev-login hard-disabled
  on real prod HTTPS.
- Sentry actually initialised + wired (was dead); unhandled rejection/exception
  capture.
- Atomic quota increment (race-safe); scheduler atomic claim + overlap guard +
  stale-`publishing` reaper; `schedulePost` tenant-ownership check (+ regression
  test).
- CI pipeline (typecheck / test / build / boot-smoke).
- LangChain and Stripe SDK lazy-loaded off the cold-start path.
- Admin revenue derived from `shared/pricing.ts`; dead code removed.
- `RUN_SCHEDULER` gate so the in-process cron runs on exactly one instance.
- Per-user AI rate-limit backstop (`aiProcedure`) on all paid LLM/image endpoints.
- OAuth `state` + PKCE on the Google login flow (login-CSRF fix; pending live test).
