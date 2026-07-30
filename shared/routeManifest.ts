/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Route manifest — which URLs exist, and which of them search engines may index.
 *
 * Problem this solves: the SPA fallback in server/_core/vite.ts answered EVERY
 * unmatched path with `200 OK` + the app shell. So `/zzz-does-not-exist` returned
 * 200 with `<meta name="robots" content="index, follow">` — a textbook soft 404.
 * Google treats those as thin duplicates of the homepage and can index arbitrary
 * junk URLs (including ones invented by scrapers or broken external links).
 *
 * A second, related leak: authenticated app screens (`/generer`, `/merkehjerne`,
 * `/account-settings`, …) inherited the homepage's indexable meta and got
 * indexed with duplicate titles — index bloat that dilutes the pages that
 * should rank.
 *
 * Classification:
 *   "public"  → real marketing/legal/blog page. 200 + indexable.
 *   "app"     → authenticated product surface. 200 + noindex (the route exists;
 *               we just don't want it in the index).
 *   "unknown" → nothing here. 404 + noindex.
 *
 * Keep in sync with the <Route> table in client/src/App.tsx. The test in
 * shared/__tests__/routeManifest.test.ts fails if App.tsx declares a route this
 * manifest doesn't know about.
 */

export type RouteClass = "public" | "app" | "unknown";

/**
 * Publicly indexable routes (exact matches).
 * Norwegian and English aliases both listed; canonical tags in the SSR layer
 * already collapse the duplicates (e.g. /priser → /pricing).
 */
export const PUBLIC_ROUTES: readonly string[] = [
  "/",
  "/pricing",
  "/priser",
  "/faq",
  "/about-us",
  "/om-oss",
  "/contact",
  "/kontakt",
  "/privacy",
  "/privacy-policy",
  "/personvern",
  "/terms",
  "/terms-of-service",
  "/vilkar",
  "/cookie-policy",
  "/salgsbetingelser",
  "/blog",
  "/blogg",
  "/security",
  "/login",
];

/** Publicly indexable prefixes — blog articles live under /blog/:slug. */
export const PUBLIC_PREFIXES: readonly string[] = ["/blog/", "/blogg/"];

/**
 * Authenticated / product routes. These exist but must not be indexed.
 * Mirrors the private half of App.tsx's route table.
 */
export const APP_ROUTES: readonly string[] = [
  "/dashboard",
  "/landing",
  "/onboarding",
  "/kom-i-gang",
  "/generate",
  "/generer",
  "/brand-brain",
  "/merkehjerne",
  "/content-plan",
  "/innholdsplan",
  "/lag-plan",
  "/posts",
  "/innlegg",
  "/calendar",
  "/kalender",
  "/best-time",
  "/beste-tid",
  "/repurpose",
  "/gjenbruk",
  "/content-series",
  "/innholdsserier",
  "/idea-bank",
  "/ide-bank",
  "/trends",
  "/trender",
  "/examples",
  "/eksempler",
  "/voice-training",
  "/stemme",
  "/coach",
  "/telegram-bot",
  "/telegram-posts",
  "/telegram-innlegg",
  "/competitor-radar",
  "/konkurrent-radar",
  "/ab-testing",
  "/weekly-report",
  "/ukentlig-rapport",
  "/engagement-helper",
  "/engasjement-hjelper",
  "/analytics",
  "/progress",
  "/profile",
  "/settings",
  "/innstillinger",
  "/settings/billing",
  "/settings/platforms",
  "/account-settings",
  "/reset-password",
  "/support/tickets",
  "/payment/success",
  "/payment/cancel",
  "/payment/failure",
  "/subscription/success",
  "/subscription/cancel",
  "/404",
];

/** Everything under these prefixes is private tooling. */
export const APP_PREFIXES: readonly string[] = ["/admin", "/api", "/private"];

/** Normalise a URL path: strip query/hash, collapse a trailing slash. */
export function normalizePath(pathname: string): string {
  let p = (pathname || "/").split("?")[0].split("#")[0];
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p.toLowerCase() || "/";
}

/** Classify a request path so the server can pick status code + robots meta. */
export function classifyRoute(pathname: string): RouteClass {
  const p = normalizePath(pathname);

  if (PUBLIC_ROUTES.includes(p)) return "public";
  if (PUBLIC_PREFIXES.some((prefix) => p.startsWith(prefix) && p.length > prefix.length)) {
    return "public";
  }

  if (APP_ROUTES.includes(p)) return "app";
  if (APP_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`))) return "app";

  return "unknown";
}
