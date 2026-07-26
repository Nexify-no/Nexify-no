/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

import { describe, expect, it } from "vitest";
import {
  calendarEventsFromPosts,
  dateFromCalendarClick,
  type CalendarPostLike,
} from "./calendarEvents";

/**
 * PR #81 — the two calendar rules that cost real posts when they were wrong.
 * These run the real functions; they are not source-text guards.
 */

const post = (over: Partial<CalendarPostLike>): CalendarPostLike => ({
  id: 1,
  generatedContent: "Hei verden",
  platform: "linkedin",
  status: "scheduled",
  scheduledFor: new Date("2026-08-03T07:00:00.000Z"),
  ...over,
});

describe("calendarEventsFromPosts", () => {
  it("draws scheduled and published posts", () => {
    const events = calendarEventsFromPosts([
      post({ id: 1, status: "scheduled" }),
      post({ id: 2, status: "published" }),
    ]);
    expect(events.map((e) => e.id)).toEqual(["1", "2"]);
  });

  it("makes a published post NON-draggable", () => {
    // The worker never clears posts.scheduledFor, so a published post keeps its
    // calendar entry. Dragging it re-queued the post and it went out twice.
    const [scheduled, published] = calendarEventsFromPosts([
      post({ id: 1, status: "scheduled" }),
      post({ id: 2, status: "published" }),
    ]);
    expect(scheduled.editable).toBe(true);
    expect(published.editable).toBe(false);
  });

  it("hides a draft even if it still carries a date", () => {
    expect(calendarEventsFromPosts([post({ status: "draft" })])).toEqual([]);
  });

  it("hides a cancelled post, which cancel returns to draft with a null date", () => {
    expect(calendarEventsFromPosts([post({ status: "draft", scheduledFor: null })])).toEqual([]);
  });

  it("hides a failed post rather than offering it for a drag", () => {
    expect(calendarEventsFromPosts([post({ status: "failed" })])).toEqual([]);
  });

  it("hides a scheduled post with no date at all", () => {
    expect(calendarEventsFromPosts([post({ scheduledFor: null })])).toEqual([]);
  });

  it("survives null and empty input", () => {
    expect(calendarEventsFromPosts(null)).toEqual([]);
    expect(calendarEventsFromPosts(undefined)).toEqual([]);
    expect(calendarEventsFromPosts([])).toEqual([]);
  });

  it("carries platform and status through for the event UI", () => {
    const [e] = calendarEventsFromPosts([post({ platform: "instagram" })]);
    expect(e.extendedProps).toMatchObject({ platform: "instagram", status: "scheduled" });
    expect(e.backgroundColor).toBe("#a855f7");
  });
});

describe("dateFromCalendarClick", () => {
  it("reads a bare month-view date as LOCAL midnight, not UTC", () => {
    // The bug: new Date("2026-07-30") is UTC midnight, so a user at UTC-4 saw
    // 29 July pre-filled and scheduled the post a day early.
    const d = dateFromCalendarClick("2026-07-30");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // July
    expect(d.getDate()).toBe(30);
    expect(d.getHours()).toBe(0);
  });

  it("round-trips through toISOString and back to the SAME local day", () => {
    // This is the exact path: calendar click -> toISOString -> ScheduleDialog's
    // local getters. It must land on the day the user clicked, in any zone.
    for (const iso of ["2026-01-01", "2026-07-30", "2026-12-31"]) {
      const clicked = dateFromCalendarClick(iso);
      const reparsed = new Date(clicked.toISOString());
      expect(
        `${reparsed.getFullYear()}-${String(reparsed.getMonth() + 1).padStart(2, "0")}-${String(reparsed.getDate()).padStart(2, "0")}`,
      ).toBe(iso);
    }
  });

  it("passes through week/day-view strings that already carry a time", () => {
    const d = dateFromCalendarClick("2026-07-30T14:30:00+02:00");
    expect(d.toISOString()).toBe("2026-07-30T12:30:00.000Z");
  });
});
