/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Facebook and Instagram publishing.
 *
 * Both channels were shipped, advertised in the UI, and incapable of working:
 *
 *  - Facebook received `imageUrl` and never read it, so every post came out as
 *    text while the in-app preview showed the picture.
 *  - Instagram called `graph.instagram.com`, the Basic Display surface, which
 *    cannot publish at all.
 *  - A scheduled post to either sat in `scheduled_posts` forever, because the
 *    worker's query was hardcoded to `platform = 'linkedin'`.
 *
 * These tests assert the REQUESTS that go over the wire, not just that a function
 * returned something — the old code returned success for calls that could not
 * have succeeded.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";

type Call = { url: string; body: Record<string, string> };

let calls: Call[] = [];
let responder: (call: Call) => { status?: number; body: unknown } = () => ({ body: { id: "ok" } });

const originalFetch = globalThis.fetch;

beforeEach(() => {
  calls = [];
  responder = () => ({ body: { id: "ok" } });
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input.url;
    const body: Record<string, string> = {};
    if (typeof init?.body === "string") {
      for (const [k, v] of new URLSearchParams(init.body)) body[k] = v;
    }
    const call = { url, body };
    calls.push(call);
    const { status = 200, body: payload } = responder(call);
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: String(status),
      json: async () => payload,
    } as any;
  }) as any;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("Facebook publishing attaches the image", () => {
  it("posts a photo to /photos instead of a text-only /feed", async () => {
    const { FacebookPublisher } = await import("./services/publishingService");

    responder = () => ({ body: { id: "photo-1", post_id: "page_1_story" } });
    const result = await new FacebookPublisher().publish(
      "PAGE_TOKEN",
      { content: "Hei verden", imageUrl: "https://cdn.example.com/bilde.jpg" },
      "page_1",
    );

    expect(result.success).toBe(true);
    expect(result.imageAttached).toBe(true);
    expect(calls).toHaveLength(1);

    // The endpoint IS the fix. /feed has no parameter that attaches a photo, so
    // a request to /feed with an imageUrl present is the original bug restated.
    expect(calls[0].url).toContain("/page_1/photos");
    expect(calls[0].url).not.toContain("/feed");
    expect(calls[0].body.url).toBe("https://cdn.example.com/bilde.jpg");
    expect(calls[0].body.caption).toContain("Hei verden");

    // `post_id` is the feed story engagement metrics key off; the bare photo
    // `id` would silently exclude every image post from analytics.
    expect(result.postId).toBe("page_1_story");
  });

  it("falls back to the photo id when Graph returns no post_id", async () => {
    const { FacebookPublisher } = await import("./services/publishingService");
    responder = () => ({ body: { id: "photo-only" } });
    const result = await new FacebookPublisher().publish(
      "T",
      { content: "x", imageUrl: "https://cdn.example.com/a.png" },
      "p1",
    );
    expect(result.postId).toBe("photo-only");
  });

  it("uses /feed for a text-only post", async () => {
    const { FacebookPublisher } = await import("./services/publishingService");
    const result = await new FacebookPublisher().publish("T", { content: "Bare tekst" }, "p1");

    expect(result.success).toBe(true);
    expect(calls[0].url).toContain("/p1/feed");
    expect(calls[0].body.message).toBe("Bare tekst");
    // `undefined`, not `false`: there was no image, so there is nothing to
    // report on. `false` is reserved for "there WAS an image and it did not go",
    // which is the signal callers act on.
    expect(result.imageAttached).toBeUndefined();
  });

  it("keeps the link and reports that the image did not go", async () => {
    const { FacebookPublisher } = await import("./services/publishingService");
    const result = await new FacebookPublisher().publish(
      "T",
      { content: "Se her", imageUrl: "https://cdn.example.com/a.png", link: "https://penna.no" },
      "p1",
    );

    // A photo post cannot carry a link. Dropping the link would lose the thing
    // the user was posting for — but the result must not claim the image went.
    expect(calls[0].url).toContain("/feed");
    expect(calls[0].body.link).toBe("https://penna.no");
    expect(result.imageAttached).toBe(false);
  });

  it("ignores a data: URL, which Graph cannot fetch", async () => {
    const { FacebookPublisher } = await import("./services/publishingService");
    await new FacebookPublisher().publish(
      "T",
      { content: "x", imageUrl: "data:image/png;base64,AAAA" },
      "p1",
    );
    // /photos tells Graph to go and download the URL itself. Handing it a data:
    // URI produces a confusing server-side error rather than a post.
    expect(calls[0].url).toContain("/feed");
  });

  it("fails loudly when Graph answers 200 with an error body", async () => {
    const { FacebookPublisher } = await import("./services/publishingService");
    // Graph does this routinely. Checking only `response.ok` — which the old code
    // did — reads `id` out of an error body and reports success for a post that
    // does not exist.
    responder = () => ({ status: 200, body: { error: { message: "Invalid OAuth token", code: 190 } } });

    const result = await new FacebookPublisher().publish("T", { content: "x" }, "p1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid OAuth token");
    // Code 190 is the one failure the user can fix.
    expect(result.error).toMatch(/koble til på nytt/i);
  });
});

describe("Instagram publishing goes through the Graph container flow", () => {
  it("creates a container then publishes it, on graph.facebook.com", async () => {
    const { InstagramPublisher } = await import("./services/publishingService");

    responder = (call) => {
      if (call.url.includes("/media_publish")) return { body: { id: "ig-post" } };
      // Graph downloads image_url asynchronously; publishing before the container
      // reports FINISHED fails with "Media ID is not available".
      if (call.url.includes("status_code")) return { body: { status_code: "FINISHED" } };
      return { body: { id: "container-1" } };
    };

    const result = await new InstagramPublisher().publish(
      "PAGE_TOKEN",
      { content: "Hei", imageUrl: "https://cdn.example.com/a.jpg", hashtags: ["ballonger"] },
      "ig-account-1",
    );

    expect(result.success).toBe(true);
    expect(result.postId).toBe("ig-post");
    // create container -> poll status -> publish
    expect(calls).toHaveLength(3);

    // The host is the whole point. graph.instagram.com is the Basic Display API
    // and cannot publish; publishing lives on graph.facebook.com.
    expect(calls.every((c) => c.url.startsWith("https://graph.facebook.com/"))).toBe(true);
    expect(calls.some((c) => c.url.includes("graph.instagram.com"))).toBe(false);

    expect(calls[0].url).toContain("/ig-account-1/media");
    expect(calls[0].body.image_url).toBe("https://cdn.example.com/a.jpg");
    expect(calls[0].body.caption).toContain("#ballonger");

    const publishCall = calls.find((c) => c.url.includes("/media_publish"))!;
    expect(publishCall.url).toContain("/ig-account-1/media_publish");
    expect(publishCall.body.creation_id).toBe("container-1");
  });

  it("refuses a text-only post with a sentence the user can act on", async () => {
    const { InstagramPublisher } = await import("./services/publishingService");
    const result = await new InstagramPublisher().publish("T", { content: "bare tekst" }, "ig-1");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/bilde/i);
    // And it must not have spent a request finding that out.
    expect(calls).toHaveLength(0);
  });

  it("refuses when no Instagram account is linked", async () => {
    const { InstagramPublisher } = await import("./services/publishingService");
    const result = await new InstagramPublisher().publish("T", {
      content: "x",
      imageUrl: "https://cdn.example.com/a.jpg",
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Instagram/);
    expect(calls).toHaveLength(0);
  });

  it("does not report success when the container step fails", async () => {
    const { InstagramPublisher } = await import("./services/publishingService");
    responder = () => ({ status: 400, body: { error: { message: "Media could not be fetched" } } });

    const result = await new InstagramPublisher().publish(
      "T",
      { content: "x", imageUrl: "https://cdn.example.com/a.jpg" },
      "ig-1",
    );
    expect(result.success).toBe(false);
    // Crucially it must not have gone on to media_publish with an undefined id.
    expect(calls).toHaveLength(1);
  });
});

describe("the scheduler is no longer LinkedIn-only", () => {
  const worker = () => readFileSync("server/schedulerService.ts", "utf8");

  it("selects due rows for every supported platform", () => {
    const src = worker();
    // The single line that made scheduled Facebook posts disappear.
    expect(src).not.toMatch(/eq\(scheduledPosts\.platform,\s*['"]linkedin['"]\)/);
    expect(src).toContain("inArray(scheduledPosts.platform, SUPPORTED_SCHEDULER_PLATFORMS)");
    // Quote style and spacing are the formatter's business, not this test's —
    // pinning them fails a correct file the day someone runs Prettier.
    const list = src.match(/SUPPORTED_SCHEDULER_PLATFORMS\s*=\s*\[([^\]]*)\]/)?.[1] ?? "";
    expect(list).toContain("linkedin");
    expect(list).toContain("facebook");
    expect(list).toContain("instagram");
    expect(list).not.toContain("twitter");
  });

  it("records analytics and the audit row against the post's own platform", () => {
    const src = worker();
    // Both used to be the literal 'linkedin', which would have filed a Facebook
    // post's metrics under LinkedIn the moment the query above was widened.
    expect(src).not.toMatch(/recordPostAnalytics\([^)]*['"]linkedin['"]/);
    expect(src).toContain("await recordPostAnalytics(post.userId, post.id, platform, publishedAt");
    expect(src).not.toMatch(/platform:\s*['"]linkedin['"],\s*\n\s*destination/);
  });

  it("treats a publisher's success:false as a failure", () => {
    // FacebookPublisher and InstagramPublisher report failure by RETURNING
    // {success:false}, not by throwing. A dispatcher that ignored that would mark
    // the row 'published' for a post that never published.
    const src = worker();
    expect(src).toContain("if (!result.success)");
    expect(src).toMatch(/throw new Error\(result\.error/);
  });
});

describe("scheduling refuses what it cannot publish", () => {
  it("does not accept twitter on any mutation that writes a scheduled row", () => {
    const src = readFileSync("server/routers/schedulingRouter.ts", "utf8");

    // Both `schedulePost` and `smartSchedulePost` write the same
    // `scheduled_posts` row, so narrowing only one leaves the black hole open
    // through the other button. Read-only advice procedures (getOptimalTimes)
    // may still accept the wider set — they publish nothing.
    for (const mutation of ["schedulePost:", "smartSchedulePost:"]) {
      const start = src.indexOf(mutation);
      expect(start, `${mutation} not found`).toBeGreaterThan(-1);
      const body = src.slice(start, start + 1200);
      expect(body, mutation).toContain('z.enum(["linkedin", "facebook", "instagram"])');
      expect(body, mutation).not.toMatch(/z\.enum\(\[[^\]]*"twitter"/);
    }
  });

  it("keeps the client and server lists in agreement", async () => {
    // Compare the LISTS, not "does the word appear somewhere in the file".
    // `expect(router).toContain('"linkedin"')` matched getOptimalTimes and would
    // have passed with the schedulable set emptied entirely.
    const listOf = (src: string, pattern: RegExp) => {
      const inner = src.match(pattern)?.[1] ?? "";
      return [...inner.matchAll(/['"]([a-z]+)['"]/g)].map((m) => m[1]).sort();
    };

    const client = listOf(
      readFileSync("client/src/lib/schedulablePlatforms.ts", "utf8"),
      /SCHEDULABLE_PLATFORMS\s*=\s*\[([^\]]*)\]/,
    );
    const worker = listOf(
      readFileSync("server/schedulerService.ts", "utf8"),
      /SUPPORTED_SCHEDULER_PLATFORMS\s*=\s*\[([^\]]*)\]/,
    );
    const routerSrc = readFileSync("server/routers/schedulingRouter.ts", "utf8");
    const router = listOf(
      routerSrc.slice(routerSrc.indexOf("schedulePost:")),
      /z\.enum\(\[([^\]]*)\]\)/,
    );

    expect(client).toEqual(["facebook", "instagram", "linkedin"]);
    expect(worker).toEqual(client);
    expect(router).toEqual(client);
  });
});

describe("the dead Meta code is gone", () => {
  it("no longer ships an orphaned v18 Facebook client", () => {
    // facebookService.ts and multiPlatformService.ts were unreachable from any
    // entry point and spoke a third Graph version. Leaving them invites a future
    // fix to be applied to the wrong file.
    expect(() => readFileSync("server/facebookService.ts", "utf8")).toThrow();
    expect(() => readFileSync("server/services/multiPlatformService.ts", "utf8")).toThrow();
  });

  it("routes every Graph call through one version", async () => {
    const { GRAPH_VERSION } = await import("./services/metaGraph");
    expect(GRAPH_VERSION).toMatch(/^v\d+\.\d+$/);

    for (const file of [
      "server/services/publishingService.ts",
      "server/services/platformOAuthService.ts",
      "server/services/engagementMetricsService.ts",
    ]) {
      const src = readFileSync(file, "utf8");
      // Any Meta host with a version pinned inline — the original assertion only
      // caught graph.facebook.com and would have waved through a hardcoded
      // graph.instagram.com/v19.0.
      expect(src, `${file} hardcodes a Graph version`).not.toMatch(
        /graph\.(facebook|instagram)\.com\/v\d+/,
      );
    }
  });
});
