/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

// Multi-brand management (MB1, behind FEATURE_MULTI_BRAND).
// Account and permissions ALWAYS come from the session (ctx.user.id) — a client
// can never operate on another account's brands by sending ids.

import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { brands, users } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { protectedProcedure, router } from "../_core/trpc";
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

  create: protectedProcedure
    .input(z.object({
      name: z.string().trim().min(1).max(255),
      websiteUrl: z.string().trim().max(1000).optional(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      requireMultiBrand();
      await ensureDefaultBrand(ctx.user.id);
      const db = await requireDb();
      await db.insert(brands).values({
        accountId: ctx.user.id,
        name: input.name,
        websiteUrl: input.websiteUrl || null,
      });
      const all = await listBrands(ctx.user.id);
      const created = all[all.length - 1];
      // Switch to the new brand right away — the natural "add brand" flow.
      await db.update(users).set({ activeBrandId: created.id }).where(eq(users.id, ctx.user.id));
      return { brand: created, activeBrandId: created.id };
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
      await requireOwnBrand(ctx.user.id, input.brandId);
      const { assignUnclassified } = await import("../services/brandScope");
      return assignUnclassified(ctx.user.id, input.brandId, input.keys);
    }),

  setActive: protectedProcedure
    .input(z.object({ brandId: z.number().int().positive() }).strict())
    .mutation(async ({ ctx, input }) => {
      requireMultiBrand();
      const brand = await requireOwnBrand(ctx.user.id, input.brandId);
      if (brand.brandStatus !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Kan ikke bytte til en arkivert merkevare." });
      }
      const db = await requireDb();
      await db.update(users).set({ activeBrandId: input.brandId }).where(eq(users.id, ctx.user.id));
      return { activeBrandId: input.brandId };
    }),

  archive: protectedProcedure
    .input(z.object({ brandId: z.number().int().positive() }).strict())
    .mutation(async ({ ctx, input }) => {
      requireMultiBrand();
      await requireOwnBrand(ctx.user.id, input.brandId);
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
