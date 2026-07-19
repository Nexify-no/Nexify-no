import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { brandProfiles } from "../../drizzle/schema";
import { getDb } from "../db";
import { aiProcedure, protectedProcedure, router } from "../_core/trpc";
import { analyzeBrandWebsite } from "../brandAnalyzer";

const stringList = z.array(z.string().trim().min(1).max(300)).max(30);
const editableProfile = z.object({
  companyName: z.string().trim().min(1).max(255).optional(),
  industry: z.string().trim().max(255).optional(),
  summary: z.string().trim().max(2000).optional(),
  offers: stringList.optional(),
  audiences: stringList.optional(),
  customerProblems: stringList.optional(),
  differentiators: stringList.optional(),
  tonePersonality: stringList.optional(),
  writingStyle: z.string().trim().max(1500).optional(),
  preferredWords: stringList.optional(),
  avoidWords: stringList.optional(),
  callsToAction: stringList.optional(),
  contentPillars: stringList.optional(),
});

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Databasen er ikke tilgjengelig." });
  return db;
}

export const brandRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const [profile] = await db.select().from(brandProfiles).where(eq(brandProfiles.userId, ctx.user.id)).limit(1);
    return profile ?? null;
  }),

  analyze: aiProcedure.input(z.object({ websiteUrl: z.string().trim().min(3).max(1000) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const [existing] = await db.select({ id: brandProfiles.id }).from(brandProfiles).where(eq(brandProfiles.userId, ctx.user.id)).limit(1);
    if (existing) {
      await db.update(brandProfiles).set({ status: "analyzing", websiteUrl: input.websiteUrl, lastError: null }).where(eq(brandProfiles.userId, ctx.user.id));
    } else {
      await db.insert(brandProfiles).values({ userId: ctx.user.id, websiteUrl: input.websiteUrl, status: "analyzing" });
    }
    try {
      const result = await analyzeBrandWebsite(input.websiteUrl);
      await db.update(brandProfiles).set({ ...result, status: "ready", lastError: null, analyzedAt: new Date() }).where(eq(brandProfiles.userId, ctx.user.id));
      const [saved] = await db.select().from(brandProfiles).where(eq(brandProfiles.userId, ctx.user.id)).limit(1);
      return saved;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analysen mislyktes.";
      await db.update(brandProfiles).set({ status: "failed", lastError: message }).where(eq(brandProfiles.userId, ctx.user.id));
      throw new TRPCError({ code: "BAD_REQUEST", message });
    }
  }),

  update: protectedProcedure.input(editableProfile).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    await db.update(brandProfiles).set(input).where(and(eq(brandProfiles.userId, ctx.user.id), eq(brandProfiles.status, "ready")));
    const [saved] = await db.select().from(brandProfiles).where(eq(brandProfiles.userId, ctx.user.id)).limit(1);
    if (!saved) throw new TRPCError({ code: "NOT_FOUND", message: "Opprett Merkehjernen først." });
    return saved;
  }),
});
