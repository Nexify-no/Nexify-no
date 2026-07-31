/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Guards the fix for the soft-404 / index-bloat bug.
 *
 * Two failure modes this catches:
 *  1. Someone adds a <Route> to App.tsx and forgets the manifest → the new page
 *     is served as a 404 to crawlers (and to anyone opening a shared link on a
 *     cold load), which is worse than the bug we started with.
 *  2. Someone marks an authenticated screen as "public" → it becomes indexable
 *     again and re-enters Google with the homepage title.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  classifyRoute,
  normalizePath,
  PUBLIC_ROUTES,
  APP_ROUTES,
} from "../shared/routeManifest";

/** Every `path="/x"` / `path={"/x"}` declared in the client route table. */
function declaredRoutes(): string[] {
  const appTsx = fs.readFileSync(
    path.resolve(import.meta.dirname, "..", "client", "src", "App.tsx"),
    "utf-8"
  );
  const found = new Set<string>();
  for (const m of appTsx.matchAll(/path=\{?"([^"]+)"/g)) found.add(m[1]);
  return [...found];
}

describe("route manifest", () => {
  it("classifies every route declared in App.tsx", () => {
    // Parameterised routes (/blog/:slug) are covered by PUBLIC_PREFIXES, so we
    // probe them with a concrete value instead of the literal pattern.
    const unclassified = declaredRoutes()
      .map((r) => (r.includes(":") ? r.replace(/:[^/]+/g, "sample-value") : r))
      .filter((r) => classifyRoute(r) === "unknown");

    expect(
      unclassified,
      `These routes exist in App.tsx but are missing from shared/routeManifest.ts, ` +
        `so the server would answer them with 404: ${unclassified.join(", ")}`
    ).toEqual([]);
  });

  it("returns 'unknown' for paths that do not exist", () => {
    expect(classifyRoute("/definitely-not-a-page")).toBe("unknown");
    expect(classifyRoute("/blog")).not.toBe("unknown");
    // A bare prefix is not an article.
    expect(classifyRoute("/wp-admin")).toBe("unknown");
  });

  it("keeps authenticated screens out of the indexable set", () => {
    for (const p of ["/dashboard", "/generer", "/merkehjerne", "/account-settings", "/admin/users"]) {
      expect(classifyRoute(p), `${p} must not be indexable`).toBe("app");
    }
  });

  it("keeps the marketing surface indexable", () => {
    for (const p of ["/", "/pricing", "/priser", "/contact", "/blog", "/blog/some-article"]) {
      expect(classifyRoute(p), `${p} must stay indexable`).toBe("public");
    }
  });

  it("normalises query strings, trailing slashes and case", () => {
    expect(normalizePath("/Pricing/")).toBe("/pricing");
    expect(normalizePath("/blog?utm_source=x")).toBe("/blog");
    expect(normalizePath("/contact#form")).toBe("/contact");
    expect(normalizePath("")).toBe("/");
    expect(classifyRoute("/pricing/?ref=nyhetsbrev")).toBe("public");
  });

  it("has no route listed as both public and app", () => {
    const overlap = PUBLIC_ROUTES.filter((r) => APP_ROUTES.includes(r));
    expect(overlap, `Ambiguous classification for: ${overlap.join(", ")}`).toEqual([]);
  });
});
