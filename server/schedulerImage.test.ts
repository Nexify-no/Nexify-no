/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * A scheduled LinkedIn post went out without its image.
 *
 * Not because the image was missing or unfinished — the row had
 * `image_status = 'completed'` and a working R2 URL. The worker simply called
 *
 *     createLinkedInPost(token, personUrn, content, authorOverride)
 *
 * and stopped there. `imageUrl` is that function's optional fifth parameter, so
 * omitting it is legal TypeScript, raises no warning, and produces a text post.
 * The two other publish paths — the interactive one in `linkedinRouter` and
 * `publishingService` — both pass it. This one was the odd one out, which is why
 * publishing by hand kept the picture and scheduling it lost the picture.
 *
 * These tests assert the argument reaches LinkedIn, because that is the only
 * thing that was ever wrong.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeDb, type FakeDb } from "./testing/fakeDb";

let fake: FakeDb;
/** Every createLinkedInPost invocation, as positional arguments. */
let linkedinCalls: unknown[][] = [];
/** What the fake LinkedIn reports back about the image. */
let imageAttached = true;
/** When true, the brand's destination is a Company Page. */
let orgDestination = false;
/** Every recordPostAnalytics invocation, as positional arguments. */
let analyticsCalls: unknown[][] = [];

const R2_IMAGE =
  "https://pub-6b268ceffacb4770a21174f67fed4cfa.r2.dev/generated/1785187500-abc.png";

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getDb: async () => fake.db,
  recordPostAnalytics: async (...args: unknown[]) => {
    analyticsCalls.push(args);
  },
}));

vi.mock("./linkedinService", () => ({
  // A plain closure, not vi.fn(): the vitest config sets `mockReset`, which
  // strips spy implementations before every test.
  createLinkedInPost: async (...args: unknown[]) => {
    linkedinCalls.push(args);
    return { id: "urn:li:share:1", url: "https://linkedin.com/feed/1", imageAttached };
  },
}));

/** Reminder-job state. Module scope: `vi.mock` factories are hoisted above any
 * declaration inside a `describe`, so a describe-scoped `let` is in its TDZ when
 * the factory first runs. */
let claims: Array<[number, string]> = [];
let releases: Array<[number, string]> = [];
let emails: string[] = [];
let claimResult = true;
let sendThrows = false;

vi.mock("./services/emailAutomation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./services/emailAutomation")>()),
  claimAutomationSend: async (userId: number, key: string) => {
    claims.push([userId, key]);
    return claimResult;
  },
  releaseAutomationClaim: async (userId: number, key: string) => {
    releases.push([userId, key]);
  },
}));

vi.mock("./_core/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./_core/email")>()),
  sendSubscriptionActiveReminderEmail: async (email: string) => {
    if (sendThrows) throw new Error("SendGrid 502");
    emails.push(email);
    return true;
  },
}));

vi.mock("./_core/tokenCrypto", () => ({
  decryptSecret: (v: string) => v,
  encryptSecret: (v: string) => v,
}));

vi.mock("./_core/notification", () => ({ notifyOwner: async () => undefined }));

vi.mock("./services/publishGuard", () => ({
  resolvePublishBrand: async () => 1,
  assertContentIsPublishable: async () => undefined,
  requireDestination: async () =>
    orgDestination
      ? { destinationType: "organization", destinationId: "urn:li:organization:7" }
      : { destinationType: "person", destinationId: null },
  claimPublication: async () => 99,
  settlePublication: async () => undefined,
}));

/** One due scheduled post whose underlying post carries `imageUrl`. */
function seed(postOver: Record<string, unknown> = {}) {
  fake = createFakeDb({
    rows: {
      scheduled_posts: [
        {
          id: 60005,
          userId: 720687,
          postId: 300006,
          platform: "linkedin",
          status: "scheduled",
          scheduledFor: new Date(Date.now() - 60_000),
        },
      ],
      posts: [
        {
          id: 300006,
          userId: 720687,
          generatedContent: "Klar for ukens innlegg?",
          imageUrl: R2_IMAGE,
          imageStatus: "completed",
          ...postOver,
        },
      ],
      linkedin_connections: [
        {
          userId: 720687,
          personUrn: "abc123",
          accessToken: "token",
          orgAccessToken: null,
          organizationUrn: null,
        },
      ],
    },
  });
}

async function publish() {
  linkedinCalls = [];
  analyticsCalls = [];
  const { triggerScheduledPosts } = await import("./schedulerService");
  await triggerScheduledPosts();
  expect(linkedinCalls).toHaveLength(1);
  return linkedinCalls[0];
}

describe("a scheduled post keeps its image", () => {
  beforeEach(() => {
    imageAttached = true;
    orgDestination = false;
    seed();
  });

  it("passes the stored image URL to LinkedIn", async () => {
    const args = await publish();
    expect(args[4]).toBe(R2_IMAGE);
  });

  it("passes the image as the FIFTH argument, where createLinkedInPost reads it", async () => {
    // The whole bug was an arity mistake, so the position is the assertion.
    // `(token, personUrn, content, authorOverride, imageUrl)`.
    const args = await publish();
    expect(args).toHaveLength(5);
    expect(args[2]).toBe("Klar for ukens innlegg?");
  });

  it("attaches the image even when image_status still says 'none'", async () => {
    // `content.attachImage` writes `image_url` at create time and never touches
    // `image_status`, and `seriesRouter` does the same — so the column sits at its
    // 'none' default for images that plainly exist. Three rows in production look
    // exactly like this. Gating on the status column would drop those images.
    seed({ imageStatus: "none" });
    expect((await publish())[4]).toBe(R2_IMAGE);
  });

  it("publishes text-only when there is no image, rather than failing", async () => {
    seed({ imageUrl: null, imageStatus: "none" });
    expect((await publish())[4]).toBeNull();
  });

  it("forwards the URL unfiltered, so scheduling and publishing by hand agree", async () => {
    // Deliberate: `createLinkedInPost` owns the "is this usable" decision, and it
    // is the same function the interactive path calls. A stricter local check here
    // would mean the SAME post kept its picture when published by hand and lost it
    // when scheduled — trading one silent inconsistency for another.
    for (const url of ["http://example.com/a.png", "data:image/png;base64,AAAA", "not a url"]) {
      seed({ imageUrl: url });
      expect((await publish())[4]).toBe(url);
    }
  });

  it("says so out loud when LinkedIn drops the image", async () => {
    // uploadLinkedInImage returns null on every failure — expired scope, owner
    // mismatch, CDN blip, wrong content-type — and the post then goes out as text.
    // That is the right trade, but an unqualified "Innlegg publisert" would make an
    // invisible image loss look identical to success. This is the reported symptom
    // arriving by a second route.
    imageAttached = false;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await publish();
      const said = warn.mock.calls.map((c) => String(c[0])).join(" | ");
      expect(said).toMatch(/WITHOUT its image/);
      expect(said).toContain(R2_IMAGE);
    } finally {
      warn.mockRestore();
    }
  });

  it("records the LinkedIn post id, so engagement can be collected later", async () => {
    // The 5th argument again, two lines from the image bug and the same shape of
    // mistake. `engagementMetricsService` only collects for rows with a non-null
    // `platform_post_id`, so omitting it here quietly excluded every SCHEDULED
    // post from engagement data — and from the "best time to post" computed from
    // it. Publishing by hand always passed it.
    await publish();
    expect(analyticsCalls).toHaveLength(1);
    expect(analyticsCalls[0]).toHaveLength(5);
    expect(analyticsCalls[0][4]).toBe("urn:li:share:1");
  });

  it("refuses to publish to a Company Page with a personal token", async () => {
    // The old code fell back to the member token while still sending the
    // organization URN as author, so LinkedIn 403'd and the failure read as a
    // mysterious permissions problem instead of "reconnect the Company Page".
    orgDestination = true;
    linkedinCalls = [];
    const { triggerScheduledPosts } = await import("./schedulerService");
    await triggerScheduledPosts();
    expect(linkedinCalls).toHaveLength(0);
    const failures = fake.opsOf("update", "scheduled_posts");
    expect(JSON.stringify(failures.map((o) => o.set))).toMatch(/Company Page/);
  });
});

/**
 * The statutory subscription reminder.
 *
 * `lastActiveReminderAt` is a read-then-write, so it spaces sends 182 days apart
 * but does nothing to stop TWO PROCESSES from both reading "never reminded" and
 * both sending — which is exactly how the weekly ritual reached customers three
 * times. The claim row is the lock.
 */
describe("the subscription reminder claims before it sends", () => {
  beforeEach(() => {
    claims = [];
    releases = [];
    emails = [];
    claimResult = true;
    sendThrows = false;
    fake = createFakeDb({
      rows: {
        subscriptions: [{ subId: 5, userId: 42, email: "kunde@example.com", name: "Kunde" }],
      },
    });
  });

  it("claims, sends, then records the reminder", async () => {
    const { remindActiveSubscriptions } = await import("./schedulerService");
    await remindActiveSubscriptions();
    expect(claims).toHaveLength(1);
    expect(claims[0][0]).toBe(42);
    expect(claims[0][1]).toMatch(/^subscription_reminder_\d{4}-\d{2}$/);
    expect(emails).toEqual(["kunde@example.com"]);
    expect(fake.opsOf("update", "subscriptions")).toHaveLength(1);
  });

  it("sends nothing when another process already claimed it", async () => {
    claimResult = false;
    const { remindActiveSubscriptions } = await import("./schedulerService");
    await remindActiveSubscriptions();
    expect(emails).toEqual([]);
    // And it must not record a reminder it did not send.
    expect(fake.opsOf("update", "subscriptions")).toHaveLength(0);
  });

  it("releases the claim when the send fails, so next month is not skipped", async () => {
    sendThrows = true;
    const { remindActiveSubscriptions } = await import("./schedulerService");
    await remindActiveSubscriptions();
    expect(releases).toHaveLength(1);
    expect(releases[0][1]).toBe(claims[0][1]);
    expect(fake.opsOf("update", "subscriptions")).toHaveLength(0);
  });

  it("claims before it sends, never after", async () => {
    // The other order is not a lock: two processes both send, then both claim,
    // and one insert fails after the damage is done.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("server/schedulerService.ts", "utf8");
    const fn = src.slice(src.indexOf("export async function remindActiveSubscriptions"));
    const claimAt = fn.indexOf("claimAutomationSend(");
    const sendAt = fn.indexOf("sendSubscriptionActiveReminderEmail(");
    expect(claimAt).toBeGreaterThan(-1);
    expect(sendAt).toBeGreaterThan(-1);
    expect(claimAt).toBeLessThan(sendAt);
  });
});

/**
 * The scheduler's idle cost.
 *
 * This job runs every five minutes forever. On a serverless database every
 * statement is billed, and a WRITE is billed far more than a read — it takes
 * locks and replicates. The reaper was an unconditional UPDATE on every tick:
 * ~8,640 write statements a month, essentially all of them matching zero rows.
 */
describe("an idle tick costs as little as possible", () => {
  beforeEach(() => {
    imageAttached = true;
    orgDestination = false;
    // Nothing stuck, nothing due — the overwhelmingly common case.
    fake = createFakeDb({ rows: { scheduled_posts: [] } });
  });

  it("writes nothing when there is nothing stuck and nothing due", async () => {
    const { triggerScheduledPosts } = await import("./schedulerService");
    await triggerScheduledPosts();
    expect(fake.opsOf("update", "scheduled_posts")).toHaveLength(0);
    expect(linkedinCalls).toHaveLength(0);
  });

  it("still reaps a genuinely stuck row", async () => {
    // Reading first must not mean never writing.
    fake = createFakeDb({
      rows: {
        scheduled_posts: [
          {
            id: 77,
            userId: 720687,
            postId: 300006,
            platform: "linkedin",
            status: "publishing",
            scheduledFor: new Date(Date.now() - 3_600_000),
            updatedAt: new Date(Date.now() - 3_600_000),
          },
        ],
      },
    });
    const { triggerScheduledPosts } = await import("./schedulerService");
    await triggerScheduledPosts();
    const updates = fake.opsOf("update", "scheduled_posts");
    expect(updates.length).toBeGreaterThan(0);
    expect(JSON.stringify(updates.map((o) => o.set))).toMatch(/Stuck in publishing/);
  });
});
