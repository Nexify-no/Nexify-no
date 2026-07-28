/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * What one authenticated HTTP request costs the database — the query half.
 *
 *  - The plan-limit middleware used to pull every post row of the current month
 *    back from the server in order to call `.length` on the array.
 *  - The connection pool must not enable mysql2's idle reaper: on a database
 *    billed per connection, reaping warm connections means paying for the TLS
 *    handshake to re-open them.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { SQL, is } from "drizzle-orm";

afterEach(() => {
  // In the test BODY these unmocks would be skipped by any assertion that
  // throws, and a leaked mock then surfaces in an unrelated test as a
  // baffling "No export is defined on the mock" error.
  vi.doUnmock("./db");
  vi.doUnmock("mysql2");
  vi.doUnmock("drizzle-orm/mysql2");
  vi.resetModules();
});

/** Stand-in for drizzle's query builder that records the projection it was given. */
function fakeDbReturning(rows: unknown[], projections: unknown[]) {
  return {
    select(fields?: unknown) {
      projections.push(fields);
      return { from: () => ({ where: async () => rows }) };
    },
  };
}

describe("plan-limit middleware counts posts instead of fetching them", () => {
  it("asks the database for COUNT(*), not for the rows", async () => {
    const projections: unknown[] = [];

    vi.doMock("./db", () => ({
      getDb: async () => fakeDbReturning([{ n: 3 }], projections),
      getUserSubscription: async () => ({ planId: "trial" }),
    }));
    vi.resetModules();

    const { checkPlanLimit } = await import("./_core/rateLimiter");
    const req: any = { user: { id: 42 }, subscription: { planId: "trial" } };
    let nexted = false;
    await checkPlanLimit(req, {} as any, () => {
      nexted = true;
    });

    expect(nexted).toBe(true);
    expect(projections).toHaveLength(1);

    // Assert on the EXPRESSION, not on the shape of the projection object.
    // Checking only that a projection was passed is vacuous: `select({n: posts.id})`
    // would satisfy it while still dragging one wide row per post over the wire —
    // and would silently make `used` equal to a post id.
    const n = (projections[0] as any)?.n;
    expect(is(n, SQL)).toBe(true);
    expect(JSON.stringify((n as any).queryChunks)).toContain("count(");

    // And the number has to survive the round trip: trial allows 5/month.
    expect(req.planLimit.used).toBe(3);
    expect(req.planLimit.remaining).toBe(2);
    expect(req.planLimit.exceeded).toBe(false);
  });

  it("marks the plan exceeded when the count reaches the limit", async () => {
    vi.doMock("./db", () => ({
      getDb: async () => fakeDbReturning([{ n: 5 }], []),
      getUserSubscription: async () => ({ planId: "trial" }),
    }));
    vi.resetModules();

    const { checkPlanLimit } = await import("./_core/rateLimiter");
    const req: any = { user: { id: 42 }, subscription: { planId: "trial" } };
    await checkPlanLimit(req, {} as any, () => {});

    expect(req.planLimit.used).toBe(5);
    expect(req.planLimit.remaining).toBe(0);
    expect(req.planLimit.exceeded).toBe(true);
  });
});

describe("connection pool does not churn against a metered database", () => {
  it("keeps mysql2's idle reaper off and probes keep-alive early", async () => {
    const poolOptions: any[] = [];

    vi.doMock("mysql2", () => ({
      createPool: (options: unknown) => {
        poolOptions.push(options);
        return { fake: "pool" };
      },
    }));
    vi.doMock("drizzle-orm/mysql2", () => ({
      drizzle: (client: unknown) => ({ client }),
    }));
    vi.resetModules();

    const previousUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "mysql://u:p@example.tidbcloud.com:4000/nexify";
    try {
      const { getDb } = await import("./db");
      await getDb();
    } finally {
      if (previousUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousUrl;
    }

    expect(poolOptions).toHaveLength(1);
    const options = poolOptions[0];

    // The URL still carries everything it carried before — TLS included.
    expect(options.uri).toContain("tidbcloud.com");

    // mysql2 only creates its idle-reaper timer when maxIdle < connectionLimit.
    // Setting maxIdle below the limit therefore switches ON connection reaping
    // that was previously never running — the exact opposite of the goal here.
    const maxIdle = options.maxIdle ?? options.connectionLimit;
    expect(maxIdle).toBeGreaterThanOrEqual(options.connectionLimit);

    // The one option worth setting: without it the OS decides, and its default
    // first probe is ~2 hours — long after a serverless gateway has dropped the
    // socket.
    expect(options.keepAliveInitialDelay).toBeGreaterThan(0);
    expect(options.keepAliveInitialDelay).toBeLessThanOrEqual(60_000);
  });
});
