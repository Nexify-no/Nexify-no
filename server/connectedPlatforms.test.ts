/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * "Which platforms are connected" must answer for BOTH stores.
 *
 * LinkedIn is connected through its own flow and lives in `linkedin_connections`;
 * Meta and X live in `platform_integrations`. `getPlatformToken` already bridged
 * the two — `getUserPlatforms` did not, so the settings screen showed "Koble til
 * LinkedIn" to users whose LinkedIn was connected and publishing, and clicking it
 * sent them through a full OAuth round trip to reach the state they were in.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const rows: { platformIntegrations: any[]; linkedinConnections: any[] } = {
  platformIntegrations: [],
  linkedinConnections: [],
};
let linkedinReadThrows = false;

/**
 * Minimal drizzle stand-in. `select().from(t)` decides which set to answer with
 * by identity of the table object, which is what the real query does.
 */
vi.mock("./db", async () => {
  const schema = await vi.importActual<any>("../drizzle/schema");
  return {
    getDb: async () => ({
      select: (_fields?: unknown) => ({
        from: (table: unknown) => {
          const isLinkedIn = table === schema.linkedinConnections;
          if (isLinkedIn && linkedinReadThrows) {
            return {
              where: () => ({
                limit: async () => {
                  throw new Error("table missing");
                },
              }),
            };
          }
          const data = isLinkedIn ? rows.linkedinConnections : rows.platformIntegrations;
          // `where(...)` is awaited directly on one path and chained with
          // `.limit()` on the other, so it has to be both a promise and a builder.
          return {
            where: () => {
              const result: any = Promise.resolve(data);
              result.limit = async () => data;
              result.orderBy = () => ({ limit: async () => data });
              return result;
            },
          };
        },
      }),
    }),
  };
});

const { platformManager } = await import("./services/platformOAuthService");

beforeEach(() => {
  rows.platformIntegrations = [];
  rows.linkedinConnections = [];
  linkedinReadThrows = false;
});

describe("connected platforms span both stores", () => {
  it("reports LinkedIn when only linkedin_connections has a row", async () => {
    // The exact production state in the screenshot: Facebook and Instagram
    // connected, LinkedIn connected through its own flow — and the card offering
    // to connect LinkedIn.
    rows.platformIntegrations = [{ platform: "facebook" }, { platform: "instagram" }];
    rows.linkedinConnections = [{ id: 1 }];

    const platforms = await platformManager.getUserPlatforms(1);
    expect(platforms).toContain("linkedin");
    expect(platforms).toEqual(expect.arrayContaining(["facebook", "instagram", "linkedin"]));
  });

  it("does not report LinkedIn when neither store has it", async () => {
    rows.platformIntegrations = [{ platform: "facebook" }];
    expect(await platformManager.getUserPlatforms(1)).toEqual(["facebook"]);
  });

  it("does not list LinkedIn twice when both stores have it", async () => {
    rows.platformIntegrations = [{ platform: "linkedin" }];
    rows.linkedinConnections = [{ id: 1 }];
    const platforms = await platformManager.getUserPlatforms(1);
    expect(platforms.filter((p) => p === "linkedin")).toHaveLength(1);
  });

  it("still returns the other platforms when the LinkedIn read fails", async () => {
    // A broken LinkedIn lookup must not blank the whole settings screen.
    rows.platformIntegrations = [{ platform: "facebook" }];
    linkedinReadThrows = true;
    expect(await platformManager.getUserPlatforms(1)).toEqual(["facebook"]);
  });

  it("reports nothing when nothing is connected", async () => {
    expect(await platformManager.getUserPlatforms(1)).toEqual([]);
  });
});
