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
  drafts,
  ideas,
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
    // PR #79: adopt into the brand the user is actually looking at, not blindly
    // the oldest one. With the NULL fallback gone, stamping an unowned
    // Merkehjerne onto the oldest brand while a different brand is active made
    // the profile read back as missing — an empty Merkehjerne page and AI
    // output silently degraded to generic.
    const [me] = await db
      .select({ active: users.activeBrandId })
      .from(users)
      .where(eq(users.id, accountId))
      .limit(1);
    const activeIsOwned = me?.active != null && existing.some((b) => b.id === me.active);
    brandId = activeIsOwned ? (me!.active as number) : existing[0].id;
  } else {
    // Seed the default brand from the account's existing Merkehjerne when present.
    // Oldest first: with PR #80 an account can hold a draft brand's unreviewed
    // profile, and that row is always the newest. Unordered, this seed could
    // name the default brand after a site the user never confirmed.
    const [bp] = await db
      .select()
      .from(brandProfiles)
      .where(eq(brandProfiles.userId, accountId))
      .orderBy(brandProfiles.id)
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

  // ---- Adopt legacy rows (only rows still without a brand — never overwrite) ----
  //
  // Adoption is BEST-EFFORT. It is a convenience migration, not the purpose of
  // this call, so a failure on one table must never take down brands.list — that
  // is what made the brand switcher disappear entirely instead of degrading.
  const adopt = async (label: string, run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (err) {
      const e = err as { code?: string; sqlState?: string };
      console.error(
        `[brands] legacy adoption skipped for ${label} (account ${accountId}, brand ${brandId}):`,
        e?.code ?? (err as Error)?.name ?? "unknown",
        e?.sqlState ?? "",
      );
    }
  };

  // brand_profiles carries UNIQUE(user_id, brand_id) since migration 0089, so a
  // blanket UPDATE collides in two ways: when a stamped row already occupies the
  // (user, brand) slot, and when several unstamped rows would be given the same
  // brand at once. Repeated "Analyser på nytt" attempts create exactly those
  // extra rows. Adopt at most ONE row, and only into a free slot.
  await adopt("brand_profiles", async () => {
    const [taken] = await db
      .select({ id: brandProfiles.id })
      .from(brandProfiles)
      .where(and(eq(brandProfiles.userId, accountId), eq(brandProfiles.brandId, brandId)))
      .limit(1);
    if (taken) return;

    const [oldest] = await db
      .select({ id: brandProfiles.id })
      .from(brandProfiles)
      .where(and(eq(brandProfiles.userId, accountId), isNull(brandProfiles.brandId)))
      .orderBy(brandProfiles.id)
      .limit(1);
    if (!oldest) return;

    await db.update(brandProfiles).set({ brandId }).where(eq(brandProfiles.id, oldest.id));
  });

  // PR #79 — adoption is only safe when the answer is unambiguous.
  //
  // An account with ONE brand: every unowned row can only have meant that brand,
  // so adopt it. An account with SEVERAL brands: we do not know, and guessing is
  // how Ballong's posts ended up under Penna. Those rows stay NULL and surface
  // under "Uklassifisert" for the user to assign (services/brandScope.ts).
  const all = await listBrands(accountId);
  const unambiguous = all.length === 1;

  if (unambiguous) {
    await adopt("posts", () => db.update(posts).set({ brandId })
      .where(and(eq(posts.userId, accountId), isNull(posts.brandId))));
    await adopt("ideas", () => db.update(ideas).set({ brandId })
      .where(and(eq(ideas.userId, accountId), isNull(ideas.brandId))));
    await adopt("drafts", () => db.update(drafts).set({ brandId })
      .where(and(eq(drafts.userId, accountId), isNull(drafts.brandId))));
    await adopt("scheduled_posts", () => db.update(scheduledPosts).set({ brandId })
      .where(and(eq(scheduledPosts.userId, accountId), isNull(scheduledPosts.brandId))));
    await adopt("content_plans", () => db.update(contentPlans).set({ brandId })
      .where(and(eq(contentPlans.userId, accountId), isNull(contentPlans.brandId))));
    await adopt("planned_posts", () => db.update(plannedPosts).set({ brandId })
      .where(and(eq(plannedPosts.userId, accountId), isNull(plannedPosts.brandId))));
    await adopt("content_schedule", () => db.update(contentSchedule).set({ brandId })
      .where(and(eq(contentSchedule.userId, accountId), isNull(contentSchedule.brandId))));
    await adopt("linkedin_connections", () => db.update(linkedinConnections).set({ brandId })
      .where(and(eq(linkedinConnections.userId, accountId), isNull(linkedinConnections.brandId))));
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
