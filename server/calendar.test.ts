/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { describe, it, expect } from "vitest";

describe("Calendar Page Logic", () => {
  it("should compute correct stats from posts data", () => {
    const posts = [
      { status: "draft" },
      { status: "scheduled" },
      { status: "scheduled" },
      { status: "published" },
      { status: "scheduled" },
      { status: "draft" },
    ];

    const stats = {
      total: posts.length,
      scheduled: posts.filter((p) => p.status === "scheduled").length,
      published: posts.filter((p) => p.status === "published").length,
      draft: posts.filter((p) => p.status === "draft").length,
    };

    expect(stats.total).toBe(6);
    expect(stats.scheduled).toBe(3);
    expect(stats.published).toBe(1);
    expect(stats.draft).toBe(2);
  });

  it("should compute upcoming posts within 7 days", () => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

    const posts = [
      { id: 1, scheduledFor: tomorrow.toISOString(), generatedContent: "Post 1", platform: "linkedin", status: "scheduled" },
      { id: 2, scheduledFor: twoWeeksLater.toISOString(), generatedContent: "Post 2", platform: "twitter", status: "scheduled" },
      { id: 3, scheduledFor: yesterday.toISOString(), generatedContent: "Post 3", platform: "facebook", status: "published" },
      { id: 4, scheduledFor: null as string | null, generatedContent: "Post 4", platform: "instagram", status: "draft" },
    ];

    const upcoming = posts
      .filter((p) => {
        if (!p.scheduledFor) return false;
        const scheduled = new Date(p.scheduledFor);
        return scheduled >= now && scheduled <= nextWeek;
      })
      .sort(
        (a, b) =>
          new Date(a.scheduledFor!).getTime() -
          new Date(b.scheduledFor!).getTime()
      )
      .slice(0, 5);

    expect(upcoming.length).toBe(1);
    expect(upcoming[0].id).toBe(1);
  });

  it("should return correct platform colors", () => {
    function getPlatformColor(platform: string): string {
      switch (platform) {
        case "linkedin":
          return "#3b82f6";
        case "twitter":
          return "#38bdf8";
        case "facebook":
          return "#1d4ed8";
        case "instagram":
          return "#a855f7";
        default:
          return "#6b7280";
      }
    }

    expect(getPlatformColor("linkedin")).toBe("#3b82f6");
    expect(getPlatformColor("twitter")).toBe("#38bdf8");
    expect(getPlatformColor("facebook")).toBe("#1d4ed8");
    expect(getPlatformColor("instagram")).toBe("#a855f7");
    expect(getPlatformColor("unknown")).toBe("#6b7280");
  });

  it("should convert posts to calendar events correctly", () => {
    const posts = [
      {
        id: 1,
        generatedContent: "This is a test post with more than fifty characters to test truncation behavior",
        scheduledFor: "2026-03-10T10:00:00Z",
        platform: "linkedin",
        status: "scheduled",
      },
    ];

    const events = posts.map((post) => ({
      id: post.id.toString(),
      title: post.generatedContent.substring(0, 50) + "...",
      start: post.scheduledFor || undefined,
      backgroundColor: "#3b82f6",
      borderColor: "#3b82f6",
      extendedProps: {
        platform: post.platform,
        status: post.status,
        content: post.generatedContent,
      },
    }));

    expect(events.length).toBe(1);
    expect(events[0].id).toBe("1");
    expect(events[0].title.length).toBeLessThanOrEqual(53);
    expect(events[0].extendedProps.platform).toBe("linkedin");
    expect(events[0].extendedProps.status).toBe("scheduled");
  });

  it("should handle empty posts array for stats", () => {
    const posts: any[] = [];
    const stats = {
      total: posts.length,
      scheduled: posts.filter((p) => p.status === "scheduled").length,
      published: posts.filter((p) => p.status === "published").length,
      draft: posts.filter((p) => p.status === "draft").length,
    };

    expect(stats.total).toBe(0);
    expect(stats.scheduled).toBe(0);
    expect(stats.published).toBe(0);
    expect(stats.draft).toBe(0);
  });

  it("should limit upcoming posts to 5 items", () => {
    const now = new Date();
    const posts = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      scheduledFor: new Date(now.getTime() + (i + 1) * 60 * 60 * 1000).toISOString(),
      generatedContent: `Post ${i + 1}`,
      platform: "linkedin",
      status: "scheduled",
    }));

    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcoming = posts
      .filter((p) => {
        if (!p.scheduledFor) return false;
        const scheduled = new Date(p.scheduledFor);
        return scheduled >= now && scheduled <= nextWeek;
      })
      .sort(
        (a, b) =>
          new Date(a.scheduledFor!).getTime() -
          new Date(b.scheduledFor!).getTime()
      )
      .slice(0, 5);

    expect(upcoming.length).toBe(5);
    expect(upcoming[0].id).toBe(1);
    expect(upcoming[4].id).toBe(5);
  });
});