# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`nexify-ai` (product name "Innlegg") — a Norwegian SaaS that generates AI social-media content. Single package, not a workspace: a Vite/React client and an Express + tRPC server share one `package.json`, the `drizzle/` schema, and the `shared/` folder. Package manager is **pnpm**.

## Commands

```bash
pnpm install              # install (lockfile is authoritative; CI uses --frozen-lockfile)
pnpm dev                  # tsx watch server/_core/index.ts — runs API + Vite middleware together
pnpm check                # tsc --noEmit — THE typecheck gate (see warning below)
pnpm test                 # vitest run (all server/**/*.test.ts)
npx vitest run server/telegram.actions.test.ts   # single test file
npx vitest run -t "should activate subscription"  # single test by name
pnpm build                # vite build + esbuild bundle of the server entry
pnpm db:generate          # drizzle-kit generate — diff schema.ts → new migration (offline)
pnpm db:migrate           # drizzle-kit migrate — apply pending migrations (needs DATABASE_URL)
pnpm db:push              # drizzle-kit push — DEV ONLY direct schema sync (never in prod/CI/Docker)
pnpm format               # prettier --write .
```

### ⚠️ Three independent gates — green tsc/tests is NOT enough
`pnpm build` (`vite build && esbuild ... --bundle`) does **not** run `tsc`; and `pnpm check`/`pnpm test` do **not** run the bundled server. All three can be green while the production bundle crashes on boot (it has happened — a transitive dep mismatch from a `pnpm.overrides` entry). Before declaring "production-ready":
1. `pnpm check` (types) — `tsconfig.json` now includes test files too.
2. `pnpm test` (logic).
3. `pnpm build` then **actually run `node dist/index.js`** with prod env and hit `/health` + `/ready`.

### ⚠️ `pnpm.overrides` values must be PINNED, not `>=`
Security overrides written as `"pkg@<x": ">=y"` resolve to the **latest** satisfying version, which can jump a major and break a transitive consumer at runtime (e.g. `undici` jumped to 8.x and broke `jsdom`; `path-to-regexp` jumped to 8.x and broke Express 4 — both only caught by booting the bundle). Pin the value to an exact compatible version (`"7.28.0"`, `"0.1.13"`).

### Server fails fast on missing config
`server/_core/validateEnv.ts` runs at boot (called from `index.ts`) and aggregates all required env into one error. Always required: `JWT_SECRET` (≥32), `DATABASE_URL`. Production-required: `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TOKEN_ENCRYPTION_KEY`, `PUBLIC_SITE_URL`. Production warnings (boot but feature degraded/fail-closed): `REDIS_URL`, `VIPPS_SECRET_KEY`, `TELEGRAM_WEBHOOK_SECRET`. Optional (with safe defaults): `CONTENT_MODEL`/`LLM_MODEL` (two-tier text models), `IMAGE_PROVIDER`/`IMAGE_MODEL`/`FAL_API_KEY` (image provider: `openai` DALL·E or `fal` FLUX), `SENTRY_DSN`. Full reference: `.env.example`.

### Deploy & migrations — NEVER at app boot
Migrations run as a **separate one-shot job** (`pnpm db:migrate` / the compose `migrate` service built from the Dockerfile `migrator` stage), and the app waits for it (`service_completed_successfully`). The runtime image is multi-stage, **non-root**, prod-deps-only (no drizzle-kit), with a `/health` `HEALTHCHECK`; its CMD is `node dist/index.js` ONLY — a restart never alters the DB. An already-`push`-built DB must be **baselined** once before switching to `migrate` (see `docs/PRODUCTION_READINESS_BACKLOG.md`). `index.ts` registers SIGTERM/SIGINT **graceful shutdown** (drain HTTP, stop scheduler, quit Redis). The in-process scheduler is gated behind **`RUN_SCHEDULER`** — it must run on exactly one instance (set `false` on web instances when scaling). Google **login** uses OAuth `state` + PKCE (short-lived httpOnly cookies, verified constant-time on callback).

### Observability — Sentry must init FIRST
`server/_core/instrument.ts` (imported first in `index.ts`, right after dotenv) calls `initSentry()` before express/other modules load (v8+ requirement); it no-ops without `SENTRY_DSN`. `Sentry.setupExpressErrorHandler` + process `unhandledRejection`/`uncaughtException` handlers are wired. Don't move the instrument import below other imports.

### ⚠️ Runtime gotchas (learned 2026-06-22 — green tsc hides all of these)
- **The IP rate-limiter must only cover `/api`.** `ipRateLimiter` (`_core/rateLimiter.ts`, 100/min) skips everything not under `/api`. Do NOT mount it globally — a single page load is dozens of asset/Vite-module requests, so a global limiter `429`s the SPA's own bootstrap and the app renders a blank white screen.
- **`getDb()` passes the schema** (`drizzle(url, { schema, mode: "default" })`). Without it `db.query.*` (Drizzle relational queries) is `undefined`. Both styles work now: `db.select().from(table)` and `db.query.table.findFirst()`.
- **Never send `thinking` (or other non-OpenAI params) to `invokeLLM`.** OpenAI 400s the whole request on an unrecognized argument, which silently breaks every invokeLLM feature (Coach, repurpose, series, A/B, engagement, hashtags). `_core/llm.ts` targets the OpenAI Chat Completions shape only.
- **Pricing has ONE source of truth: `shared/pricing.ts`.** Plans = Gratis(2)/Pro(15·199)/Premium(30·399), annual −10%. Landing, `/pricing`, `server/stripe/products.ts`, quotas and `ensureSubscriptionPlans()` (seeds `subscription_plans` at boot) all derive from it — never hard-code a price/limit elsewhere.
- **Generation persists.** `content.generate`/`repurpose`/`series.generatePost` save a draft `posts` row (so "Mine innlegg" isn't empty). Scheduling source of truth is the **`scheduled_posts`** table (the scheduler reads it, not `posts.status`).
- **LLM-as-JSON:** extract the first balanced JSON value, don't `JSON.parse` the raw model output (models wrap it in ```json fences / trailing prose). See `extractFirstJson*` in `langchain/service.ts`.
- **Rendering AI lists:** `analyzeTrends` returns objects `{ topic, contentIdeas }`, not strings — render `idea.topic`, never the raw object (else "Objects are not valid as a React child" crashes the page).
- **Quota is enforced atomically.** `enforcePostQuota` (`server/db.ts`) increments via a conditional update (`SET x = x+1 WHERE x < limit`) and treats `affectedRows === 0` as over-quota — don't revert it to read-then-update (race-exploitable).
- **Scheduler claims rows before publishing.** `server/schedulerService.ts` flips a due row `scheduled→publishing` atomically and only proceeds if it claimed it (prevents double-publish across instances); a reaper resets rows stuck in `publishing`. It still runs in every instance — see backlog for leader-election.
- **Keep heavy SDKs off the boot path.** `appRouter` is imported eagerly at startup, so router files must NOT import heavy SDKs (LangChain, Stripe, OpenAI, aws-sdk) at module scope — use `await import(...)` inside the procedure (the established pattern). `langchainRouter`/`paymentRouter` were refactored this way for cold start.
- **Paid AI endpoints use `aiProcedure`, not `protectedProcedure`.** `aiProcedure` (`_core/trpc.ts`) adds a per-user rate-limit backstop (`_core/aiRateLimit.ts`) against runaway OpenAI cost/abuse. Use it for any new LLM/image-generation procedure. It is NOT the billing model — per-plan AI quota is still open (backlog §1).

## Architecture

### Two layers under `server/`
- **`server/_core/`** — the framework/runtime layer (auth, http, security, infra). Treat it as the platform: `index.ts` (Express bootstrap + all route/middleware wiring + Stripe/Vipps/Telegram webhooks + `/health` liveness & `/ready` DB+Redis readiness probes), `validateEnv.ts` (boot-time config check), `trpc.ts` (procedure builders), `context.ts` (builds tRPC context), `sdk.ts` (session-token sign/verify via `jose`), `env.ts`, `rateLimiter.ts` (+ `redis.ts` for the distributed store), `securityHeaders.ts` (`enforceHttps` redirects to the `PUBLIC_SITE_URL` canonical host — never the `Host` header), `abuseProtection.ts`, `cookies.ts`, `vite.ts`, `llm.ts`, `imageGeneration.ts`, `tokenCrypto.ts`, `oauthState.ts`, `sanitizeHtml.ts`.
- **`server/routers.ts`** — the large tRPC aggregator (~2000 lines) that composes `server/routers/*.ts` (17 feature routers: subscription, payment, vipps, social media, support, admin, scheduling, etc.) plus many inline procedures. This is the app layer. Start here to find an API endpoint.

### Auth model (important, easy to get wrong)
Authentication happens **inside tRPC `createContext`** (`context.ts` → `sdk.authenticateRequest`), not in Express middleware. The session is a JWT cookie; the user row (including `role`) is loaded from the DB, so `ctx.user.role` is server-trusted and **not** client-controllable. Procedure tiers in `_core/trpc.ts`: `publicProcedure`, `protectedProcedure` (requires `ctx.user`), `adminProcedure` (requires `role === "admin"`). Several routers redefine their own `adminProcedure` inline — keep that pattern. Express-level middleware that needs the user reads `req.user`, which is populated by an `attachUser` middleware on `/api/trpc` in `index.ts` (Express never sets it otherwise).

### Data layer
Drizzle ORM over MySQL/TiDB. **`getDb()` is async** (`server/db.ts`) — you must `await getDb()` before calling `.select()/.insert()/...`. Calling query methods on the un-awaited promise is a recurring bug. Schema lives in `drizzle/schema.ts` (single source of truth); migrations in `drizzle/*.sql` + `drizzle/meta/`. After editing the schema, run `pnpm db:push` (or `drizzle-kit migrate`). `drizzle-kit generate` works offline (schema diff, no DB) — `drizzle-kit migrate` needs `DATABASE_URL`. `server/db.ts` holds the reusable query helpers; notable ones to reuse instead of re-implementing: `enforcePostQuota` (the **single source of truth** for post quotas — trial=cumulative, active=monthly), `deleteUser` (GDPR erasure across **all** user-scoped tables — extend it when adding a user table), `createPaymentOrder`/`getPaymentOrder`, `markWebhookEventProcessed` (webhook idempotency), `getUserByStripeCustomerId`.

### Payments & webhooks
Stripe and Vipps (Norwegian) both route through webhooks mounted in `_core/index.ts`. Stripe activation listens to `checkout.session.completed` and derives the plan from the trusted `product_key` (in `server/stripe/products.ts`), never a client-sent amount; `invoice.payment_failed` notifies for dunning. Vipps `initiatePayment` persists a server-issued **`payment_orders`** row (user+plan+expected amount); the webhook verifies a raw-body HMAC (constant-time) and trusts that stored order — not the client `orderId` — then cross-checks the captured amount. All payment webhooks are idempotent via the `processed_webhook_events` table (`markWebhookEventProcessed`).

### LLM / integrations
Text + image generation go to OpenAI (`https://api.openai.com`, overridable via `BUILT_IN_FORGE_API_URL`); see `_core/llm.ts`, `server/openaiService.ts`, `_core/imageGeneration.ts` (DALL·E). OAuth tokens for LinkedIn/Telegram/etc. are **encrypted at rest** (AES-256-GCM in `_core/tokenCrypto.ts`) and OAuth `state` is HMAC-signed (`_core/oauthState.ts`) — when adding a new connected integration, reuse both. Background publishing/scheduling is in `server/schedulerService.ts`.

### Client
Vite + React + TypeScript in `client/`. Routing uses **wouter** with lazy pages in `App.tsx` (`client/src/pages/`). tRPC client in `client/src/lib/trpc`. Path aliases (from `vite.config.ts`): `@` → `client/src`, `@shared` → `shared`, `@assets` → `attached_assets`.

### Styling — Tailwind v4 (no JS config)
This uses **Tailwind v4 via `@tailwindcss/vite`** — there is **no `tailwind.config.js`**. All theme config lives in `client/src/index.css`: `@theme` for tokens/animations (`--color-*`, `--animate-*`), `@custom-variant dark (&:is(.dark *))` for class-based dark mode, and global `@keyframes`. To add a Tailwind animation, register `--animate-x` in `@theme` and define `@keyframes x` in the CSS — not a config file. shadcn/ui (new-york style) primitives live in `client/src/components/ui` (`components.json` aliases); `cn` is in `client/src/lib/utils.ts`.

## Conventions
- Procedures use `zod` `.input(...)` for validation; add `.max()` bounds on free-text fields (many feed LLM prompts).
- Scope every per-user query with `and(eq(table.id, id), eq(table.userId, ctx.user.id))` — ownership checks are enforced in-query, not by a separate guard.
- Distributed rate limiting: `_core/rateLimiter.ts` uses a Redis store (`rate-limit-redis` over `ioredis`) when `REDIS_URL` is set, else an in-memory store (dev only — ineffective on serverless).
- Tests are part of `pnpm check` (`tsconfig.json` no longer excludes `*.test.ts`); vitest's `.not` matcher types need `@types/chai@4` (the v5 stub is empty). Tests mock `./db` with `vi.mock`. `vitest.config.ts` runs with `isolate: true`, `fileParallelism: false`, `testTimeout: 30000` (the heavy `import("./routers")` exceeds the 5s default), and `setupFiles: ["./server/test-setup.ts"]` which forces `DATABASE_URL=""` for hermetic, deterministic runs — keep all of these. Network/credential integration tests use `it.skipIf(!process.env.X)`.
