/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";

/**
 * PR #81 — "scheduling doesn't stick".
 *
 * The reported bug: pick a date, pick a draft, confirm — the post shows up, then
 * vanishes on refresh.
 *
 * Root cause: `schedulePost` wrote a `scheduled_posts` row and stopped there,
 * but /kalender renders from the `posts` table via `content.getScheduledPosts`,
 * keyed on `posts.scheduledFor`. The post stayed `status='draft'` with
 * `scheduledFor` NULL, so the entry only ever existed in the client's cache.
 *
 * These tests pin the shape of the write path. The real queries need a live
 * MySQL this suite deliberately does not have, so they fail loudly if the
 * `posts` sync is removed again — which is the only thing that made the calendar
 * agree with the database.
 */

const service = readFileSync("server/services/schedulingService.ts", "utf8");

/** The body of one exported function, up to the next top-level `export`. */
function fn(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`);
  expect(start, `${name} not found`).toBeGreaterThan(-1);
  const next = src.indexOf("\nexport ", start + 1);
  return src.slice(start, next === -1 ? undefined : next);
}

describe("schedulePost writes the state the calendar reads", () => {
  const body = fn(service, "schedulePost");

  it("sets posts.status = scheduled and posts.scheduledFor", () => {
    expect(body).toMatch(/\.update\(posts\)[\s\S]{0,200}status: "scheduled"/);
    expect(body).toMatch(/\.update\(posts\)[\s\S]{0,200}scheduledFor/);
  });

  it("scopes that post update by id AND userId", () => {
    // Without userId in the WHERE, a forgotten check upstream could reschedule
    // another tenant's post.
    expect(body).toMatch(/\.update\(posts\)[\s\S]{0,320}eq\(posts\.id, postId\)[\s\S]{0,80}eq\(posts\.userId, userId\)/);
  });

  it("stamps the schedule row with the post's brand", () => {
    // PR #79 made the calendar brand-scoped; an unowned schedule row is
    // invisible in every brand.
    expect(body).toMatch(/brandId: owned\.brandId/);
  });

  it("updates an existing pending schedule instead of stacking a second row", () => {
    // Two pending rows for one post make the worker publish it twice.
    expect(body).toMatch(/eq\(scheduledPosts\.status, "scheduled"\)/);
    expect(body).toMatch(/if \(existing\)[\s\S]{0,400}\.update\(scheduledPosts\)/);
  });

  it("still refuses a post the caller does not own", () => {
    expect(body).toMatch(/Post not found or unauthorized/);
  });
});

describe("cancel and reschedule keep posts in sync", () => {
  it("cancelScheduledPost returns the post to draft and clears the date", () => {
    const body = fn(service, "cancelScheduledPost");
    expect(body).toMatch(/\.update\(posts\)[\s\S]{0,200}status: "draft"/);
    expect(body).toMatch(/scheduledFor: null/);
  });

  it("reschedulePost moves the date the calendar actually reads", () => {
    const body = fn(service, "reschedulePost");
    expect(body).toMatch(/\.update\(posts\)[\s\S]{0,200}scheduledFor: newScheduledFor/);
  });

  it("both scope their post update by userId", () => {
    for (const name of ["cancelScheduledPost", "reschedulePost"]) {
      expect(fn(service, name)).toMatch(/\.update\(posts\)[\s\S]{0,320}eq\(posts\.userId, userId\)/);
    }
  });
});

describe("nothing can be published twice", () => {
  it("schedulePost refuses to touch a row the worker is already publishing", () => {
    const body = fn(service, "schedulePost");
    expect(body).toMatch(/eq\(scheduledPosts\.status, "publishing"\)/);
    expect(body).toMatch(/if \(inFlight\)[\s\S]{0,200}throw/);
  });

  it("the pending-row lookup is keyed by platform, so a second platform adds a row", () => {
    // Without platform in the key, scheduling to a second platform rewrote the
    // first row and that platform's publish was silently dropped.
    const body = fn(service, "schedulePost");
    expect(body).toMatch(/eq\(scheduledPosts\.platform, platform\)/);
  });

  it("cancel and reschedule only act on a row that is still pending", () => {
    for (const name of ["cancelScheduledPost", "reschedulePost"]) {
      const body = fn(service, name);
      // Guard on the lookup, on the scheduled_posts write, and on the posts write.
      expect((body.match(/eq\(scheduledPosts\.status, "scheduled"\)/g) ?? []).length,
        `${name} must guard both the lookup and the update`).toBeGreaterThanOrEqual(2);
      expect(body).toMatch(/eq\(posts\.status, "scheduled"\)/);
      expect(body).toMatch(/if \(!row\) throw/);
    }
  });

  it("dragging a published post is refused server-side", () => {
    // Nothing clears posts.scheduledFor on publish, so a published post keeps a
    // calendar entry; rescheduling it re-queued the identical post.
    const router = readFileSync("server/routers/contentRouter.ts", "utf8");
    expect(router).toMatch(/post\.status !== "draft" && post\.status !== "scheduled"[\s\S]{0,200}throw/);
  });

  it("deleting a post cancels its pending schedule first", () => {
    // Otherwise the worker claims an orphan, fails, and blames the user's
    // LinkedIn connection for a post they deleted on purpose.
    const dbSrc = readFileSync("server/db.ts", "utf8");
    const del = dbSrc.slice(dbSrc.indexOf("export async function deletePost("));
    const body = del.slice(0, del.indexOf("\nexport "));
    expect(body).toMatch(/\.update\(scheduledPosts\)[\s\S]{0,220}status: "cancelled"/);
    expect(body.indexOf("update(scheduledPosts)")).toBeLessThan(body.indexOf("delete(posts)"));
  });

  it("the calendar decides draggability per event, not globally", () => {
    const helpers = readFileSync("client/src/lib/calendarEvents.ts", "utf8");
    expect(helpers).toMatch(/editable: p\.status === "scheduled"/);
  });
});

describe("one handoff channel, not two", () => {
  it("no page writes the dead prefilledScheduleDate key", () => {
    // It was written by the calendar and read by nobody — the generator only
    // ever looked at editorHandoff — so a clicked date was silently lost.
    for (const path of [
      "client/src/components/PostCreationDialog.tsx",
      "client/src/pages/Calendar.tsx",
      "client/src/pages/Generate.tsx",
    ]) {
      expect(readFileSync(path, "utf8")).not.toMatch(/sessionStorage\.(set|get)Item\(\s*["']prefilledScheduleDate/);
    }
  });

  it("the calendar hands the date over via editorHandoff", () => {
    const src = readFileSync("client/src/components/PostCreationDialog.tsx", "utf8");
    expect(src).toContain("setEditorHandoff");
    expect(src).toMatch(/scheduledAt: selectedDate\.toISOString\(\)/);
  });
});

describe("the real calendar route is the only one", () => {
  it("/kalender-old is gone from the router", () => {
    const app = readFileSync("client/src/App.tsx", "utf8");
    expect(app).not.toContain("kalender-old");
    expect(app).not.toContain("ContentCalendar");
    expect(app).toContain('path={"/kalender"} component={Calendar}');
  });

  it("nothing links to the removed route", () => {
    expect(readFileSync("client/src/pages/Calendar.tsx", "utf8")).not.toContain("kalender-old");
  });
});

describe("date click offers both routes", () => {
  const dialog = readFileSync("client/src/components/PostCreationDialog.tsx", "utf8");

  it("shows Lag nytt innlegg and Velg et eksisterende utkast", () => {
    expect(dialog).toContain("Lag nytt innlegg");
    expect(dialog).toContain("Velg et eksisterende utkast");
  });

  it("the calendar wires the draft path through to ScheduleDialog", () => {
    const cal = readFileSync("client/src/pages/Calendar.tsx", "utf8");
    expect(cal).toContain("PickDraftDialog");
    expect(cal).toContain("ScheduleDialog");
    // Refetch on success is what makes the entry appear without a reload.
    expect(cal).toMatch(/onScheduled=\{\(\) => \{[^}]*refetch\(\)/);
  });

  it("the draft picker offers only drafts", () => {
    const pick = readFileSync("client/src/components/PickDraftDialog.tsx", "utf8");
    expect(pick).toMatch(/status === "draft"/);
  });
});

describe("Planlegg is reachable from Mine innlegg", () => {
  const posts = readFileSync("client/src/pages/Posts.tsx", "utf8");

  it("renders a schedule action on drafts", () => {
    expect(posts).toContain("ScheduleDialog");
    expect(posts).toMatch(/post\.status === "draft" && \(/);
  });

  it("passes the real postId through", () => {
    expect(posts).toMatch(/postId=\{schedulePost\?\.id \?\? null\}/);
  });
});

describe("ScheduleDialog shows what it is about to do", () => {
  const src = readFileSync("client/src/components/ScheduleDialog.tsx", "utf8");

  it("names date, time, timezone, brand, platform and destination", () => {
    for (const label of ["Dato", "Klokkeslett", "Tidssone", "Merkevare", "Plattform", "Publiseres som"]) {
      expect(src).toContain(label);
    }
  });

  it("resets BOTH date and time each time it opens", () => {
    // The component stays mounted between openings, so useState's initial values
    // are read once. On /innlegg there is no defaultDate at all, so an early
    // return on a missing one left the previous draft's date and time in place —
    // one click put draft B on draft A's date.
    const effect = src.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[open, defaultDate\]\);/);
    expect(effect, "open/defaultDate effect not found").not.toBeNull();
    expect(effect![0]).toContain("setDate(");
    expect(effect![0]).toContain('setTime("09:00")');
    // Must NOT bail out when defaultDate is absent — that is the /innlegg case.
    expect(effect![0]).not.toMatch(/if \(!open \|\| !defaultDate\) return/);
  });

  it("refuses a time in the past and an unsaved post", () => {
    expect(src).toMatch(/when\.getTime\(\) > Date\.now\(\)/);
    expect(src).toMatch(/postId != null/);
  });
});
