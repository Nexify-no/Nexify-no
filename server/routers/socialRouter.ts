/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

// Per-brand publish destinations (MB2, behind FEATURE_MULTI_BRAND).
// Account scoping always comes from the session.

import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { brands, brandSocialConnections } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { getActiveBrandId } from "../services/brands";
import { listBrandConnections, syncConnectionsForAccount } from "../services/socialDestinations";

const PLATFORMS = ["linkedin", "facebook", "instagram", "twitter"] as const;

function requireMultiBrand() {
  if (!ENV.featureMultiBrand) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Multi-brand er ikke aktivert." });
  }
}

export const socialRouter = router({
  /**
   * Destinations for the active brand: one entry per platform so the publish
   * window can show "publiserer som …" and disable everything unconnected.
   */
  destinations: protectedProcedure.query(async ({ ctx }) => {
    requireMultiBrand();
    const brandId = await getActiveBrandId(ctx.user.id);
    const rows = await listBrandConnections(ctx.user.id, brandId);
    const db = await getDb();
    const [brand] = db
      ? await db.select().from(brands).where(and(eq(brands.id, brandId), eq(brands.accountId, ctx.user.id))).limit(1)
      : [];
    return {
      brandId,
      brandName: brand?.name ?? "",
      platforms: PLATFORMS.map((platform) => {
        const row = rows.find((r) => r.platform === platform);
        return {
          platform,
          connected: row?.status === "active",
          status: row?.status ?? "not_connected",
          destinationName: row?.destinationName ?? null,
          destinationType: row?.destinationType ?? null,
          connectionId: row?.id ?? null,
        };
      }),
    };
  }),

  /** Connections that could not be mapped to a brand during migration. */
  unassigned: protectedProcedure.query(async ({ ctx }) => {
    requireMultiBrand();
    await syncConnectionsForAccount(ctx.user.id);
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(brandSocialConnections)
      .where(and(
        eq(brandSocialConnections.accountId, ctx.user.id),
        eq(brandSocialConnections.status, "needs_brand_assignment"),
      ));
  }),

  /** The user resolves an ambiguous connection by choosing its brand. */
  assignBrand: protectedProcedure
    .input(z.object({
      connectionId: z.number().int().positive(),
      brandId: z.number().int().positive(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      requireMultiBrand();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Databasen er ikke tilgjengelig." });
      const [brand] = await db
        .select()
        .from(brands)
        .where(and(eq(brands.id, input.brandId), eq(brands.accountId, ctx.user.id)))
        .limit(1);
      if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "Merkevaren finnes ikke." });
      const res = await db
        .update(brandSocialConnections)
        .set({ brandId: input.brandId, status: "active" })
        .where(and(
          eq(brandSocialConnections.id, input.connectionId),
          eq(brandSocialConnections.accountId, ctx.user.id),
        ));
      const affected = (res as { affectedRows?: number })?.affectedRows
        ?? (res as Array<{ affectedRows?: number }>)?.[0]?.affectedRows ?? 0;
      if (affected === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Tilkoblingen finnes ikke." });
      return { success: true };
    }),
});
