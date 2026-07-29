/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { brandProfiles } from "../../drizzle/schema";
import { getDb } from "../db";
import { logMerkehjerneEvent } from "../services/merkehjerne/analytics";
import { aiProcedure, protectedProcedure, router } from "../_core/trpc";

const stringList = z.array(z.string().trim().min(1).max(300)).max(30);
const editableProfile = z.object({
  companyName: z.string().trim().min(1).max(255).optional(),
  industry: z.string().trim().max(255).optional(),
  summary: z.string().trim().max(2_000).optional(),
  offers: stringList.optional(),
  audiences: stringList.optional(),
  customerProblems: stringList.optional(),
  differentiators: stringList.optional(),
  tonePersonality: stringList.optional(),
  writingStyle: z.string().trim().max(1_500).optional(),
  preferredWords: stringList.optional(),
  avoidWords: stringList.optional(),
  callsToAction: stringList.optional(),
  contentPillars: stringList.optional(),
}).strict();

const factSchema = z.object({
  statement: z.string().trim().min(1).max(500),
  sourceUrl: z.string().trim().max(1_000).default(""),
  evidenceQuote: z.string().trim().min(1).max(500).optional(),
}).strict();
const factsInput = z.object({ facts: z.array(factSchema).max(60) }).strict();

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Databasen er ikke tilgjengelig." });
  return db;
}

/**
 * The brand this request operates on (MB1). Returns null when multi-brand is off,
 * so every query keeps its previous account-wide behaviour.
 */
async function activeBrand(accountId: number): Promise<number | null> {
  const { getActiveBrandIdIfEnabled } = await import("../services/brands");
  return getActiveBrandIdIfEnabled(accountId);
}

/**
 * Scope a brand_profiles row to exactly (user, brand).
 *
 * PR #79: this used to include `OR brand_id IS NULL`, which meant analysing one
 * brand could read — and then overwrite — an unowned Merkehjerne that every
 * other brand was also reading. Merkehjerne is now fetched by user_id AND
 * brand_id, exact match only.
 */
function ownProfile(userId: number, brandId: number | null) {
  return brandId == null
    ? eq(brandProfiles.userId, userId)
    : and(eq(brandProfiles.userId, userId), eq(brandProfiles.brandId, brandId));
}

export const brandRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const brandId = await activeBrand(ctx.user.id);
    const [profile] = await db.select().from(brandProfiles).where(ownProfile(ctx.user.id, brandId)).orderBy(brandProfiles.id).limit(1);
    if (!profile) return null;

    // Does this Merkehjerne describe the brand it is attached to?
    //
    // For a while it might not: legacy adoption stamped an unowned Merkehjerne
    // onto whichever brand was active, so a brand named Penna.no could carry a
    // Merkehjerne built from ballongforfest.no — and every post generated for
    // that brand came out in a balloon company's voice, on Penna's channels.
    // The adoption bug is fixed; these rows are already written, and a wrong
    // Merkehjerne is wrong silently and in every post that follows. Report it.
    let brandMismatch = false;
    let profileDescribes: string | null = null;
    if (brandId != null) {
      try {
        const { brands } = await import("../../drizzle/schema");
        const { detectBrandMismatch } = await import("../services/merkehjerne/brandMismatch");
        const [brand] = await db
          .select({ name: brands.name, websiteUrl: brands.websiteUrl })
          .from(brands)
          .where(and(eq(brands.id, brandId), eq(brands.accountId, ctx.user.id)))
          .limit(1);
        if (brand) {
          const result = detectBrandMismatch({
            brandName: brand.name,
            brandWebsiteUrl: brand.websiteUrl,
            profileCompanyName: profile.companyName,
            profileWebsiteUrl: (profile as any).websiteUrl,
          });
          brandMismatch = result.mismatch;
          profileDescribes = result.profileDescribes;
        }
      } catch (error) {
        // A warning banner is not worth failing the Merkehjerne page over.
        console.error("[brand.get] mismatch check failed:", error);
      }
    }

    return { ...profile, brandMismatch, profileDescribes };
  }),

  analyze: aiProcedure
    .input(z.object({ websiteUrl: z.string().trim().min(3).max(1_000) }).strict())
    .mutation(async ({ ctx, input }) => {
      // PR #80: one implementation, shared with the "add brand from URL" journey
      // (which analyses a draft brand the user has not switched to yet). Keeping
      // two copies of the quota / cooldown / error-redaction logic is how they
      // drift apart.
      const { analyzeIntoBrand, publicFailure } = await import("../services/merkehjerne/analyzeIntoBrand");
      const brandId = await activeBrand(ctx.user.id);
      try {
        return await analyzeIntoBrand(ctx.user.id, brandId, input.websiteUrl);
      } catch (error) {
        throw new TRPCError(publicFailure(error));
      }
    }),

  update: protectedProcedure.input(editableProfile).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    // Editing invalidates a prior confirmation — user must re-confirm the reviewed profile.
    await db
      .update(brandProfiles)
      .set({ ...input, confirmedAt: null })
      .where(and(ownProfile(ctx.user.id, await activeBrand(ctx.user.id)), eq(brandProfiles.status, "ready")))
      // PR #79: one Merkehjerne per mutation, never a fan-out across brands.
      // ORDER BY makes the target deterministic — with multi-brand OFF an
      // account can still hold several unowned rows, and an unordered LIMIT
      // would update one row while the readback below returned another.
      .orderBy(brandProfiles.id)
      .limit(1);
    const [saved] = await db.select().from(brandProfiles).where(ownProfile(ctx.user.id, await activeBrand(ctx.user.id))).orderBy(brandProfiles.id).limit(1);
    if (!saved) throw new TRPCError({ code: "NOT_FOUND", message: "Opprett Merkehjernen først." });
    logMerkehjerneEvent("brand_profile_edited", { userId: ctx.user.id, trigger: "fields" });
    return saved;
  }),

  // Replace the whole facts list (manual add/delete). Clears confirmation.
  setFacts: protectedProcedure.input(factsInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await db
      .update(brandProfiles)
      .set({ facts: input.facts, confirmedAt: null })
      .where(and(ownProfile(ctx.user.id, await activeBrand(ctx.user.id)), eq(brandProfiles.status, "ready")))
      // PR #79: one Merkehjerne per mutation, never a fan-out across brands.
      // ORDER BY makes the target deterministic — with multi-brand OFF an
      // account can still hold several unowned rows, and an unordered LIMIT
      // would update one row while the readback below returned another.
      .orderBy(brandProfiles.id)
      .limit(1);
    const [saved] = await db.select().from(brandProfiles).where(ownProfile(ctx.user.id, await activeBrand(ctx.user.id))).orderBy(brandProfiles.id).limit(1);
    if (!saved) throw new TRPCError({ code: "NOT_FOUND", message: "Opprett Merkehjernen først." });
    logMerkehjerneEvent("brand_profile_edited", { userId: ctx.user.id, trigger: "facts" });
    return saved;
  }),

  // User reviewed the profile and confirms it for reuse across the AI tools.
  confirm: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await requireDb();
    await db
      .update(brandProfiles)
      .set({ confirmedAt: new Date() })
      .where(and(ownProfile(ctx.user.id, await activeBrand(ctx.user.id)), eq(brandProfiles.status, "ready")))
      // PR #79: one Merkehjerne per mutation, never a fan-out across brands.
      // ORDER BY makes the target deterministic — with multi-brand OFF an
      // account can still hold several unowned rows, and an unordered LIMIT
      // would update one row while the readback below returned another.
      .orderBy(brandProfiles.id)
      .limit(1);
    const [saved] = await db.select().from(brandProfiles).where(ownProfile(ctx.user.id, await activeBrand(ctx.user.id))).orderBy(brandProfiles.id).limit(1);
    if (!saved) throw new TRPCError({ code: "NOT_FOUND", message: "Opprett Merkehjernen først." });
    logMerkehjerneEvent("brand_profile_confirmed", { userId: ctx.user.id });
    return saved;
  }),
});
