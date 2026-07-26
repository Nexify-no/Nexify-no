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
    return profile ?? null;
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
