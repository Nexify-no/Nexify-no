/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * Run a website analysis into ONE named brand (PR #80).
 *
 * Previously this logic lived inline in `brand.analyze` and always targeted the
 * ACTIVE brand. The "add brand from URL" journey needs to analyse a brand the
 * user has not switched to yet — it is still a `draft` under review — so the
 * target brand became a parameter.
 *
 * Everything else is unchanged and deliberately so: the same quota check, the
 * same in-flight and cooldown guards, the same redacted public errors, and the
 * same (user, brand) exact scoping from PR #79. There is one implementation, so
 * the two entry points cannot drift.
 */

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { brandProfiles, type BrandProfile } from "../../../drizzle/schema";
import { chargeAnalysisQuota, getDb, hasAnalysisQuota } from "../../db";
import { logMerkehjerneEvent } from "./analytics";

export const ACTIVE_SCAN_WINDOW_MS = 90_000;
export const RESCAN_COOLDOWN_MS = 60_000;

export type AnalysisFailure = {
  code: "BAD_REQUEST" | "TOO_MANY_REQUESTS" | "FORBIDDEN" | "CONFLICT" | "INTERNAL_SERVER_ERROR";
  message: string;
};

/** Thrown for every expected failure, carrying an already-safe public message. */
export class BrandAnalysisError extends Error {
  readonly failure: AnalysisFailure;
  constructor(failure: AnalysisFailure) {
    super(failure.message);
    this.name = "BrandAnalysisError";
    this.failure = failure;
  }
}

/**
 * Map an internal error to something safe to show. Crawler errors carry a vetted
 * `publicMessage`; anything else is deliberately generic, because raw driver and
 * fetch messages echo URLs and column values.
 */
export function publicFailure(error: unknown): AnalysisFailure {
  if (error instanceof BrandAnalysisError) return error.failure;
  if (error && typeof error === "object" && "code" in error) {
    const workerCode = String((error as { code: unknown }).code);
    if (workerCode === "busy") {
      return { code: "TOO_MANY_REQUESTS", message: "Analysetjenesten er opptatt. Prøv igjen om litt." };
    }
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

/** Exact (user, brand) scope — never widened with `IS NULL`. See PR #79. */
function ownProfile(userId: number, brandId: number | null) {
  return brandId == null
    ? eq(brandProfiles.userId, userId)
    : and(eq(brandProfiles.userId, userId), eq(brandProfiles.brandId, brandId));
}

/**
 * Analyse `websiteUrl` and store the result as the Merkehjerne of `brandId`.
 *
 * `brandId` null means multi-brand is off — the account-wide legacy behaviour.
 * Returns the saved profile. Throws `BrandAnalysisError` with a safe message.
 */
export async function analyzeIntoBrand(
  userId: number,
  brandId: number | null,
  websiteUrl: string,
): Promise<BrandProfile> {
  const db = await getDb();
  if (!db) {
    throw new BrandAnalysisError({ code: "INTERNAL_SERVER_ERROR", message: "Databasen er ikke tilgjengelig." });
  }

  const [existing] = await db
    .select()
    .from(brandProfiles)
    .where(ownProfile(userId, brandId))
    .orderBy(brandProfiles.id)
    .limit(1);

  const now = Date.now();
  if (existing?.status === "analyzing" && now - existing.updatedAt.getTime() < ACTIVE_SCAN_WINDOW_MS) {
    throw new BrandAnalysisError({ code: "CONFLICT", message: "En analyse kjører allerede." });
  }
  // An identical re-scan inside the cooldown returns the stored profile rather
  // than paying for the same LLM pass twice.
  if (
    existing?.status === "ready" &&
    existing.analyzedAt &&
    existing.websiteUrl === websiteUrl &&
    now - existing.analyzedAt.getTime() < RESCAN_COOLDOWN_MS
  ) {
    return existing;
  }

  if (!(await hasAnalysisQuota(userId))) {
    throw new BrandAnalysisError({
      code: "FORBIDDEN",
      message: "Du har nådd grensen for antall analyser denne måneden. Oppgrader for flere.",
    });
  }

  const startedAt = Date.now();
  logMerkehjerneEvent("brand_analysis_started", { userId, hadExisting: !!existing });

  const analysisId = randomUUID();
  await db.insert(brandProfiles).values({
    userId,
    brandId,
    websiteUrl,
    status: "analyzing",
    analysisId,
    lastError: null,
  }).onDuplicateKeyUpdate({
    set: { websiteUrl, status: "analyzing", analysisId, lastError: null },
  });

  try {
    // Dynamic import: brand analysis and the AI SDK stay off the app boot path.
    const { analyzeBrandWebsite } = await import("../../brandAnalyzer");
    const result = await analyzeBrandWebsite(websiteUrl, analysisId, existing?.contentHash);

    await db
      .update(brandProfiles)
      .set({
        ...(result.unchanged ? {} : result.profile),
        ...result.crawl,
        status: "ready",
        lastError: null,
        analyzedAt: new Date(),
      })
      // analysisId pins this write to OUR scan, so an older request cannot
      // overwrite a newer one; orderBy+limit keeps it to a single row.
      .where(and(ownProfile(userId, brandId), eq(brandProfiles.analysisId, analysisId)))
      .orderBy(brandProfiles.id)
      .limit(1);

    const [saved] = await db
      .select()
      .from(brandProfiles)
      .where(ownProfile(userId, brandId))
      .orderBy(brandProfiles.id)
      .limit(1);
    if (!saved) throw new Error("brand_profile_missing_after_analysis");

    if (result.unchanged) {
      logMerkehjerneEvent("brand_analysis_skipped_unchanged", { userId, durationMs: Date.now() - startedAt });
    } else {
      // Charge only real analyses (unchanged/cached re-scans are free).
      await chargeAnalysisQuota(userId);
      logMerkehjerneEvent("brand_analysis_completed", {
        userId,
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
      userId,
      brandId,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorCode: error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code).slice(0, 100)
        : "unclassified",
    });
    await db
      .update(brandProfiles)
      .set({ status: "failed", lastError: failure.message })
      .where(and(ownProfile(userId, brandId), eq(brandProfiles.analysisId, analysisId)))
      .orderBy(brandProfiles.id)
      .limit(1);
    logMerkehjerneEvent("brand_analysis_failed", {
      userId,
      errorCode: error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code).slice(0, 60)
        : "unclassified",
    });
    throw new BrandAnalysisError(failure);
  }
}
