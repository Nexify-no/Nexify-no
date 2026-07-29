/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * A channel is offered to customers exactly when this installation can connect it.
 *
 * The settings screen used to render every card the same way whether or not the
 * app behind it existed, so an unconfigured channel looked live until the user
 * clicked and got an error. The opposite mistake was in the same file earlier:
 * three cards hardcoded to "(kommer snart)", which stayed grey after the
 * integration actually shipped.
 *
 * Deriving it from the config means neither can happen again — the card and the
 * API turn on together.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";

// The REAL function the router serves — not a copy. A local re-implementation
// passed every assertion here while the router returned something else.
import { getPlatformAvailability as availability } from "./services/platformAvailability";

const KEYS = [
  "X_CLIENT_ID",
  "X_CLIENT_SECRET",
  "TWITTER_CLIENT_ID",
  "TWITTER_CLIENT_SECRET",
  "FACEBOOK_CLIENT_ID",
  "FACEBOOK_CLIENT_SECRET",
  "LINKEDIN_CLIENT_ID",
  "LINKEDIN_CLIENT_SECRET",
];

describe("platform availability", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("reports every channel unavailable when nothing is configured", () => {
    expect(availability()).toEqual({
      linkedin: false,
      facebook: false,
      instagram: false,
      twitter: false,
    });
  });

  it("opens X the moment its credentials are set, with no code change", () => {
    expect(availability().twitter).toBe(false);
    process.env.X_CLIENT_ID = "id";
    process.env.X_CLIENT_SECRET = "secret";
    expect(availability().twitter).toBe(true);
  });

  it("keeps X closed when only half the credentials are present", () => {
    // A half-configured channel is a channel that fails at the token exchange —
    // after the user has already been sent to X and granted access.
    process.env.X_CLIENT_ID = "id";
    expect(availability().twitter).toBe(false);
  });

  it("ties Instagram to Facebook, because Meta does", () => {
    process.env.FACEBOOK_CLIENT_ID = "id";
    process.env.FACEBOOK_CLIENT_SECRET = "secret";
    const a = availability();
    expect(a.facebook).toBe(true);
    expect(a.instagram).toBe(true);
  });

  it("leaves the other channels alone when one is configured", () => {
    process.env.X_CLIENT_ID = "id";
    process.env.X_CLIENT_SECRET = "secret";
    const a = availability();
    expect(a.facebook).toBe(false);
    expect(a.linkedin).toBe(false);
  });
});

describe("the router serves this exact function", () => {
  it("does not re-implement availability inline", () => {
    // A second copy in the router is a copy that drifts.
    const router = readFileSync("server/routers/platformRouter.ts", "utf8");
    expect(router).toContain('import("../services/platformAvailability")');
    expect(router).not.toMatch(/instagram:\s*meta/);
  });
});

describe("the settings screen uses it", () => {
  const component = () =>
    readFileSync("client/src/components/settings/PlatformIntegrations.tsx", "utf8");

  it("asks the server which channels are available", () => {
    expect(component()).toContain("getPlatformAvailability");
  });

  it("disables the connect button for an unavailable channel", () => {
    // Without this the card only LOOKS unavailable and the click still fires.
    expect(component()).toMatch(/disabled=\{connecting === platform\.id \|\| !isAvailable\}/);
  });

  it("labels the BUTTON itself, not just a badge somewhere on the card", () => {
    // Asserting the string appears anywhere in the file passed even with the
    // button reading "Koble til", because the badge also says it.
    expect(component()).toMatch(/\{!isAvailable\s*\n?\s*\?\s*"Kommer snart"/);
  });

  it("marks the card with a Kommer snart badge", () => {
    expect(component()).toMatch(/<Badge variant="outline">Kommer snart<\/Badge>/);
  });

  it("has no hardcoded coming-soon card left", () => {
    // The previous version of this screen hardcoded "(kommer snart)" per
    // platform, which is why Facebook stayed grey for weeks after it worked.
    const src = component();
    expect(src).not.toMatch(/kommer snart\)/i);
    expect(src).not.toMatch(/id:\s*"twitter"[^}]*comingSoon/);
  });

  it("treats availability as true while the query is still loading", () => {
    // Defaulting to false would flash "Kommer snart" on every page load for a
    // channel that works.
    expect(component()).toMatch(/availability\?\.\[[^\]]+\]\s*\?\?\s*true/);
  });
});
