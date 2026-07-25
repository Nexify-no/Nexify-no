/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * Multi-brand foundation (MB1, behind FEATURE_MULTI_BRAND).
 *
 * account_id === users.id. All scoping derives from the session user — never
 * from client input. Legacy data is adopted lazily and safely: the first time
 * an account touches the brands API, we create ONE default brand from its
 * existing Merkehjerne and link the account's legacy rows to it. We never
 * guess across identities; the LinkedIn connection is only linked while the
 * account has exactly one brand (otherwise it stays unassigned until the user
 * chooses — see MB2 needs_brand_assignment).
 */

import { and, eq, isNull } from "drizzle-orm";
import {
  brands,
  brandProfiles,
  posts,
  scheduledPosts,
  contentPlans,
  plannedPosts,
  contentSchedule,
  linkedinConnections,
  users,
  type Brand,
} from "../../drizzle/schema";
import { getDb } from "../db";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

/** List the account's non-archived brands (oldest first). */
export async function listBrands(accountId: number): Promise<Brand[]> {
  const db = await requireDb();
  return db
    .select()
    .from(brands)
    .where(and(eq(brands.accountId, accountId), eq(brands.brandStatus, "active")))
    .orderBy(brands.id);
}

/**
 * Ensure the account has at least one brand and an active_brand_id, adopting
 * legacy single-brand data on first use. Idempotent; returns the active brand id.
 */
export async function ensureDefaultBrand(accountId: number): Promise<number> {
  const db = await requireDb();
  const existing = await listBrands(accountId);
  let brandId: number;

  if (existing.length > 0) {
    brandId = existing[0].id;
  } else {
    // Seed the default brand from the account's existing Merkehjerne when present.
    const [bp] = await db
      .select()
      .from(brandProfiles)
      .where(eq(brandProfiles.userId, accountId))
      .limit(1);
    await db.insert(brands).values({
      accountId,
      name: bp?.companyName?.trim() || "Min bedrift",
      websiteUrl: bp?.websiteUrl ?? null,
      industry: bp?.industry ?? null,
      description: bp?.summary ?? null,
    });
    const created = await listBrands(accountId);
    brandId = created[0].id;
  }

  // Link legacy rows (only rows still without a brand — never overwrite).
  await db.update(brandProfiles).set({ brandId })
    .where(and(eq(brandProfiles.userId, accountId), isNull(brandProfiles.brandId)));
  await db.update(posts).set({ brandId })
    .where(and(eq(posts.userId, accountId), isNull(posts.brandId)));
  await db.update(scheduledPosts).set({ brandId })
    .where(and(eq(scheduledPosts.userId, accountId), isNull(scheduledPosts.brandId)));
  await db.update(contentPlans).set({ brandId })
    .where(and(eq(contentPlans.userId, accountId), isNull(contentPlans.brandId)));
  await db.update(plannedPosts).set({ brandId })
    .where(and(eq(plannedPosts.userId, accountId), isNull(plannedPosts.brandId)));
  await db.update(contentSchedule).set({ brandId })
    .where(and(eq(contentSchedule.userId, accountId), isNull(contentSchedule.brandId)));

  // Social connection: safe to adopt ONLY while the account has exactly one brand.
  const all = await listBrands(accountId);
  if (all.length === 1) {
    await db.update(linkedinConnections).set({ brandId })
      .where(and(eq(linkedinConnections.userId, accountId), isNull(linkedinConnections.brandId)));
  }

  // Active brand: set when missing or pointing at a brand this account no longer has.
  const [me] = await db.select({ active: users.activeBrandId }).from(users).where(eq(users.id, accountId)).limit(1);
  const activeIsValid = me?.active != null && all.some((b) => b.id === me.active);
  if (!activeIsValid) {
    await db.update(users).set({ activeBrandId: brandId }).where(eq(users.id, accountId));
    return brandId;
  }
  return me!.active as number;
}

/** The account's active brand id (bootstraps the default brand when needed). */
export async function getActiveBrandId(accountId: number): Promise<number> {
  return ensureDefaultBrand(accountId);
}

/**
 * The active brand id, or null when multi-brand is OFF (so callers fall back to
 * the previous account-wide behaviour). Never throws — scoping must not break a
 * read path.
 */
export async function getActiveBrandIdIfEnabled(accountId: number): Promise<number | null> {
  try {
    const { ENV } = await import("../_core/env");
    if (!ENV.featureMultiBrand) return null;
    return await getActiveBrandId(accountId);
  } catch {
    return null;
  }
}
