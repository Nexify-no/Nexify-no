/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Competitor Radar router (`radar` namespace) — the REAL feature on top of the
 * existing `competitors` table. Every query/mutation is ownership-checked against
 * competitors.user_id. Public-source monitoring only (see radarService).
 */
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

// Tiny in-memory cache for `get` (per competitor) to avoid recomputing the
// timeline on rapid navigation. Short TTL; never serves cross-user data because
// the key includes the owning user id and ownership is verified before caching.
const GET_CACHE_TTL_MS = 10_000;
const getCache = new Map<string, { at: number; data: unknown }>();

/** Verify the competitor belongs to the caller; returns the row or throws. */
async function assertOwnedCompetitor(userId: number, competitorId: number) {
  const { getDb } = await import("../db");
  const { competitors } = await import("../../drizzle/schema");
  const { eq, and } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .select()
    .from(competitors)
    .where(and(eq(competitors.id, competitorId), eq(competitors.userId, userId)))
    .limit(1);
  if (!row) throw new Error("Konkurrent ikke funnet");
  return { db, competitor: row };
}

/** ISO week label (e.g. 2026-W26) for timeline bucketing. */
function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((date.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export const radarRouter = router({
  /**
   * Add a competitor: insert the record, best-effort detect sources, then
   * best-effort initial sync + analyze. Fetch errors never fail the add.
   */
  addCompetitor: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        website: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { getDb, getUserSubscription } = await import("../db");
      const { competitors, competitorSources } = await import("../../drizzle/schema");

      // Keep the same Pro gating as the legacy feature.
      const subscription = await getUserSubscription(ctx.user.id);
      if (!subscription || subscription.status !== "active") {
        throw new Error("Konkurrent-Radar krever Pro-abonnement");
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { normalizeUrl, detectSources, syncCompetitor, analyzeCompetitor } =
        await import("../services/radarService");

      const normalized = normalizeUrl(input.website);
      if (!normalized) throw new Error("Ugyldig nettsted-URL");

      // The `competitors` table requires platform + profileUrl (legacy NOT NULL
      // columns). Use sensible defaults so the radar feature does not depend on them.
      const result: any = await db.insert(competitors).values({
        userId: ctx.user.id,
        name: input.name,
        platform: "linkedin",
        profileUrl: normalized,
        website: normalized,
      });
      const competitorId: number = result?.[0]?.insertId ?? result?.insertId;
      if (!competitorId) throw new Error("Kunne ikke opprette konkurrent");

      // Best-effort source detection + initial ingest. Never fail the add on this.
      try {
        const detected = await detectSources(normalized, input.name);
        for (const s of detected) {
          await db.insert(competitorSources).values({
            competitorId,
            type: s.type,
            url: s.url.slice(0, 990),
          });
        }
      } catch (err) {
        console.warn("[radar] detectSources failed:", (err as Error)?.message || err);
      }

      try {
        await syncCompetitor(competitorId);
        await analyzeCompetitor(competitorId);
      } catch (err) {
        console.warn("[radar] initial sync/analyze failed:", (err as Error)?.message || err);
      }

      return { id: competitorId };
    }),

  /** List the user's competitors with a per-competitor activity summary. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const { getDb } = await import("../db");
    const { competitors, competitorTopics } = await import("../../drizzle/schema");
    const { eq, desc } = await import("drizzle-orm");
    const { summaryStats } = await import("../services/radarService");
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const rows = await db
      .select()
      .from(competitors)
      .where(eq(competitors.userId, ctx.user.id))
      .orderBy(desc(competitors.createdAt));

    const enriched = await Promise.all(
      rows.map(async (c) => {
        const stats = await summaryStats(c.id);
        const topics = await db
          .select()
          .from(competitorTopics)
          .where(eq(competitorTopics.competitorId, c.id))
          .orderBy(desc(competitorTopics.score))
          .limit(3);
        return {
          id: c.id,
          name: c.name,
          website: c.website ?? null,
          createdAt: c.createdAt,
          itemCount: stats.itemCount,
          lastPublishedAt: stats.lastPublishedAt,
          postsPerWeek: stats.postsPerWeek,
          topTopics: topics.map((t) => ({ topic: t.topic, score: t.score })),
        };
      }),
    );

    return enriched;
  }),

  /** Full detail view for one competitor (ownership-checked). */
  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const cacheKey = `${ctx.user.id}:${input.id}`;
      const cached = getCache.get(cacheKey);
      if (cached && Date.now() - cached.at < GET_CACHE_TTL_MS) {
        return cached.data;
      }

      const { competitor } = await assertOwnedCompetitor(ctx.user.id, input.id);
      const { getDb } = await import("../db");
      const { competitorSources, competitorContent, competitorTopics, competitorGaps } =
        await import("../../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      const { summaryStats } = await import("../services/radarService");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [sources, content, topics, gaps, stats] = await Promise.all([
        db.select().from(competitorSources).where(eq(competitorSources.competitorId, input.id)),
        db
          .select()
          .from(competitorContent)
          .where(eq(competitorContent.competitorId, input.id))
          .orderBy(desc(competitorContent.publishedAt))
          .limit(20),
        db
          .select()
          .from(competitorTopics)
          .where(eq(competitorTopics.competitorId, input.id))
          .orderBy(desc(competitorTopics.score)),
        db
          .select()
          .from(competitorGaps)
          .where(eq(competitorGaps.competitorId, input.id))
          .orderBy(desc(competitorGaps.opportunityScore)),
        summaryStats(input.id),
      ]);

      // Activity timeline: items per ISO week. Computed in JS to stay
      // only_full_group_by-safe (no SQL GROUP BY needed here).
      const weekCounts = new Map<string, number>();
      for (const c of content.length ? content : []) {
        const when = c.publishedAt ? new Date(c.publishedAt) : c.createdAt ? new Date(c.createdAt) : null;
        if (!when) continue;
        const wk = isoWeek(when);
        weekCounts.set(wk, (weekCounts.get(wk) || 0) + 1);
      }
      // Pull a wider window for the timeline (not just the 20 recent items).
      const allContent = await db
        .select()
        .from(competitorContent)
        .where(eq(competitorContent.competitorId, input.id));
      weekCounts.clear();
      for (const c of allContent) {
        const when = c.publishedAt ? new Date(c.publishedAt) : c.createdAt ? new Date(c.createdAt) : null;
        if (!when) continue;
        weekCounts.set(isoWeek(when), (weekCounts.get(isoWeek(when)) || 0) + 1);
      }
      const timeline = Array.from(weekCounts.entries())
        .map(([week, count]) => ({ week, count }))
        .sort((a, b) => (a.week < b.week ? -1 : a.week > b.week ? 1 : 0))
        .slice(-12);

      const data = {
        competitor: {
          id: competitor.id,
          name: competitor.name,
          website: competitor.website ?? null,
          aiSummary: competitor.aiSummary ?? null,
          createdAt: competitor.createdAt,
        },
        sources: sources.map((s) => ({ id: s.id, type: s.type, url: s.url, lastFetch: s.lastFetch })),
        content: content.map((c) => ({
          id: c.id,
          title: c.title,
          url: c.url,
          publishedAt: c.publishedAt,
          summary: c.summary,
          sourceId: c.sourceId,
        })),
        topics: topics.map((t) => ({ topic: t.topic, score: t.score })),
        gaps: gaps.map((g) => ({ topic: g.topic, opportunityScore: g.opportunityScore })),
        timeline,
        stats,
      };

      getCache.set(cacheKey, { at: Date.now(), data });
      return data;
    }),

  /** Manually sync + analyze a competitor; returns the refreshed summary. */
  sync: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnedCompetitor(ctx.user.id, input.id);
      const { syncCompetitor, analyzeCompetitor, summaryStats } =
        await import("../services/radarService");
      const sync = await syncCompetitor(input.id);
      const analysis = await analyzeCompetitor(input.id);
      const stats = await summaryStats(input.id);
      getCache.delete(`${ctx.user.id}:${input.id}`);
      return { ...sync, ...analysis, stats };
    }),

  /** Delete a competitor and all of its radar data (ownership-checked). */
  remove: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = await assertOwnedCompetitor(ctx.user.id, input.id);
      const {
        competitors,
        competitorSources,
        competitorContent,
        competitorTopics,
        competitorGaps,
      } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      await db.delete(competitorSources).where(eq(competitorSources.competitorId, input.id));
      await db.delete(competitorContent).where(eq(competitorContent.competitorId, input.id));
      await db.delete(competitorTopics).where(eq(competitorTopics.competitorId, input.id));
      await db.delete(competitorGaps).where(eq(competitorGaps.competitorId, input.id));
      await db.delete(competitors).where(eq(competitors.id, input.id));
      getCache.delete(`${ctx.user.id}:${input.id}`);
      return { success: true };
    }),
});
