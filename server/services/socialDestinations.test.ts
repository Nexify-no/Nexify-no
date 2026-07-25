import { describe, it, expect, vi, afterEach } from "vitest";
import { assertBrandOwnsConnection } from "./socialDestinations";

describe("assertBrandOwnsConnection (cross-brand publish guard)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("allows publishing when post and connection share the brand", () => {
    expect(() =>
      assertBrandOwnsConnection({ accountId: 1, postBrandId: 7, connectionBrandId: 7, platform: "linkedin" }),
    ).not.toThrow();
  });

  it("blocks a Penna post from publishing through a Nexify connection", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      assertBrandOwnsConnection({ accountId: 1, postBrandId: 7, connectionBrandId: 9, platform: "linkedin", postId: 42 }),
    ).toThrow(/annen merkevare/i);
    expect(err).toHaveBeenCalled();
    const logged = String(err.mock.calls[0]?.[1] ?? "");
    expect(logged).toContain("cross_brand_publish_blocked");
  });

  it("blocks when either side is unassigned (null brand)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      assertBrandOwnsConnection({ accountId: 1, postBrandId: null, connectionBrandId: 7, platform: "linkedin" }),
    ).toThrow();
    expect(() =>
      assertBrandOwnsConnection({ accountId: 1, postBrandId: 7, connectionBrandId: null, platform: "linkedin" }),
    ).toThrow();
  });
});
