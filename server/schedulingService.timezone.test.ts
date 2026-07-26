/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

import { describe, expect, it } from "vitest";
import { localPartsInZone } from "./services/schedulingService";

/**
 * PR #81 — the optimality score was computed in the SERVER's timezone.
 *
 * `schedulePost` used `scheduledFor.getHours()` / `.getDay()`, which resolve in
 * the process's local zone. An Oslo user picking 09:00 — LinkedIn's top slot —
 * was read as 07:00 on a UTC server, matched no optimal time, and silently got
 * the fallback score of 50. The `timezone` column was stored and never read.
 *
 * Real assertions against real instants, independent of the host's TZ.
 */

// 2026-08-03 is a Monday. 07:00Z = 09:00 in Oslo (CEST, UTC+2).
const MONDAY_0700Z = new Date("2026-08-03T07:00:00.000Z");

describe("localPartsInZone", () => {
  it("reads the user's wall-clock hour, not the server's", () => {
    expect(localPartsInZone(MONDAY_0700Z, "Europe/Oslo")).toEqual({ hour: 9, dayOfWeek: 1 });
    expect(localPartsInZone(MONDAY_0700Z, "UTC")).toEqual({ hour: 7, dayOfWeek: 1 });
  });

  it("crosses the date line backwards correctly", () => {
    // Monday 07:00Z is still Sunday 03:00 in New York (EDT, UTC-4).
    expect(localPartsInZone(MONDAY_0700Z, "America/New_York")).toEqual({ hour: 3, dayOfWeek: 1 });
    // Monday 02:00Z is Sunday 22:00 in New York — a different weekday.
    expect(localPartsInZone(new Date("2026-08-03T02:00:00.000Z"), "America/New_York"))
      .toEqual({ hour: 22, dayOfWeek: 0 });
  });

  it("crosses the date line forwards correctly", () => {
    // Sunday 23:00Z is Monday 08:00 in Tokyo (UTC+9).
    expect(localPartsInZone(new Date("2026-08-02T23:00:00.000Z"), "Asia/Tokyo"))
      .toEqual({ hour: 8, dayOfWeek: 1 });
  });

  it("reports midnight as hour 0, never 24", () => {
    // Some ICU builds render hour12:false midnight as "24"; a 24 would match no
    // optimal slot and silently downgrade the score.
    expect(localPartsInZone(new Date("2026-08-03T00:00:00.000Z"), "UTC").hour).toBe(0);
    expect(localPartsInZone(new Date("2026-08-02T22:00:00.000Z"), "Europe/Oslo").hour).toBe(0);
  });

  it("honours daylight saving on both sides of the switch", () => {
    // Oslo is UTC+1 in January, UTC+2 in July — a fixed offset would break one.
    expect(localPartsInZone(new Date("2026-01-05T08:00:00.000Z"), "Europe/Oslo").hour).toBe(9);
    expect(localPartsInZone(new Date("2026-07-06T07:00:00.000Z"), "Europe/Oslo").hour).toBe(9);
  });

  it("covers every weekday index", () => {
    // 2026-08-02 is a Sunday; walk a full week at midday UTC.
    const days = Array.from({ length: 7 }, (_, i) =>
      localPartsInZone(new Date(`2026-08-0${2 + i}T12:00:00.000Z`), "UTC").dayOfWeek,
    );
    expect(days).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("falls back to server-local values for an unusable zone", () => {
    const when = new Date("2026-08-03T07:00:00.000Z");
    expect(localPartsInZone(when, "Not/AZone")).toEqual({
      hour: when.getHours(),
      dayOfWeek: when.getDay(),
    });
  });
});
