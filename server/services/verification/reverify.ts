/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * Re-check content that was written before the current rules existed (PR #83).
 *
 * Verification ran once, at generation time, and the verdict was frozen. Two
 * problems with that:
 *
 *  - Every plan and post generated before verification existed carries the
 *    DEFAULT status, not a real judgement. An undocumented customer story from
 *    six months ago is still one click from being published.
 *  - When the rules get stricter — as they just did for customer stories — old
 *    content keeps its old, more permissive verdict forever.
 *
 * So opening a plan re-checks its posts. The checks are pure and local (no LLM,
 * no network), so this costs a regex pass per post, and the result is persisted
 * with `verifiedAt` so it is idempotent rather than rewriting rows on every read.
 *
 * Deliberately never RELAXES a status the user is acting on: it only ever writes
 * what the current rules say, which is the point — including when that clears a
 * flag the user has since fixed by adding a source.
 */

import { and, eq } from "drizzle-orm";
import { plannedPosts, posts, type VerificationIssueRecord } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { verifyPostContent, type BrandFactsSource, type VerificationStatus } from "./contentVerification";

/** Re-check anything whose verdict predates this. Bump when the rules change. */
export const RULES_VERSION_AT = new Date("2026-07-01T00:00:00.000Z");

function toRecords(issues: { code: string; message: string; evidence?: string }[]): VerificationIssueRecord[] {
  return issues.slice(0, 20).map((i) => ({
    code: i.code,
    message: i.message.slice(0, 300),
    ...(i.evidence ? { evidence: i.evidence.slice(0, 200) } : {}),
  }));
}

/** True when this row's verdict was produced by an older rule set (or never). */
export function needsRecheck(verifiedAt: Date | null | undefined): boolean {
  if (!verifiedAt) return true;
  return verifiedAt.getTime() < RULES_VERSION_AT.getTime();
}

/**
 * Re-verify the generated posts of one plan and persist any change.
 *
 * Best-effort by design: a failure here must never stop the user opening their
 * plan. Returns the rows it updated so the caller can reflect them without a
 * second read.
 */
export async function reverifyPlanPosts(input: {
  planId: number;
  userId: number;
  brand: BrandFactsSource | null | undefined;
  rows: Array<{
    id: number;
    content: string | null;
    generationStatus: string;
    suggestedDate: string | Date | null;
    verifiedAt: Date | null;
  }>;
}): Promise<Map<number, { status: VerificationStatus; issues: VerificationIssueRecord[] }>> {
  const out = new Map<number, { status: VerificationStatus; issues: VerificationIssueRecord[] }>();
  const db = await getDb();
  if (!db) return out;

  const done = input.rows.filter((r) => r.generationStatus === "done" && (r.content ?? "").trim());
  const stale = done.filter((r) => needsRecheck(r.verifiedAt));
  if (stale.length === 0) return out;

  // Siblings for the repetition check come from the whole plan, not just the stale
  // subset — otherwise re-checking one post would clear a duplicate flag.
  //
  // Excluded BY ID, not by value. Filtering by content removed every identical
  // copy, including the sibling, so two byte-identical posts each saw an empty
  // sibling list and both came back `verified` — then "Godkjenn alle sikre" swept
  // up the duplicate the generation-time check had correctly flagged.
  const byId = new Map(done.map((r) => [r.id, r.content ?? ""]));

  const now = new Date();
  for (const row of stale) {
    try {
      const siblings: string[] = [];
      for (const [id, text] of byId) if (id !== row.id && text) siblings.push(text);
      const result = verifyPostContent({
        content: row.content ?? "",
        brand: input.brand,
        publishAt: row.suggestedDate ? new Date(row.suggestedDate) : null,
        siblingContents: siblings,
      });
      const issues = toRecords(result.issues);
      await db
        .update(plannedPosts)
        .set({ verificationStatus: result.status, verificationIssues: issues, verifiedAt: now })
        .where(and(eq(plannedPosts.id, row.id), eq(plannedPosts.userId, input.userId)));
      out.set(row.id, { status: result.status, issues });
    } catch (e) {
      console.warn(`[reverify] plan ${input.planId} post ${row.id} skipped:`, (e as Error)?.message);
    }
  }
  return out;
}

/**
 * Re-verify one saved post against the account's current Merkehjerne.
 *
 * Used when a post is opened and before it may be published. A post created
 * before this column existed has a NULL status, which means "nobody has looked"
 * — not "fine".
 */
export async function reverifyPost(input: {
  postId: number;
  userId: number;
  content: string;
  brand: BrandFactsSource | null | undefined;
  scheduledFor?: Date | null;
  verifiedAt?: Date | null;
  /** Skip the write when the caller only wants the verdict. */
  persist?: boolean;
}): Promise<{ status: VerificationStatus; issues: VerificationIssueRecord[] } | null> {
  if (!input.content.trim()) return null;
  const result = verifyPostContent({
    content: input.content,
    brand: input.brand,
    publishAt: input.scheduledFor ?? null,
  });
  const issues = toRecords(result.issues);

  if (input.persist !== false) {
    const db = await getDb();
    if (db) {
      try {
        await db
          .update(posts)
          .set({ verificationStatus: result.status, verificationIssues: issues, verifiedAt: new Date() })
          .where(and(eq(posts.id, input.postId), eq(posts.userId, input.userId)));
      } catch (e) {
        console.warn(`[reverify] post ${input.postId} not persisted:`, (e as Error)?.message);
      }
    }
  }
  return { status: result.status, issues };
}

/**
 * The account's current Merkehjerne as a verification source.
 *
 * A saved post has no frozen snapshot the way a plan does, so it is checked
 * against the ACTIVE brand's live profile — which is also what makes "add the
 * source and the flag clears" work.
 */
export async function brandFactsForUser(
  userId: number,
  /**
   * The brand to check against. Pass the POST's brand.
   *
   * Defaulting to the active brand was the same mistake publishGuard forbids 90
   * lines above resolvePublishBrand: a scheduled Ballong post checked against
   * Penna's facts finds Ballong's documented price ungrounded, is refused as
   * high_risk, and the worker marks it failed with "sjekk LinkedIn-tilkoblingen"
   * — a post silently killed and the blame pointed at the wrong subsystem.
   */
  brandId?: number | null,
): Promise<BrandFactsSource | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const { brandProfiles } = await import("../../../drizzle/schema");
    const { activeBrandId, ownedBy } = await import("../brandScope");
    const scope = brandId !== undefined ? brandId : await activeBrandId(userId);
    const [bp] = await db
      .select()
      .from(brandProfiles)
      .where(ownedBy(brandProfiles.userId, brandProfiles.brandId, userId, scope))
      .orderBy(brandProfiles.id)
      .limit(1);
    if (!bp) return null;
    return {
      facts: bp.facts ?? null,
      summary: bp.summary,
      offers: bp.offers,
      differentiators: bp.differentiators,
      websiteUrl: bp.websiteUrl,
    };
  } catch (e) {
    // Louder than a bare `return null`: the publish check treats "no profile" as
    // "nothing to check against" and passes, so a silent failure here silently
    // disables the guard.
    console.warn(`[reverify] no brand facts for user ${userId}:`, (e as Error)?.message);
    return null;
  }
}
