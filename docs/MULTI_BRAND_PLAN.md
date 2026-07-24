# Multi-brand plan (Enkel-first)

One customer account (users.id = account_id) manages several brands. Each brand owns
its Merkehjerne, voice, posts/images, 4-week plans, schedule and social destinations.
Everything ships behind FEATURE_MULTI_BRAND until tests pass.

## Current state (audited)

| Concern | Today |
|---|---|
| Account | `users.id` (no separate account table) |
| Identity | `brand_profiles` with UNIQUE(user_id) - exactly one per account |
| LinkedIn destination | `linkedin_connections` (1:1 user): publishTarget + organizationUrn/Name |
| FB / IG / X | no connection tables yet |
| Plans | `content_plans` already carry workspaceId + brandSnapshot + profile/visual versions |
| Worker | reads plan.brandSnapshot only (already isolated per plan) |
| User scheduling | `scheduled_posts` (+ `content_schedule`); `calendar_events` is a global holiday catalog |
| Flags | env (`FEATURE_*`) exposed to client via tRPC (e.g. plan.flags) |

## Target model

Account -> brands -> {brand_profiles, content_plans/planned_posts, posts (+images on posts),
scheduled_posts, content_schedule, brand_social_connections, publications}.
`users.active_brand_id` selects the working brand. account_id/permissions always from
session (ctx.user.id), never from client input.

## Phases (each = one flag-gated PR)

### MB1 - Foundation (this PR)
- Migration 0089: `brands` table; `users.active_brand_id`; nullable `brand_id` on
  brand_profiles, posts, scheduled_posts, content_plans, planned_posts, content_schedule,
  linkedin_connections; swap brand_profiles UNIQUE(user_id) -> UNIQUE(user_id, brand_id).
- Lazy safe backfill (`ensureDefaultBrand`): first use creates a default brand from the
  existing Merkehjerne (name/website), links all the user's legacy rows, sets active_brand_id.
  No cross-source guessing; linkedin_connections is linked to the default brand only when
  the account has exactly one brand (else left for needs_brand_assignment in MB2).
- `brands` router: flags/list/create/setActive/archive (+ last-brand archive guard).
- BrandSelector in the sidebar (flag-gated): switch invalidates ALL queries (no stale
  cross-brand data; brandLoading while switching).
- Brand scoping helpers exported for later phases.

### MB2 - Brand social connections
- `brand_social_connections` (account_id, brand_id, platform, provider_connection_id,
  destination_id/name/type, status incl. needs_brand_assignment, token_expires_at).
- Migrate linkedin_connections rows into it (status=needs_brand_assignment when ambiguous).
- Publish window redesign: shows brand + platform + destination name; disabled
  unconnected platforms; no publish without destination; final confirm; idempotency key;
  publication log (status + provider response).
- MANDATORY guard: post.brand_id === connection.brand_id else abort + security event.

### MB3 - Simple UX
- Enkel sidebar: Oversikt / Lag innhold / Innholdsplan / Mine innlegg / Kalender /
  Innstillinger / Bytt til avansert.
- Add brand via URL -> analyze -> confirm screen (name, description, services, audience,
  language, tone, colors, facts+sources; buttons Bekreft og lag innhold / Rediger /
  Analyser pa nytt with visible loading/success/error) -> only then generate.
- Enkel generate: brand preselected, brand-generated example chips (replace static
  "ballongpakke" examples), connected-platforms picker only, auto image, one button.
  Result actions: Rediger / Bytt bilde / Lag pa nytt / Lagre som utkast / Publiser na /
  Planlegg; explicit save message + where it lives.
- 4-week plan: pre-generation summary (brand, period, platform, post/image counts, quota
  needed/left); per-post verification state + destination; bulk actions (Godkjenn alle
  sikre / Lagre valgte / Planlegg valgte / Publiser valgte). Never auto-approve
  needs_review/high_risk.

### MB4 - Scheduling + safety
- Draft -> Planlegg dialog (date/time/timezone/platform/destination + preview).
- Calendar date click -> pick existing draft OR create new with scheduled_at carried
  through generation; after confirm: post.status=scheduled + scheduled_posts row ->
  calendar shows it immediately.
- Content verification layer: verified / needs_review / unsupported / high_risk.
  Numbers, customer stories, prices, services and links must trace to Merkehjerne facts;
  seasonal check against proposed publish date/locale; repetition check across a plan.
- Images: link account/brand/post/generation/visual-identity-version; text-edit warning +
  Oppdater bilde; reject cross-brand or stale-generation images; alt text.
- Full test matrix (3 brands, parallel generation, late cross-brand image, cross-brand
  publish block, calendar date persistence, idempotency, migration, a11y, mobile, CI).

## Legacy data migration (safe rules)
1. Default brand per account with legacy data; move Merkehjerne to it; link old
   posts/plans/images to it.
2. Never auto-attach a social connection when identity is ambiguous ->
   needs_brand_assignment; ask the user on first login.
3. Never assume Ballong account + Penna page + Nexify LinkedIn are one brand.

## Files touched in MB1
drizzle/0089_multi_brand.sql, drizzle/meta/_journal.json, drizzle/schema.ts,
server/_core/env.ts, server/services/brands.ts (new), server/routers/brandsRouter.ts (new),
server/routers.ts, client/src/components/BrandSelector.tsx (new),
client/src/components/DashboardNav.tsx.
