import { describe, it, expect } from "vitest";

/**
 * Live check that the upsert on `platform_integrations` actually executes.
 *
 * This is the one defect a type checker could not see: `savePlatformToken` used
 * `onConflictDoUpdate`, drizzle's Postgres API, behind an `(db as any)` cast. It
 * threw TypeError at runtime and nothing caught it because no code path reached
 * it. Only a real INSERT proves the replacement works.
 *
 * Skipped unless TEST_DATABASE_URL is set, so CI and local runs are unaffected.
 */
const url = process.env.TEST_DATABASE_URL;
const maybe = url ? describe : describe.skip;

maybe("savePlatformToken upserts instead of duplicating", () => {
  it("writes once, then updates in place", async () => {
    process.env.DATABASE_URL = url;
    process.env.TOKEN_ENCRYPTION_KEY ||= "0".repeat(64);
    const { platformManager } = await import("./services/platformOAuthService");
    const { getDb } = await import("./db");
    const db = await getDb();
    const { platformIntegrations } = await import("../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");

    const userId = 999001;
    await platformManager.saveMetaConnection(
      userId,
      { id: "page-A", name: "Page A", accessToken: "TOKEN_A", instagram: { id: "ig-A", username: "a" } },
      { accessToken: "USER_TOKEN_1" },
    );
    await platformManager.saveMetaConnection(
      userId,
      { id: "page-B", name: "Page B", accessToken: "TOKEN_B", instagram: null },
      { accessToken: "USER_TOKEN_2" },
    );

    const rows = await (db as any)
      .select()
      .from(platformIntegrations)
      .where(eq(platformIntegrations.userId as any, userId));

    // One facebook row, not two — the whole point of the unique key + upsert.
    expect(rows.filter((r: any) => r.platform === "facebook")).toHaveLength(1);
    expect(rows.find((r: any) => r.platform === "facebook").accountId).toBe("page-B");
    // Page B has no linked Instagram, so the previous IG row must be gone rather
    // than left publishing to an account the user no longer selected.
    expect(rows.filter((r: any) => r.platform === "instagram")).toHaveLength(0);

    const conn = await platformManager.getPlatformConnection(userId, "facebook");
    expect(conn?.accessToken).toBe("TOKEN_B");
    // The long-lived USER token round-trips through encryption in refreshToken.
    expect(conn?.refreshToken).toBe("USER_TOKEN_2");

    await (db as any).delete(platformIntegrations).where(eq(platformIntegrations.userId as any, userId));
  });
});
