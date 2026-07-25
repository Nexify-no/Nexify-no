import { describe, it, expect, beforeEach } from "vitest";
import { setEditorHandoff, takeEditorHandoff } from "./editorHandoff";

describe("editorHandoff (calendar date must survive the trip to the generator)", () => {
  beforeEach(() => { takeEditorHandoff(); }); // drain anything pending

  it("carries a picked date from the calendar to the editor", () => {
    const when = "2026-09-14T09:00:00.000Z";
    setEditorHandoff({ scheduledAt: when, source: "calendar" });
    const got = takeEditorHandoff();
    expect(got?.scheduledAt).toBe(when);
    expect(got?.source).toBe("calendar");
  });

  it("is consumed exactly once, so a reload cannot re-apply a stale date", () => {
    setEditorHandoff({ scheduledAt: "2026-09-14T09:00:00.000Z" });
    expect(takeEditorHandoff()).not.toBeNull();
    expect(takeEditorHandoff()).toBeNull();
  });

  it("keeps topic/content/platform alongside the date", () => {
    setEditorHandoff({ topic: "Ny ballongpakke", platform: "linkedin", scheduledAt: "2026-10-01T08:00:00.000Z" });
    const got = takeEditorHandoff();
    expect(got?.topic).toBe("Ny ballongpakke");
    expect(got?.platform).toBe("linkedin");
    expect(got?.scheduledAt).toBe("2026-10-01T08:00:00.000Z");
  });

  it("returns null when nothing was handed off (no accidental scheduling)", () => {
    expect(takeEditorHandoff()).toBeNull();
  });
});
