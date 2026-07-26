/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

// Multi-brand management (MB1, behind FEATURE_MULTI_BRAND).
// Account and permissions ALWAYS come from the session (ctx.user.id) — a client
// can never operate on another account's brands by sending ids.

import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { brandProfiles, brands, users } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { aiProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { ensureDefaultBrand, listBrands } from "../services/brands";

function requireMultiBrand() {
  if (!ENV.featureMultiBrand) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Multi-brand er ikke aktivert." });
  }
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Databasen er ikke tilgjengelig." });
  return db;
}

/** Ownership check: the brand must belong to the session account. */
async function requireOwnBrand(accountId: number, brandId: number) {
  const db = await requireDb();
  const [brand] = await db
    .select()
    .from(brands)
    .where(and(eq(brands.id, brandId), eq(brands.accountId, accountId)))
    .limit(1);
  if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "Merkevaren finnes ikke." });
  return brand;
}

/**
 * Ownership AND readiness: the brand must be a real, active one (PR #80).
 *
 * `startFromUrl` returns the draft's id to the browser, so a draft id is
 * client-known. Ownership alone was not enough:
 *
 *  - `classify` on a draft moved every unowned legacy row onto it; `discardDraft`
 *    then hard-deleted the brand, leaving those rows pointing at a brand that no
 *    longer exists — invisible in every brand AND no longer NULL, so gone from
 *    "Uklassifisert" too. Unrecoverable through the UI.
 *  - `archive` on a draft made it permanently stuck: discardDraft refuses a
 *    non-draft, and startFromUrl no longer reuses a non-draft.
 */
async function requireActiveBrand(accountId: number, brandId: number) {
  const brand = await requireOwnBrand(accountId, brandId);
  if (brand.brandStatus !== "active") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: brand.brandStatus === "draft"
        ? "Fullfør oppsettet av merkevaren først."
        : "Merkevaren er arkivert.",
    });
  }
  return brand;
}

export const brandsRouter = router({
  /** Client feature gate (mirrors plan.flags pattern). */
  flags: protectedProcedure.query(() => ({ enabled: ENV.featureMultiBrand })),

  /** Active brands + which one is selected. Bootstraps legacy data on first call. */
  list: protectedProcedure.query(async ({ ctx }) => {
    requireMultiBrand();
    const activeBrandId = await ensureDefaultBrand(ctx.user.id);
    const all = await listBrands(ctx.user.id);
    return { activeBrandId, brands: all };
  }),

  // `create` (name-only, instantly active, no Merkehjerne) is GONE as of PR #80.
  //
  // It is the behaviour this PR set out to remove: it minted an active brand with
  // nothing to ground content in, so the new brand's first generated post had no
  // voice, no facts and no colours. Leaving it as an unused endpoint would have
  // kept that path reachable over tRPC while the UI pretended it did not exist.
  // Use startFromUrl → confirmFromUrl instead.

  // ── PR #80: "Legg til merkevare" as a short journey ──────────────────────
  //
  //   startFromUrl → (poll) journey → confirm
  //
  // The brand row is created FIRST, as a `draft`, and the analysis writes
  // straight into it. That is what makes the acceptance criterion structural
  // rather than hopeful: the brand, its Merkehjerne and its website link share
  // one brand_id from the first INSERT, with nothing to re-parent afterwards.
  //
  // A `draft` brand is invisible to listBrands (which filters on 'active'), so
  // it cannot be selected, cannot appear in the switcher, and — because
  // getActiveBrandId only ever returns an owned active brand — cannot be the
  // source of any generated content before it is confirmed.

  /**
   * Step 1: the user pastes a website address. Nothing else is required.
   *
   * Creates the draft brand, then analyses the site into it. The name comes from
   * the analysis, not from the user.
   */
  startFromUrl: aiProcedure
    .input(z.object({ websiteUrl: z.string().trim().min(3).max(1_000) }).strict())
    .mutation(async ({ ctx, input }) => {
      requireMultiBrand();
      // Bootstrap first: an account with no brand at all must not end up with the
      // draft as its only one.
      await ensureDefaultBrand(ctx.user.id);
      const db = await requireDb();

      // Reuse an abandoned draft rather than piling them up on repeated attempts.
      const [stale] = await db
        .select()
        .from(brands)
        .where(and(
          eq(brands.accountId, ctx.user.id),
          eq(brands.brandStatus, "draft"),
        ))
        .orderBy(desc(brands.id))
        .limit(1);

      let brandId: number;
      let createdHere = false;
      if (stale) {
        brandId = stale.id;
        await db.update(brands)
          .set({ websiteUrl: input.websiteUrl })
          .where(and(eq(brands.id, brandId), eq(brands.accountId, ctx.user.id)));
      } else {
        // $returningId, not "insert then select the newest draft". Two concurrent
        // calls (double-click, two tabs) both read back the SAME highest id: one
        // draft is orphaned with no id ever returned to a client — so discard can
        // never reach it — and both requests then analyse the same brand, where
        // the loser's analysisId-pinned update matches nothing while still
        // charging quota.
        const [inserted] = await db.insert(brands).values({
          accountId: ctx.user.id,
          // A placeholder only — replaced by the analysed company name on confirm.
          name: "Ny merkevare",
          websiteUrl: input.websiteUrl,
          brandStatus: "draft",
        }).$returningId();
        if (!inserted?.id) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Kunne ikke opprette merkevaren." });
        }
        brandId = inserted.id;
        createdHere = true;
      }

      const { analyzeIntoBrand, publicFailure } = await import("../services/merkehjerne/analyzeIntoBrand");
      try {
        const profile = await analyzeIntoBrand(ctx.user.id, brandId, input.websiteUrl);
        return { brandId, profile };
      } catch (error) {
        // The client never receives brandId when this throws, so a draft created
        // in THIS call would be unreachable — discardDraft could not find it and
        // the user has no id to pass. Clean up what we made; a reused draft stays,
        // because its id was already handed out once and retrying is the point.
        if (createdHere) {
          try {
            await db.delete(brandProfiles).where(and(
              eq(brandProfiles.userId, ctx.user.id),
              eq(brandProfiles.brandId, brandId),
            ));
            await db.delete(brands).where(and(
              eq(brands.id, brandId),
              eq(brands.accountId, ctx.user.id),
              eq(brands.brandStatus, "draft"),
            ));
          } catch (cleanup) {
            console.warn("[brands.startFromUrl] draft cleanup failed:", (cleanup as Error)?.message);
          }
        }
        throw new TRPCError(publicFailure(error));
      }
    }),

  /** Step 2: the draft brand and the Merkehjerne to review. */
  journey: protectedProcedure
    .input(z.object({ brandId: z.number().int().positive() }).strict())
    .query(async ({ ctx, input }) => {
      requireMultiBrand();
      const db = await requireDb();
      const [brand] = await db
        .select()
        .from(brands)
        .where(and(eq(brands.id, input.brandId), eq(brands.accountId, ctx.user.id)))
        .limit(1);
      if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "Merkevaren finnes ikke." });
      const [profile] = await db
        .select()
        .from(brandProfiles)
        .where(and(eq(brandProfiles.userId, ctx.user.id), eq(brandProfiles.brandId, input.brandId)))
        .orderBy(brandProfiles.id)
        .limit(1);
      return { brand, profile: profile ?? null };
    }),

  /**
   * Step 3: the user confirms what they reviewed, and only now does the brand
   * become real — named, active, selected, and its Merkehjerne marked confirmed.
   */
  confirmFromUrl: protectedProcedure
    .input(z.object({
      brandId: z.number().int().positive(),
      /** Optional correction of the analysed company name. */
      name: z.string().trim().min(1).max(255).optional(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      requireMultiBrand();
      const brand = await requireOwnBrand(ctx.user.id, input.brandId);
      // Only a draft may be confirmed. Accepting an already-active brand here
      // would let a caller rename a live brand, overwrite its website, industry
      // and description from its profile, and stamp confirmedAt on a Merkehjerne
      // nobody reviewed — the exact opposite of what this endpoint is for.
      if (brand.brandStatus !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Denne merkevaren er allerede opprettet." });
      }
      const db = await requireDb();

      const [profile] = await db
        .select()
        .from(brandProfiles)
        .where(and(eq(brandProfiles.userId, ctx.user.id), eq(brandProfiles.brandId, input.brandId)))
        .orderBy(brandProfiles.id)
        .limit(1);
      // No confirmation without something to confirm — otherwise the journey could
      // mint an active brand with an empty Merkehjerne, and every downstream tool
      // would silently fall back to generic output.
      if (!profile || profile.status !== "ready") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Analysen er ikke ferdig ennå." });
      }

      await db
        .update(brandProfiles)
        .set({ confirmedAt: new Date() })
        .where(and(
          eq(brandProfiles.userId, ctx.user.id),
          eq(brandProfiles.brandId, input.brandId),
          eq(brandProfiles.status, "ready"),
        ))
        .orderBy(brandProfiles.id)
        .limit(1);

      await db
        .update(brands)
        .set({
          name: input.name?.trim() || profile.companyName?.trim() || brand.name,
          websiteUrl: profile.websiteUrl ?? brand.websiteUrl,
          industry: profile.industry ?? brand.industry,
          description: profile.summary ?? brand.description,
          brandStatus: "active",
        })
        .where(and(eq(brands.id, input.brandId), eq(brands.accountId, ctx.user.id)));

      // Switching now is the point: every example, list and generator reads the
      // active brand, so they all change over together.
      await db.update(users).set({ activeBrandId: input.brandId }).where(eq(users.id, ctx.user.id));

      const all = await listBrands(ctx.user.id);
      return { activeBrandId: input.brandId, brands: all };
    }),

  /** The user backed out. Remove the draft and its half-built Merkehjerne. */
  discardDraft: protectedProcedure
    .input(z.object({ brandId: z.number().int().positive() }).strict())
    .mutation(async ({ ctx, input }) => {
      requireMultiBrand();
      const brand = await requireOwnBrand(ctx.user.id, input.brandId);
      // Only ever a draft: this must not become a way to delete a real brand.
      if (brand.brandStatus !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Bare utkast kan forkastes." });
      }
      const db = await requireDb();
      await db.delete(brandProfiles).where(and(
        eq(brandProfiles.userId, ctx.user.id),
        eq(brandProfiles.brandId, input.brandId),
      ));
      await db.delete(brands).where(and(
        eq(brands.id, input.brandId),
        eq(brands.accountId, ctx.user.id),
        eq(brands.brandStatus, "draft"),
      ));
      return { discarded: true };
    }),

  /**
   * PR #79 — "Uklassifisert".
   *
   * Rows that predate multi-brand and could not be adopted unambiguously (the
   * account already had several brands). They are deliberately invisible inside
   * every brand; this is the one place they are reachable, so the user can say
   * which brand they belong to.
   */
  unclassified: protectedProcedure.query(async ({ ctx }) => {
    requireMultiBrand();
    const { countUnclassified } = await import("../services/brandScope");
    const counts = await countUnclassified(ctx.user.id);
    return { items: counts, total: counts.reduce((n, c) => n + c.count, 0) };
  }),

  /** Assign this account's unowned rows to one brand. Cannot move owned rows. */
  classify: protectedProcedure
    .input(z.object({
      brandId: z.number().int().positive(),
      keys: z.array(z.string().min(1).max(40)).min(1).optional(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      requireMultiBrand();
      await requireActiveBrand(ctx.user.id, input.brandId);
      const { assignUnclassified } = await import("../services/brandScope");
      return assignUnclassified(ctx.user.id, input.brandId, input.keys);
    }),

  setActive: protectedProcedure
    .input(z.object({ brandId: z.number().int().positive() }).strict())
    .mutation(async ({ ctx, input }) => {
      requireMultiBrand();
      // PR #80: this also excludes a `draft` brand mid-journey. Selecting one
      // would let every generator read an unconfirmed Merkehjerne, which is
      // exactly what "no content before confirmation" forbids.
      await requireActiveBrand(ctx.user.id, input.brandId);
      const db = await requireDb();
      await db.update(users).set({ activeBrandId: input.brandId }).where(eq(users.id, ctx.user.id));
      return { activeBrandId: input.brandId };
    }),

  archive: protectedProcedure
    .input(z.object({ brandId: z.number().int().positive() }).strict())
    .mutation(async ({ ctx, input }) => {
      requireMultiBrand();
      await requireActiveBrand(ctx.user.id, input.brandId);
      const all = await listBrands(ctx.user.id);
      if (all.length <= 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Kontoen må ha minst én aktiv merkevare." });
      }
      const db = await requireDb();
      await db.update(brands)
        .set({ brandStatus: "archived", archivedAt: new Date() })
        .where(and(eq(brands.id, input.brandId), eq(brands.accountId, ctx.user.id)));
      // If the archived brand was active, fall back to the oldest remaining brand.
      const remaining = await listBrands(ctx.user.id);
      const [me] = await db.select({ active: users.activeBrandId }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
      const activeStillValid = remaining.some((b) => b.id === me?.active);
      const nextActive = activeStillValid ? (me!.active as number) : remaining[0].id;
      if (!activeStillValid) {
        await db.update(users).set({ activeBrandId: nextActive }).where(eq(users.id, ctx.user.id));
      }
      return { activeBrandId: nextActive };
    }),
});
