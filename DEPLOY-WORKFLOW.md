# Penna — Deploy Workflow (safe releases)

The old flow was **push to `main` → auto-deploy to production**, with no gate and
no staging. A bad migration (0074) silently blocked three deploys while users sat
on the last good build. This document is the safer replacement.

## The pipeline

```
feature branch
   │  open PR  →  CI runs (.github/workflows/ci.yml)
   ▼
[ CI gate: frozen install · tsc · eslint · vitest · pnpm audit ]  ← must be GREEN
   │  merge PR
   ▼
staging branch  →  auto-deploys to nexify-ai-staging  (test DB, test payment keys, cron OFF)
   │  smoke-test on staging (see checklist)
   ▼
merge staging → main  →  auto-deploys to nexify-ai  (production, penna.no)
```

Two rules make this real; set them up once:

### 1. Branch protection (GitHub → Settings → Branches)
Add a rule for **`main`** and another for **`staging`**:
- ✅ Require a pull request before merging
- ✅ Require status checks to pass → select **`quality`** (the CI job)
- ✅ Require branches to be up to date before merging
- ✅ (main only) Include administrators — so nothing bypasses the gate

Without this, CI is only advisory. WITH it, nothing broken can reach either branch.

### 2. Staging service on Render (from `render.yaml`)
`render.yaml` now defines **two** web services + **two** Redis instances:
- `nexify-ai` → branch `main` (production)
- `nexify-ai-staging` → branch `staging`

Set up staging once:
1. Create a **separate** TiDB database for staging (never reuse prod).
2. Render → Blueprint sync (or New → Blueprint) to create `nexify-ai-staging`.
3. In the staging service, set the `sync:false` secrets to **test/staging** values:
   `DATABASE_URL` (staging DB), `STRIPE_SECRET_KEY=sk_test_…`, test webhook secret,
   `pk_test_…`, `PUBLIC_SITE_URL=https://staging.penna.no`.
4. `APP_ENV=staging` and `RUN_SCHEDULER=false` are already set in the blueprint —
   staging must never publish real posts.
5. Add `robots: noindex` for the staging domain (via `APP_ENV` check in the app,
   or Render header rule) so Google never indexes it.

## Migration safety (this is what bit us)
TiDB rejects multi-statement migrations (`errno 8130`). Rules:
- Separate every statement with a line that is exactly `--> statement-breakpoint`.
- **Never** write the phrase `statement-breakpoint` inside a comment — drizzle
  splits on it and you get parse error 1064.
- Prefer **expand → contract**: add nullable column / new index first, deploy,
  backfill, then in a later release drop the old path. Backward-compatible
  migrations mean a Render **Rollback** won't crash on schema mismatch.
- Migrations now rehearse on the **staging DB** (staging pre-deploy) before they
  ever touch prod. If a migration is going to fail, it fails on staging.

## Rollback
Render → the service → **Manual Deploy → Rollback** to the previous successful
deploy. Because migrations are backward-compatible (expand-contract), the old
image runs fine against the new schema. Know this path *before* you need it.

## Pre-commit hooks (husky + lint-staged) — one-time setup
Catches lint/type errors locally before they reach CI. This edits `package.json`
(and therefore the lockfile), so it must be done on a machine that can run
`pnpm install` — it is intentionally NOT bundled into the auto-deploy build.

```bash
pnpm add -D husky lint-staged
pnpm exec husky init
echo 'pnpm exec lint-staged' > .husky/pre-commit
```
Add to `package.json`:
```json
"lint-staged": {
  "*.{ts,tsx}": ["eslint --fix", "bash -c 'tsc --noEmit'"]
}
```
Commit the `.husky/` dir, `package.json`, and the refreshed `pnpm-lock.yaml`.

## Lockfile hygiene (do this now)
`pnpm-lock.yaml` is missing `qrcode.react`, so `pnpm install --frozen-lockfile`
(now used by CI *and* both Render builds) will fail until you sync it:
```bash
git checkout main && git pull
pnpm install                       # regenerates the lockfile
git add pnpm-lock.yaml
git commit -m "fix: sync pnpm-lock.yaml (qrcode.react)"
git push
```
Do this on the SAME PR that adds `render.yaml`'s frozen build, or the first
staging build will fail on the lockfile.

## Secrets — stop pasting tokens in chat
- GitHub push tokens: fine-grained, least scope, short expiry (what you're doing).
- For CI/CD automation, prefer **GitHub Actions + OIDC** over long-lived tokens —
  no secret to leak.
- Any token pasted into a chat/screenshot is exposed → **revoke it after use**.

## Staging smoke-test checklist (before promoting to main)
- [ ] App boots, `/health` and `/ready` return 200
- [ ] Text generation · Gjenbruk · Calendar · A/B · Trends · Voice · Coach · Telegram — no regressions
- [ ] Stripe **test** checkout: angrerett gate blocks payment until ticked → `4242…` succeeds → webhook activates plan
- [ ] Vipps **test** login + payment + refund (server-side amount)
- [ ] No fake social proof / unsubstantiated numbers on landing
- [ ] AI image text renders clean (no garbled letters)
- [ ] New migration applied cleanly on staging DB
