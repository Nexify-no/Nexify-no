/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * content.getActivityData — the 7-day bar chart on the dashboard.
 *
 * Two things were wrong with the previous version of this file and both hid the
 * same class of problem:
 *
 *  1. The db mock was built once at module scope with `vi.fn().mockReturnThis()`.
 *     The suite runs with `mockReset: true` (vitest.config.ts), which strips
 *     implementations from every spy before EVERY test — so `getDb()` resolved to
 *     undefined and the procedure threw "Database not available". Re-applying the
 *     implementations in `beforeAll` could not help: the reset happens per test.
 *  2. Every assertion sat inside `try { … } catch (e) { expect(e).toBeUndefined() }`
 *     and behind `if (data.length > 0)`, so a throw became the misleading
 *     "expected [Error] to be undefined" and an empty result asserted nothing.
 *
 * The procedure's real contract is worth pinning, so this version asserts it:
 * exactly 7 buckets, oldest first, Norwegian day abbreviations, one per calendar
 * date in the window — and counts that follow the rows, not the mock.
 */

import { describe, it, expect, afterAll, beforeEach, vi } from "vitest";
import { queryOf } from "./testing/fakeDb";

const DAY_NAMES = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];

/**
 * Rows the mocked `.where()` resolves to. `createdAt` is a `Date`, matching the
 * drizzle `timestamp` column: the procedure does `new Date(post.createdAt)`, and
 * feeding it epoch numbers would exercise a path production never takes.
 */
let rows: Array<{ createdAt: Date }> = [];
/** The condition the procedure passed to `.where()`, so the window is assertable. */
let capturedWhere: unknown = null;

/**
 * Plain functions, not spies: `mockReset: true` would strip a spy's
 * implementation before each test. The chain only needs to be thenable at the
 * end — `select().from().where()` is awaited directly.
 *
 * The real module is spread in because `caller()` pulls in the whole router
 * graph, and other routers import named db helpers eagerly.
 */
vi.mock("./db", async (importOriginal) => {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.from = () => chain;
  chain.where = async (cond: unknown) => {
    capturedWhere = cond;
    return rows;
  };
  return { ...(await importOriginal<typeof import("./db")>()), getDb: async () => chain };
});

// A fixed instant, so "today" cannot change mid-file and a run that straddles
// local midnight cannot fail. Deliberately a Wednesday, mid-month, mid-afternoon.
const NOW = new Date(2026, 6, 15, 15, 30, 0);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  rows = [];
  capturedWhere = null;
});

afterAll(() => {
  vi.useRealTimers();
});

const ctx = (userId: number) =>
  ({
    user: {
      id: userId,
      openId: `open-${userId}`,
      name: "Test User",
      email: "test@example.com",
      role: "user",
      loginMethod: null,
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      passwordHash: null,
      emailVerified: null,
      twoFactorSecret: null,
      twoFactorEnabled: 0,
      twoFactorBackupCodes: null,
      activeBrandId: null,
      tokenVersion: 0,
    },
    req: {} as never,
    res: {} as never,
  }) as never;

async function getActivity(userId = 999999) {
  const { appRouter } = await import("./routers");
  return appRouter.createCaller(ctx(userId)).content.getActivityData();
}

/** Midday on the day `daysAgo` days before the frozen "today", in local time. */
function daysAgoAtNoon(daysAgo: number): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(12, 0, 0, 0);
  return d;
}

describe("content.getActivityData", () => {
  it("returns exactly seven buckets, oldest first, labelled with Norwegian day names", async () => {
    rows = [];
    const data = await getActivity();

    expect(data).toHaveLength(7);
    for (const d of data) {
      expect(typeof d.day).toBe("string");
      expect(DAY_NAMES).toContain(d.day);
      expect(typeof d.posts).toBe("number");
    }

    // Oldest first. NOW is Wednesday 15 July 2026, so the window is Thu → Wed.
    expect(data.map((d) => d.day)).toEqual(["Tor", "Fre", "Lør", "Søn", "Man", "Tir", "Ons"]);
  });

  it("asks the database only for the caller's posts inside the window", async () => {
    await getActivity(4242);

    const { sql, params } = queryOf(capturedWhere);
    expect(sql).toContain("user_id");
    expect(sql).toContain("created_at");
    expect(params).toContain(4242);

    // The window must be bound so MySQL can read it: drizzle maps a Date column
    // comparison to a 'YYYY-MM-DD HH:MM:SS.mmm' literal. The previous version
    // pushed `windowStart.getTime()` through raw SQL — a 13-digit integer against
    // a `timestamp` column, which MySQL cannot read as a datetime, so the filter
    // never actually limited anything and the JS-side bucket guard was the only
    // thing keeping the chart to seven days.
    // NOW is 15 July 2026, so the window opens at local midnight on the 9th.
    expect(params).toContain("2026-07-09 00:00:00.000");
    expect(params.every((p) => typeof p !== "number" || p === 4242)).toBe(true);
  });

  it("reports zero for every day when the user has no posts", async () => {
    rows = [];
    const data = await getActivity();
    expect(data.every((d) => d.posts === 0)).toBe(true);
  });

  it("counts posts into the day they were created on", async () => {
    rows = [
      { createdAt: daysAgoAtNoon(0) },
      { createdAt: daysAgoAtNoon(0) },
      { createdAt: daysAgoAtNoon(3) },
    ];
    const data = await getActivity();

    expect(data[6].posts).toBe(2); // today
    expect(data[3].posts).toBe(1); // three days back
    expect(data.reduce((n, d) => n + d.posts, 0)).toBe(3);
  });

  it("does not credit a post from a week ago to today", async () => {
    // The regression this rewrite exists for: buckets used to be keyed by
    // weekday NAME while the query window started at now-7d. Seven days back is
    // the same weekday as today, so last week's post landed in today's bar.
    rows = [{ createdAt: daysAgoAtNoon(7) }];
    const data = await getActivity();

    expect(data.reduce((n, d) => n + d.posts, 0)).toBe(0);
    expect(data[6].posts).toBe(0);
  });

  it("never returns an eighth bucket, whatever the rows say", async () => {
    rows = [{ createdAt: daysAgoAtNoon(400) }, { createdAt: daysAgoAtNoon(0) }];
    const data = await getActivity();
    expect(data).toHaveLength(7);
    expect(data[6].posts).toBe(1);
  });
});
