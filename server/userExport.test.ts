/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

// Sample data returned by the mocked db layer.
const samplePosts = [
  { id: 1, userId: 7, generatedContent: "Post A", platform: "linkedin" },
  { id: 2, userId: 7, generatedContent: "Post B", platform: "twitter" },
];
const sampleSubscription = { id: 3, userId: 7, status: "active", stripeSubscriptionId: "sub_123" };
const samplePreference = { id: 4, userId: 7, language: "no" };

const getUserPosts = vi.fn();
const getUserSubscription = vi.fn();
const getUserPreference = vi.fn();

vi.mock("./db", () => ({
  getUserPosts: (...a: unknown[]) => getUserPosts(...a),
  getUserSubscription: (...a: unknown[]) => getUserSubscription(...a),
  getUserPreference: (...a: unknown[]) => getUserPreference(...a),
}));

const mockUser = {
  id: 7,
  openId: "open-7",
  name: "Test User",
  email: "test@example.com",
  role: "user" as const,
  loginMethod: null,
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const mockContext: TrpcContext = {
  user: mockUser,
  req: {} as any,
  res: {} as any,
};

describe("user.exportData (GDPR data portability)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserPosts.mockResolvedValue(samplePosts);
    getUserSubscription.mockResolvedValue(sampleSubscription);
    getUserPreference.mockResolvedValue(samplePreference);
  });

  it("includes the user's posts and subscription in the export payload", async () => {
    const { userRouter } = await import("./routers/userRouter");
    const caller = userRouter.createCaller(mockContext);

    const result = await caller.exportData();

    expect(result).toHaveProperty("user");
    expect(result).toHaveProperty("preferences", samplePreference);
    expect(result).toHaveProperty("posts", samplePosts);
    expect(result).toHaveProperty("subscription", sampleSubscription);
    expect(result).toHaveProperty("exportedAt");
    expect(typeof result.exportedAt).toBe("string");
  });

  it("scopes the export to the authenticated user only", async () => {
    const { userRouter } = await import("./routers/userRouter");
    const caller = userRouter.createCaller(mockContext);

    await caller.exportData();

    // Each fetch must be called with the caller's own id, never another user's.
    expect(getUserPosts).toHaveBeenCalledWith(mockUser.id);
    expect(getUserSubscription).toHaveBeenCalledWith(mockUser.id);
    expect(getUserPreference).toHaveBeenCalledWith(mockUser.id);
  });
});