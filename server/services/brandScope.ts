/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * Brand ownership (PR #79, P0).
 *
 * ONE rule, enforced here so no call site has to remember it:
 *
 *   A row belongs to exactly one brand. A read for brand X returns brand X's
 *   rows and nothing else.
 *
 * What this replaces: every read used to widen its filter with
 * `OR brand_id IS NULL`, on the theory that unowned legacy rows should "stay
 * visible so nothing disappears". The effect was the opposite of harmless —
 * an unowned row became visible inside EVERY brand at once, so selecting Penna
 * showed Ballong's words, posts and links. Unowned rows are not everyone's;
 * they are nobody's. They are reachable only through the explicit
 * "Uklassifisert" surface below, where the user assigns them an owner.
 *
 * Multi-brand OFF is unchanged: `activeBrandId` returns null and every filter
 * degrades to the previous account-wide behaviour.
 */

import { TRPCError } from "@trpc/server";
import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { MySqlColumn } from "drizzle-orm/mysql-core";
import {
  contentPlans,
  contentSchedule,
  drafts,
  ideas,
  plannedPosts,
  posts,
  scheduledPosts,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { getActiveBrandIdIfEnabled } from "./brands";

/** The brand this request reads and writes, or null when multi-brand is OFF. */
export async function activeBrandId(accountId: number): Promise<number | null> {
  return getActiveBrandIdIfEnabled(accountId);
}

/**
 * Scope a query to (user, brand) with NO null fallback.
 *
 * This is the whole fix. Do not add `or(..., isNull(brandCol))` back — the
 * regression test in brandScope.isolation.test.ts fails if you do.
 */
export function ownedBy(
  userCol: MySqlColumn,
  brandCol: MySqlColumn,
  userId: number,
  brandId: number | null,
): SQL {
  if (brandId == null) return eq(userCol, userId);
  return and(eq(userCol, userId), eq(brandCol, brandId))!;
}

/** Rows this account owns that have no brand yet — the "Uklassifisert" bucket. */
export function unclassified(userCol: MySqlColumn, brandCol: MySqlColumn, userId: number): SQL {
  return and(eq(userCol, userId), isNull(brandCol))!;
}

/**
 * The brand a NEW row must be stamped with.
 *
 * With multi-brand ON, a write that cannot name its brand is a bug, not a
 * degraded success: saving it with NULL is exactly how the leak got its data.
 * Fail the save and tell the user to pick a brand instead.
 */
export async function requireWriteBrandId(accountId: number): Promise<number | null> {
  const brandId = await activeBrandId(accountId);
  const { ENV } = await import("../_core/env");
  if (!ENV.featureMultiBrand) return null;
  if (brandId == null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Velg en merkevare før du lagrer — innlegget må tilhøre én merkevare.",
    });
  }
  return brandId;
}

/** Tables that carry per-brand content and can therefore hold unowned rows. */
const OWNED_TABLES = [
  { key: "posts", label: "Innlegg", table: posts, user: posts.userId, brand: posts.brandId },
  { key: "ideas", label: "Idéer", table: ideas, user: ideas.userId, brand: ideas.brandId },
  { key: "drafts", label: "Utkast", table: drafts, user: drafts.userId, brand: drafts.brandId },
  { key: "scheduledPosts", label: "Planlagte innlegg", table: scheduledPosts, user: scheduledPosts.userId, brand: scheduledPosts.brandId },
  { key: "contentPlans", label: "Innholdsplaner", table: contentPlans, user: contentPlans.userId, brand: contentPlans.brandId },
  { key: "plannedPosts", label: "Planinnlegg", table: plannedPosts, user: plannedPosts.userId, brand: plannedPosts.brandId },
  { key: "contentSchedule", label: "Publiseringsplan", table: contentSchedule, user: contentSchedule.userId, brand: contentSchedule.brandId },
] as const;

export type UnclassifiedCount = { key: string; label: string; count: number };

/**
 * How much unowned data this account has, per table. Drives the "Uklassifisert"
 * section — which exists precisely so unowned rows do NOT need to be leaked
 * into every brand to remain reachable.
 */
export async function countUnclassified(accountId: number): Promise<UnclassifiedCount[]> {
  const db = await getDb();
  if (!db) return [];
  const out: UnclassifiedCount[] = [];
  for (const t of OWNED_TABLES) {
    try {
      const [row] = await db
        .select({ n: sql<number>`count(*)` })
        .from(t.table)
        .where(unclassified(t.user, t.brand, accountId));
      out.push({ key: t.key, label: t.label, count: Number(row?.n ?? 0) });
    } catch {
      // A missing column on an un-migrated environment must not break the page.
      out.push({ key: t.key, label: t.label, count: 0 });
    }
  }
  return out;
}

/**
 * Assign this account's unowned rows to one brand — the user's explicit answer
 * to "which brand does this belong to?".
 *
 * Scoped by user_id AND brand_id IS NULL, so it can only ever touch rows that
 * currently have no owner. It cannot move a row from one brand to another.
 */
export async function assignUnclassified(
  accountId: number,
  brandId: number,
  keys?: readonly string[],
): Promise<{ assigned: number }> {
  const db = await getDb();
  if (!db) return { assigned: 0 };
  let assigned = 0;
  for (const t of OWNED_TABLES) {
    if (keys && !keys.includes(t.key)) continue;
    try {
      const before = await db
        .select({ n: sql<number>`count(*)` })
        .from(t.table)
        .where(unclassified(t.user, t.brand, accountId));
      await db
        .update(t.table)
        .set({ brandId } as never)
        .where(unclassified(t.user, t.brand, accountId));
      assigned += Number(before[0]?.n ?? 0);
    } catch (err) {
      console.error(`[brandScope] could not classify ${t.key} for account ${accountId}:`, (err as Error)?.name);
    }
  }
  return { assigned };
}
