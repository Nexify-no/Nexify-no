/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * Pure calendar helpers (PR #81).
 *
 * These two decisions were inline in Calendar.tsx, where neither could be
 * tested — and both were wrong in a way that cost real posts:
 *
 *  - which posts become draggable events (a published post that stayed draggable
 *    could be re-queued and published to LinkedIn twice);
 *  - how a clicked day becomes a Date (round-tripping "2026-07-30" through UTC
 *    shifted the day for every user west of UTC).
 *
 * Kept free of React and of the tRPC types on purpose, so the rules can be
 * asserted directly.
 */

export type CalendarPostStatus = "draft" | "scheduled" | "published" | "failed";

export interface CalendarPostLike {
  id: number;
  generatedContent: string;
  platform: string;
  status: CalendarPostStatus;
  scheduledFor?: Date | string | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date | string;
  /** Per-event: only a pending post may be dragged to a new date. */
  editable: boolean;
  backgroundColor: string;
  borderColor: string;
  extendedProps: {
    platform: string;
    status: CalendarPostStatus;
    content: string;
  };
}

/** Brand-neutral platform colours (mirrors the legend in Calendar.tsx). */
export function platformColor(platform: string): string {
  switch (platform) {
    case "linkedin": return "#3b82f6";
    case "twitter": return "#38bdf8";
    case "facebook": return "#1d4ed8";
    case "instagram": return "#a855f7";
    default: return "#6b7280";
  }
}

/**
 * The events the calendar should draw.
 *
 * A post appears only when it has a date AND a status that belongs on a
 * calendar. Drafts never do — including one that a cancel just returned to
 * draft, which is why cancel also nulls `scheduledFor`.
 *
 * `editable` is per event rather than global: the publish worker does not clear
 * `scheduledFor`, so a published post keeps its entry forever. With a blanket
 * `editable`, dragging that entry re-queued the post and it went out a second
 * time.
 */
export function calendarEventsFromPosts(posts: readonly CalendarPostLike[] | null | undefined): CalendarEvent[] {
  if (!posts) return [];
  return posts
    .filter((p) => !!p.scheduledFor && (p.status === "scheduled" || p.status === "published"))
    .map((p) => ({
      id: String(p.id),
      title: p.generatedContent.substring(0, 50) + "...",
      start: p.scheduledFor as Date | string,
      editable: p.status === "scheduled",
      backgroundColor: platformColor(p.platform),
      borderColor: platformColor(p.platform),
      extendedProps: {
        platform: p.platform,
        status: p.status,
        content: p.generatedContent,
      },
    }));
}

/**
 * Turn FullCalendar's `dateStr` into a local Date.
 *
 * Month view gives a bare "2026-07-30", which `new Date()` reads as UTC
 * midnight. Everything downstream (`toISOString()` → local `getDate()`) then
 * reported the previous day for any negative-offset zone, so a user in New York
 * clicking 30 July scheduled the post to 29 July. Week and day views include a
 * time and offset and are already unambiguous.
 */
export function dateFromCalendarClick(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(dateStr);
}
