/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Chainable Drizzle mock using explicit closures (mockReturnThis + mockClear
// proved unreliable here). The ownership query in schedulePost is
// `db.select(...).from(posts).where(and(id, userId)).limit(1)`; .limit resolves
// to `ownershipResult`, kept empty to simulate "post not owned by this user".
const ownershipResult: any[] = [];
const mockDb: any = {};
mockDb.select = vi.fn(() => mockDb);
mockDb.from = vi.fn(() => mockDb);
mockDb.where = vi.fn(() => mockDb);
mockDb.limit = vi.fn(() => Promise.resolve(ownershipResult));
mockDb.insert = vi.fn(() => mockDb);
mockDb.values = vi.fn(() => Promise.resolve({}));

vi.mock("./db", () => ({
  getDb: vi.fn(() => Promise.resolve(mockDb)),
}));

import { schedulePost } from "./services/schedulingService";

describe("schedulingService.schedulePost — tenant isolation (IDOR guard)", () => {
  beforeEach(() => {
    ownershipResult.length = 0; // post NOT owned by the user
    mockDb.insert.mock.calls.length = 0; // reset call history without wiping impl
  });

  it("rejects scheduling a postId the user does not own (no schedule inserted)", async () => {
    await expect(
      schedulePost(999, /* userId */ 1, "linkedin", new Date())
    ).rejects.toThrow("Post not found or unauthorized");

    // Critically: no scheduled_posts row was inserted for the foreign post.
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("performs an ownership lookup before scheduling", async () => {
    await expect(schedulePost(999, 1, "linkedin", new Date())).rejects.toThrow();
    expect(mockDb.select).toHaveBeenCalled();
    expect(mockDb.where).toHaveBeenCalled();
  });
});