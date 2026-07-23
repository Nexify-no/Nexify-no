/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { brandProfiles } from "../../drizzle/schema";
import { getDb, hasAnalysisQuota, chargeAnalysisQuota } from "../db";
import { logMerkehjerneEvent } from "../services/merkehjerne/analytics";
import { aiProcedure, protectedProcedure, router } from "../_core/trpc";

const ACTIVE_SCAN_WINDOW_MS = 90_000;
const RESCAN_COOLDOWN_MS = 60_000;
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

function publicFailure(error: unknown): { code: "BAD_REQUEST" | "TOO_MANY_REQUESTS" | "INTERNAL_SERVER_ERROR"; message: string } {
  if (error && typeof error === "object" && "code" in error) {
    const workerCode = String((error as { code: unknown }).code);
    if (workerCode === "busy") return { code: "TOO_MANY_REQUESTS", message: "Analysetjenesten er opptatt. Prøv igjen om litt." };
    if ([
      "unsafe_url", "invalid_url", "ambiguous_url", "unsupported_scheme", "userinfo_not_allowed",
      "blocked_host", "blocked_port", "private_or_mixed_dns", "robots_disallowed", "no_readable_content",
    ].includes(workerCode)) {
      const candidate = "publicMessage" in error ? String((error as { publicMessage: unknown }).publicMessage) : "";
      return { code: "BAD_REQUEST", message: candidate.slice(0, 300) || "Kunne ikke analysere denne nettadressen." };
    }
  }
  if (error instanceof z.ZodError) {
    return { code: "BAD_REQUEST", message: "Analysen ga ufullstendige data. Prøv igjen." };
  }
  return { code: "INTERNAL_SERVER_ERROR", message: "Analysen mislyktes. Prøv igjen senere." };
}

export const brandRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const [profile] = await db.select().from(brandProfiles).where(eq(brandProfiles.userId, ctx.user.id)).limit(1);
    return profile ?? null;
  }),

  analyze: aiProcedure
    .input(z.object({ websiteUrl: z.string().trim().min(3).max(1_000) }).strict())
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [existing] = await db
        .select()
        .from(brandProfiles)
        .where(eq(brandProfiles.userId, ctx.user.id))
        .limit(1);
      const now = Date.now();
      if (existing?.status === "analyzing" && now - existing.updatedAt.getTime() < ACTIVE_SCAN_WINDOW_MS) {
        throw new TRPCError({ code: "CONFLICT", message: "En analyse kjører allerede." });
      }
      if (
        existing?.status === "ready" &&
        existing.analyzedAt &&
        existing.websiteUrl === input.websiteUrl &&
        now - existing.analyzedAt.getTime() < RESCAN_COOLDOWN_MS
      ) {
        return existing;
      }

      if (!(await hasAnalysisQuota(ctx.user.id))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Du har nådd grensen for antall analyser denne måneden. Oppgrader for flere.",
        });
      }
      const startedAt = Date.now();
      logMerkehjerneEvent("brand_analysis_started", { userId: ctx.user.id, hadExisting: !!existing });

      const analysisId = randomUUID();
      await db.insert(brandProfiles).values({
        userId: ctx.user.id,
        websiteUrl: input.websiteUrl,
        status: "analyzing",
        analysisId,
        lastError: null,
      }).onDuplicateKeyUpdate({
        set: {
          websiteUrl: input.websiteUrl,
          status: "analyzing",
          analysisId,
          lastError: null,
        },
      });

      try {
        // Dynamic import: brand analysis and the AI SDK stay off app boot path.
        const { analyzeBrandWebsite } = await import("../brandAnalyzer");
        const result = await analyzeBrandWebsite(input.websiteUrl, analysisId, existing?.contentHash);
        await db
          .update(brandProfiles)
          .set({
            ...(result.unchanged ? {} : result.profile),
            ...result.crawl,
            status: "ready",
            lastError: null,
            analyzedAt: new Date(),
          })
          .where(and(eq(brandProfiles.userId, ctx.user.id), eq(brandProfiles.analysisId, analysisId)));

        const [saved] = await db.select().from(brandProfiles).where(eq(brandProfiles.userId, ctx.user.id)).limit(1);
        if (!saved) throw new Error("brand_profile_missing_after_analysis");
        if (result.unchanged) {
          logMerkehjerneEvent("brand_analysis_skipped_unchanged", { userId: ctx.user.id, durationMs: Date.now() - startedAt });
        } else {
          // Charge only real analyses (unchanged/cached re-scans are free).
          await chargeAnalysisQuota(ctx.user.id);
          logMerkehjerneEvent("brand_analysis_completed", {
            userId: ctx.user.id,
            durationMs: Date.now() - startedAt,
            factsCount: saved.facts?.length ?? 0,
            warningsCount: saved.injectionWarnings?.length ?? 0,
          });
        }
        return saved;
      } catch (error) {
        const failure = publicFailure(error);
        console.error("[brand.analyze]", {
          analysisId,
          userId: ctx.user.id,
          errorName: error instanceof Error ? error.name : "UnknownError",
          errorCode: error && typeof error === "object" && "code" in error
            ? String((error as { code: unknown }).code).slice(0, 100)
            : "unclassified",
        });
        await db
          .update(brandProfiles)
          .set({ status: "failed", lastError: failure.message })
          .where(and(eq(brandProfiles.userId, ctx.user.id), eq(brandProfiles.analysisId, analysisId)));
        logMerkehjerneEvent("brand_analysis_failed", {
          userId: ctx.user.id,
          errorCode: error && typeof error === "object" && "code" in error
            ? String((error as { code: unknown }).code).slice(0, 60)
            : "unclassified",
        });
        throw new TRPCError(failure);
      }
    }),

  update: protectedProcedure.input(editableProfile).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    // Editing invalidates a prior confirmation — user must re-confirm the reviewed profile.
    await db
      .update(brandProfiles)
      .set({ ...input, confirmedAt: null })
      .where(and(eq(brandProfiles.userId, ctx.user.id), eq(brandProfiles.status, "ready")));
    const [saved] = await db.select().from(brandProfiles).where(eq(brandProfiles.userId, ctx.user.id)).limit(1);
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
      .where(and(eq(brandProfiles.userId, ctx.user.id), eq(brandProfiles.status, "ready")));
    const [saved] = await db.select().from(brandProfiles).where(eq(brandProfiles.userId, ctx.user.id)).limit(1);
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
      .where(and(eq(brandProfiles.userId, ctx.user.id), eq(brandProfiles.status, "ready")));
    const [saved] = await db.select().from(brandProfiles).where(eq(brandProfiles.userId, ctx.user.id)).limit(1);
    if (!saved) throw new TRPCError({ code: "NOT_FOUND", message: "Opprett Merkehjernen først." });
    logMerkehjerneEvent("brand_profile_confirmed", { userId: ctx.user.id });
    return saved;
  }),
});
