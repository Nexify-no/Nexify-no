/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { router, adminProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { users, posts, subscriptions, subscriptionPlans } from "../drizzle/schema";
import { eq, gte, lt, desc, asc, and, or, like, sql } from "drizzle-orm";

export const memberMonitoringRouter = router({
  // Get all members with their activity summary
  getMembersList: adminProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(10),
        sortBy: z.enum(["name", "lastActive", "postsGenerated", "joinDate"]).default("lastActive"),
        search: z.string().trim().max(200).optional(),
        role: z.enum(["admin", "user"]).optional(),
        /** Account state — banned or not. */
        status: z.enum(["active", "suspended"]).optional(),
        /** Member ACTIVITY — signed in within 30 days, or not. A different question. */
        activity: z.enum(["active", "inactive"]).optional(),
      })
    )
    .query(async ({ input }: any) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      const offset = (input.page - 1) * input.limit;

      // The filter panel above this table used to be inert: MemberMonitoring
      // dropped its state on the floor (`const [, setFilters] = useState(...)`)
      // and this procedure accepted no filter input at all. Typing a name did
      // nothing, visibly.
      const where = [] as any[];
      if (input.search) {
        where.push(or(like(users.email, `%${input.search}%`), like(users.name, `%${input.search}%`)));
      }
      if (input.role) where.push(eq(users.role, input.role));
      if (input.status) where.push(eq(users.status, input.status));
      if (input.activity) {
        // Activity is about lastSignedIn, NOT about users.status. Conflating the
        // two would answer "show me dormant members" with "here are the people
        // you banned".
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        where.push(
          input.activity === "active" ? gte(users.lastSignedIn, cutoff) : lt(users.lastSignedIn, cutoff)
        );
      }
      const whereClause = where.length > 0 ? and(...where) : undefined;

      // `sortBy` was declared, defaulted and passed by the client — and then
      // never used, because the query had no orderBy. The list came back in
      // whatever order the storage engine felt like.
      const orderBy =
        input.sortBy === "name"
          ? asc(users.name)
          : input.sortBy === "joinDate"
            ? desc(users.createdAt)
            : desc(users.lastSignedIn);

      const members = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
          role: users.role,
          status: users.status,
        })
        .from(users)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(offset);

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(users)
        .where(whereClause);
      const total = countResult[0]?.count || 0;

      return {
        members,
        total,
        page: input.page,
        limit: input.limit,
        pages: Math.ceil(total / input.limit),
      };
    }),

  // Get detailed activity for a specific member
  getMemberActivity: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        days: z.number().default(30),
      })
    )
    .query(async ({ input }: any) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      // Get user info
      // SECURITY: project safe columns — never return passwordHash / 2FA secrets.
      const user = await db.select({
        id: users.id, name: users.name, email: users.email, role: users.role,
        createdAt: users.createdAt, lastSignedIn: users.lastSignedIn,
        avatarUrl: users.avatarUrl, emailVerified: users.emailVerified,
      }).from(users).where(eq(users.id, parseInt(input.userId))).limit(1);

      if (!user.length) {
        throw new Error("User not found");
      }

      // Get posts generated in the period
      const postsData = await db
        .select({
          date: sql<string>`DATE(${posts.createdAt})`,
          count: sql<number>`COUNT(*)`,
        })
        .from(posts)
        .where(
          and(
            eq(posts.userId, parseInt(input.userId)),
            gte(posts.createdAt, startDate)
          )
        )
        .groupBy(sql<string>`DATE(${posts.createdAt})`)
        .orderBy(desc(sql<string>`DATE(${posts.createdAt})`));

      // Get subscription info
      const subscription = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, parseInt(input.userId)))
        .limit(1);

      return {
        user: user[0],
        subscription: subscription[0],
        activity: postsData,
        period: {
          start: startDate,
          end: new Date(),
          days: input.days,
        },
      };
    }),

  // Get consumption metrics for a member
  getMemberConsumption: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }: any) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      const userId = parseInt(input.userId);

      // Get user subscription and usage
      const userWithStats = await db
        .select({
          userId: users.id,
          name: users.name,
          email: users.email,
          status: subscriptions.status,
          planName: subscriptionPlans.name,
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
          postsGenerated: subscriptions.postsGenerated,
        })
        .from(users)
        .leftJoin(subscriptions, eq(users.id, subscriptions.userId))
        .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
        .where(eq(users.id, userId));

      if (!userWithStats.length) {
        throw new Error("User not found");
      }

      const userData = userWithStats[0];

      // Quota from the plan the customer is actually on, via the single pricing
      // source of truth. Two earlier versions of this line were both wrong: the
      // original `status === "trial" ? 5 : 100` used numbers that appear nowhere
      // else in the product, and the first fix read the SUBSCRIPTION status and so
      // charged a Premium customer against Pro's cap. The plan name is the only
      // thing that actually says which tier was bought.
      const { getPlan } = await import("@shared/pricing");
      const planName = (userData.planName ?? "").trim();
      const quota =
        userData.status !== "active"
          ? getPlan("FREE").postsPerMonth
          : planName === "Premium"
            ? getPlan("PREMIUM").postsPerMonth
            : planName === "Gratis"
              ? getPlan("FREE").postsPerMonth
              : getPlan("PRO").postsPerMonth;
      const used = userData.postsGenerated || 0;
      const remaining = Math.max(0, quota - used);
      const percentageUsed = Math.round((used / quota) * 100);

      return {
        user: {
          id: userData.userId,
          name: userData.name,
          email: userData.email,
        },
        subscription: {
          status: userData.status || "trial",
        },
        consumption: {
          quota,
          used,
          remaining,
          percentageUsed,
        },
        timeline: {
          joinDate: userData.createdAt,
          lastActive: userData.lastSignedIn,
          daysActive: userData.lastSignedIn
            ? Math.floor(
                (new Date().getTime() - new Date(userData.lastSignedIn).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : 0,
        },
      };
    }),

  // Get overall consumption statistics
  getConsumptionStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    const stats = await db
      .select({
        status: subscriptions.status,
        memberCount: sql<number>`COUNT(DISTINCT ${users.id})`,
        totalPosts: sql<number>`COUNT(DISTINCT ${posts.id})`,
      })
      .from(subscriptions)
      .leftJoin(users, eq(subscriptions.userId, users.id))
      .leftJoin(posts, eq(users.id, posts.userId))
      .groupBy(subscriptions.status);

    return stats;
  }),
});