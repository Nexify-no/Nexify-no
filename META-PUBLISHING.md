# Penna — Meta (Facebook) Publishing: dev handover

Status: **code-complete on `feat-meta-publishing`**; gated in the UI («kommer
snart») until Meta App Review approves the scopes.

## What was the actual gap
The repo already had the full pipeline: `scheduled_posts` table + 5-min cron
scheduler (`startScheduler()`), `PublishingManager` with a `FacebookPublisher`,
and a `handleFacebookCallback` tRPC mutation. Two things were broken:

1. **OAuth stored a SHORT-LIVED USER token** (hours). Scheduled posts would die
   as soon as it expired, and publishing had to look up `/me/accounts` on every
   post.
2. The publisher ignored the connected Page and always used the user's first
   Page from `/me/accounts`.

## What changed (uploaded drop-in adapted to the existing architecture — no new tables/routers/workers)
- `server/services/platformOAuthService.ts`
  - `FacebookOAuth` completed: code → short token → **long-lived** token →
    **PAGE token** (effectively non-expiring) from `/me/accounts`; Graph
    **v21.0**; scopes `pages_show_list, pages_manage_posts,
    pages_read_engagement, business_management`; returns `accountId/accountName`
    (the Page).
  - New `platformManager.getPlatformConnection()` — token **plus** the stored
    page id/name.
- `server/routers/platformRouter.ts` — the Facebook callback now saves the Page
  id/name with the token.
- `server/services/publishingService.ts` — `FacebookPublisher.publish(token,
  content, pageId?)`: posts **directly to the stored Page** with the Page token
  (v21.0); keeps a legacy `/me/accounts` fallback for old user-token
  connections; surfaces real Graph errors, and error 190 → «koble til Facebook
  på nytt». Both `publishToAllConnectedPlatforms` and
  `publishToSpecificPlatforms` pass the stored page id.
- `multiPlatformService`/`facebookService` (manual page-token path) already
  accept explicit page tokens — untouched.
- Scheduling: existing `scheduled_posts` cron path publishes Facebook like any
  platform. (Native FB `scheduled_publish_time` stays available via
  `facebookService.schedulePostToFacebook` for the manual flow.)

## Env (Render)
| Var | Value |
|---|---|
| `FACEBOOK_CLIENT_ID` | Meta **App ID** |
| `FACEBOOK_CLIENT_SECRET` | Meta **App Secret** |
| `FACEBOOK_REDIRECT_URI` | `https://penna.no/oauth/facebook/callback` (must match the app config) |
| `META_GRAPH_VERSION` | optional, default `v21.0` |

## Admin checklist (you — not code)
1. developers.facebook.com → create the Meta App (Business type) for
   **Nexify CRM Systems AS**.
2. Start **Business Verification** immediately (it is the long pole).
3. **App Review** (Advanced Access) with screencasts for: `pages_show_list`,
   `pages_manage_posts`, `pages_read_engagement`, `business_management`.
4. Add **Meta** as databehandler in `/privacy`.
5. Hand the dev/Render: App ID + App Secret (as env vars above).

## Rollout gate
- **Dev/your own account:** works now (app in Development mode; you're an app
  admin/tester) — full end-to-end testing possible before review.
- **Customers:** only after App Review approval. Until then keep the Facebook
  connect button as **«kommer snart»** — otherwise customers will try and fail.
- Limits: **25 posts / 24h per Page**; watch the `X-Page-Usage` header.

## Test plan (Development mode, your admin account)
1. Set the 3 env vars; connect via «Koble til Facebook» → expect the connection
   saved with your **Page name** (not your user name).
2. Publish now → post appears on the Page; `platformIntegrations.accountId` =
   page id.
3. Schedule a post 10 min out → cron publishes it; verify status transitions.
4. Revoke the app from Facebook settings → next publish shows «koble til
   Facebook på nytt» (error 190) rather than a silent failure.
