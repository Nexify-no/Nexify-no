/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * What the scheduler actually sends, per platform.
 *
 * The rest of the Meta work is covered by source-string assertions, which are
 * cheap and brittle in equal measure: an adversarial review replaced the
 * platform branch in `publishScheduledPost` with an unconditional
 * `FacebookPublisher` — sending every scheduled Instagram post to Facebook — and
 * every one of those tests still passed. This file exercises the dispatcher for
 * real and asserts the requests that leave the process, which is the only thing
 * that can catch that class of mistake.
 *
 * It matters more here than anywhere else in the codebase because this code runs
 * unattended: a wrong destination is discovered by a customer, not by a developer.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

type Call = { url: string; body: Record<string, string> };

let calls: Call[] = [];
let responder: (call: Call) => { status?: number; body: unknown } = () => ({ body: { id: "ok" } });

/** Connections the mocked platform manager will hand back, keyed by platform. */
let connections: Record<string, { accessToken: string; accountId: string | null } | null> = {};

vi.mock("./services/platformOAuthService", () => ({
  platformManager: {
    getPlatformConnection: async (_userId: number, platform: string) => connections[platform] ?? null,
  },
}));

// The scheduler decrypts stored tokens before use; the crypto itself is tested
// elsewhere and a real key is not available in the test environment.
vi.mock("./_core/tokenCrypto", () => ({
  encryptSecret: (v: string) => v,
  decryptSecret: (v: string | null) => v,
}));

const originalFetch = globalThis.fetch;

beforeEach(() => {
  calls = [];
  connections = {};
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

describe("publishScheduledPost sends each platform to its own API", () => {
  it("publishes a facebook row as a Page photo", async () => {
    const { publishScheduledPost } = await import("./schedulerService");
    connections.facebook = { accessToken: "PAGE_TOKEN", accountId: "page-123" };
    responder = () => ({ body: { id: "photo", post_id: "page-123_9" } });

    const result = await publishScheduledPost({
      db: {},
      platform: "facebook",
      userId: 1,
      content: "Hei",
      imageUrl: "https://cdn.example.com/a.jpg",
      destination: null,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/page-123/photos");
    expect(result.id).toBe("page-123_9");
    expect(result.imageAttached).toBe(true);
  });

  it("publishes an instagram row through the Instagram container flow", async () => {
    const { publishScheduledPost } = await import("./schedulerService");
    connections.instagram = { accessToken: "PAGE_TOKEN", accountId: "ig-77" };
    responder = (call) => {
      if (call.url.includes("/media_publish")) return { body: { id: "ig-post" } };
      if (call.url.includes("status_code")) return { body: { status_code: "FINISHED" } };
      return { body: { id: "container" } };
    };

    const result = await publishScheduledPost({
      db: {},
      platform: "instagram",
      userId: 1,
      content: "Hei",
      imageUrl: "https://cdn.example.com/a.jpg",
      destination: null,
    });

    // THE assertion the source-string tests could not make: an instagram row must
    // reach Instagram's endpoints, not Facebook's. Swapping the branch to
    // FacebookPublisher passes every readFileSync test in the suite and fails here.
    expect(calls.some((c) => c.url.includes("/ig-77/media"))).toBe(true);
    expect(calls.some((c) => c.url.includes("/ig-77/media_publish"))).toBe(true);
    expect(calls.some((c) => c.url.includes("/photos"))).toBe(false);
    expect(calls.some((c) => c.url.includes("/feed"))).toBe(false);
    expect(result.id).toBe("ig-post");
  });

  it("publishes to the BRAND's destination, not the account-wide page", async () => {
    const { publishScheduledPost } = await import("./schedulerService");
    connections.facebook = { accessToken: "T", accountId: "account-wide-page" };

    await publishScheduledPost({
      db: {},
      platform: "facebook",
      userId: 1,
      content: "Hei",
      imageUrl: null,
      destination: { destinationId: "brand-page", destinationType: "page" },
    });

    // A two-brand account whose worker ignored the destination published one
    // brand's content into the other brand's feed.
    expect(calls[0].url).toContain("/brand-page/feed");
    expect(calls[0].url).not.toContain("account-wide-page");
  });

  it("throws — does not return quietly — when the platform is not connected", async () => {
    const { publishScheduledPost } = await import("./schedulerService");
    await expect(
      publishScheduledPost({
        db: {},
        platform: "facebook",
        userId: 1,
        content: "Hei",
        imageUrl: null,
        destination: null,
      }),
    ).rejects.toThrow(/Facebook/);
    expect(calls).toHaveLength(0);
  });

  it("turns a publisher's success:false into a throw", async () => {
    const { publishScheduledPost } = await import("./schedulerService");
    connections.facebook = { accessToken: "T", accountId: "p1" };
    // Graph's 200-with-an-error-body. The publishers return {success:false}
    // rather than throwing, so a dispatcher that ignored the flag would settle
    // the audit row as 'published' and mark the post published — for a post that
    // does not exist.
    responder = () => ({ status: 200, body: { error: { message: "Permissions error", code: 200 } } });

    await expect(
      publishScheduledPost({
        db: {},
        platform: "facebook",
        userId: 1,
        content: "Hei",
        imageUrl: null,
        destination: null,
      }),
    ).rejects.toThrow(/Permissions error/);
  });

  it("refuses an instagram post with no image, before spending a request", async () => {
    const { publishScheduledPost } = await import("./schedulerService");
    connections.instagram = { accessToken: "T", accountId: "ig-1" };

    await expect(
      publishScheduledPost({
        db: {},
        platform: "instagram",
        userId: 1,
        content: "bare tekst",
        imageUrl: null,
        destination: null,
      }),
    ).rejects.toThrow(/bilde/i);
    expect(calls).toHaveLength(0);
  });
});

describe("Instagram waits for the media container", () => {
  it("polls until FINISHED before publishing", async () => {
    const { publishScheduledPost } = await import("./schedulerService");
    connections.instagram = { accessToken: "T", accountId: "ig-1" };

    let statusChecks = 0;
    responder = (call) => {
      if (call.url.includes("/media_publish")) return { body: { id: "ig-post" } };
      if (call.url.includes("status_code")) {
        statusChecks++;
        return { body: { status_code: statusChecks < 2 ? "IN_PROGRESS" : "FINISHED" } };
      }
      return { body: { id: "container" } };
    };

    const promise = publishScheduledPost({
      db: {},
      platform: "instagram",
      userId: 1,
      content: "Hei",
      imageUrl: "https://cdn.example.com/big.jpg",
      destination: null,
    });
    await vi.waitFor(() => expect(statusChecks).toBeGreaterThanOrEqual(1));
    const result = await promise;

    expect(statusChecks).toBeGreaterThanOrEqual(2);
    expect(result.id).toBe("ig-post");

    // Order matters: media_publish on an unfinished container fails with
    // "Media ID is not available", which in the scheduler becomes a permanent
    // failure for a post that would have worked a second later.
    const publishIndex = calls.findIndex((c) => c.url.includes("/media_publish"));
    const lastStatusIndex = calls.map((c) => c.url.includes("status_code")).lastIndexOf(true);
    expect(lastStatusIndex).toBeLessThan(publishIndex);
  }, 30_000);

  it("fails with the container's own error rather than publishing it", async () => {
    const { publishScheduledPost } = await import("./schedulerService");
    connections.instagram = { accessToken: "T", accountId: "ig-1" };
    responder = (call) =>
      call.url.includes("status_code")
        ? { body: { status_code: "ERROR", status: "Media could not be fetched" } }
        : { body: { id: "container" } };

    await expect(
      publishScheduledPost({
        db: {},
        platform: "instagram",
        userId: 1,
        content: "Hei",
        imageUrl: "https://cdn.example.com/broken.jpg",
        destination: null,
      }),
    ).rejects.toThrow(/kunne ikke hente bildet/i);

    expect(calls.some((c) => c.url.includes("/media_publish"))).toBe(false);
  });
});
