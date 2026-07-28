/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * The consent screen must not claim access the app never requests.
 *
 * Before this test, the Facebook card told the user Penna would "få tilgang til
 * dine venner" / "access your friends". No such scope was ever requested — the
 * copy was written for LinkedIn and duplicated across platforms. That is a
 * problem in two directions: it scares users out of a grant they were right to
 * make, and Meta's App Review compares an app's own UI against the permissions
 * it asks for, so the mismatch is a documented rejection reason.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

const dialog = () => readFileSync("client/src/components/OAuthWarningDialog.tsx", "utf8");
const metaGraph = () => readFileSync("server/services/metaGraph.ts", "utf8");

describe("the Meta consent screen tells the truth", () => {
  it("does not claim access to friends, followers or a network", () => {
    const src = dialog();
    // Only the two Meta arrays. Twitter's card may legitimately say "followers"
    // — a wider slice made this test fail on copy that was never the problem.
    const meta = [
      src.slice(src.indexOf("const META_PERMISSIONS_NO"), src.indexOf("const META_PERMISSIONS_EN")),
      src.slice(src.indexOf("const META_PERMISSIONS_EN"), src.indexOf("const platformDetails")),
    ].join("\n");

    expect(meta).toContain("Publisere innlegg");
    for (const overclaim of ["venner", "friends", "følgere", "followers", "nettverk", "network"]) {
      expect(meta.toLowerCase(), `Meta consent copy claims "${overclaim}"`).not.toContain(overclaim);
    }

    // And the Facebook/Instagram cards must USE those arrays rather than
    // reintroducing their own literal list.
    const cards = src.slice(src.indexOf("instagram: {"), src.indexOf("export function OAuthWarningDialog"));
    expect(cards).not.toMatch(/permissions:\s*\[/);
  });

  it("names each thing the requested scopes actually allow", () => {
    const src = dialog();

    // pages_show_list — listing the user's Pages
    expect(src).toMatch(/administrator for|Pages you administer/);
    // pages_manage_posts + instagram_content_publish — publishing
    expect(src).toMatch(/Publisere innlegg|Publish posts/);
    // pages_read_engagement — reading engagement on the user's own posts
    expect(src).toMatch(/likerklikk og kommentarer|likes and comments/);
  });

  it("says plainly that the reading is limited to the user's OWN posts", () => {
    // The difference between "read engagement" and "read YOUR posts'
    // engagement" is the whole privacy question a user is being asked.
    const src = dialog();
    expect(src).toMatch(/dine egne innlegg/);
    expect(src).toMatch(/your own posts/);
  });

  it("presents Instagram as riding on the Facebook connection", () => {
    // Two separate consent screens would imply two separate logins, which Meta
    // does not offer — and the Instagram-only one could never work.
    const src = dialog();
    expect(src).toContain("Koble til Instagram via Facebook");
    expect(src).toContain("Connect Instagram via Facebook");
    // Both platforms must render the identical permission list.
    const igBlock = src.slice(src.indexOf("instagram: {"), src.indexOf("facebook: {"));
    expect(igBlock).toContain("META_PERMISSIONS_NO");
    expect(igBlock).toContain("META_PERMISSIONS_EN");
  });

  it("covers every scope the server requests, and claims no scope it does not", () => {
    // The load-bearing check: if someone adds a scope server-side, this fails
    // until the consent copy is updated to disclose it.
    const scopes = metaGraph().slice(
      metaGraph().indexOf("export const META_SCOPES"),
      metaGraph().indexOf("].join"),
    );
    const requested = [...scopes.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]).sort();

    expect(requested).toEqual([
      "business_management",
      "instagram_basic",
      "instagram_content_publish",
      "pages_manage_posts",
      "pages_read_engagement",
      "pages_show_list",
    ]);

    // Anything granting message access, ads access, or friend data would need
    // its own line on the consent screen — fail loudly if one appears.
    for (const sensitive of ["messaging", "ads_", "user_friends", "email"]) {
      expect(requested.join(","), `scope containing "${sensitive}" is undisclosed`).not.toContain(sensitive);
    }
  });
});
