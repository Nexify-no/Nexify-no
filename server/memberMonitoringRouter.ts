/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { router, adminProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { users, posts, subscriptions } from "../drizzle/schema";
import { eq, gte, desc, and, sql } from "drizzle-orm";

export const memberMonitoringRouter = router({
  // Get all members with their activity summary
  getMembersList: adminProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(10),
        sortBy: z.enum(["name", "lastActive", "postsGenerated", "joinDate"]).default("lastActive"),
      })
    )
    .query(async ({ input }: any) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      
      const offset = (input.page - 1) * input.limit;

      // Get members list
      const members = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
          role: users.role,
        })
        .from(users)
        .limit(input.limit)
        .offset(offset);

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(users);
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
      const user = await db.select().from(users).where(eq(users.id, parseInt(input.userId))).limit(1);

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
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
          postsGenerated: subscriptions.postsGenerated,
        })
        .from(users)
        .leftJoin(subscriptions, eq(users.id, subscriptions.userId))
        .where(eq(users.id, userId));

      if (!userWithStats.length) {
        throw new Error("User not found");
      }

      const userData = userWithStats[0];

      // Calculate quota usage based on subscription status
      const quota = userData.status === "trial" ? 5 : 100;
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