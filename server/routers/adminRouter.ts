/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

/**
 * Admin Router - User Management and Analytics
 * Requires admin role for all procedures
 */

const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only administrators can access this resource",
    });
  }
  return next({ ctx });
});

export const adminRouter = router({
  // Grant/comp a subscription tier to a user and reset their current usage meter.
  // Admin-only (e.g. owner comping their own/a customer's account, no Stripe).
  setSubscription: adminProcedure
    .input(
      z.object({
        userId: z.number().int().positive().optional(),
        email: z.string().email().optional(),
        tier: z.enum(["FREE", "PRO", "PREMIUM"]),
      })
    )
    .mutation(async ({ input }) => {
      const { getDb, getUserByEmail, getPlanIdByTier } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      let userId = input.userId;
      if (!userId && input.email) {
        const u = await getUserByEmail(input.email);
        userId = u?.id;
      }
      if (!userId) throw new TRPCError({ code: "BAD_REQUEST", message: "User not found (pass userId or email)" });

      const planId = input.tier === "FREE" ? null : await getPlanIdByTier(input.tier);
      const { subscriptions, userUsageTracking } = await import("../../drizzle/schema");
      const { eq, and, gte, lte } = await import("drizzle-orm");

      const status = input.tier === "FREE" ? ("trial" as const) : ("active" as const);
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);

      const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
      if (sub) {
        await db
          .update(subscriptions)
          .set({
            status,
            planId: planId ?? null,
            subscriptionStartDate: new Date(),
            subscriptionEndDate: input.tier === "FREE" ? null : endDate,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, sub.id));
      } else {
        await db.insert(subscriptions).values({
          userId,
          status,
          planId: planId ?? null,
          postsGenerated: 0,
          trialPostsLimit: 2,
          subscriptionStartDate: new Date(),
          subscriptionEndDate: input.tier === "FREE" ? null : endDate,
        });
      }

      // Reset the current-period usage meter so they can generate immediately.
      const now = new Date();
      await db
        .update(userUsageTracking)
        .set({ postsUsed: 0 })
        .where(
          and(
            eq(userUsageTracking.userId, userId),
            gte(userUsageTracking.periodEndDate, now),
            lte(userUsageTracking.periodStartDate, now)
          )
        );

      return { success: true, userId, tier: input.tier, planId: planId ?? null };
    }),

  // Get all users with pagination and filtering
  getAllUsers: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        role: z.enum(["admin", "user"]).optional(),
        sortBy: z.enum(["createdAt", "lastSignedIn", "email"]).default("createdAt"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(async ({ input }) => {
      try {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { users } = await import("../../drizzle/schema");
        const { eq, like, desc, asc, and, sql } = await import("drizzle-orm");

        // Build where clause
        const whereConditions = [];
        
        if (input.search) {
          whereConditions.push(
            like(users.email, `%${input.search}%`)
          );
        }
        
        if (input.role) {
          whereConditions.push(eq(users.role, input.role));
        }

        // SECURITY: never select() the whole row — users holds passwordHash,
        // twoFactorSecret and twoFactorBackupCodes. Project safe columns only.
        const safeUserCols = {
          id: users.id, name: users.name, email: users.email,
          loginMethod: users.loginMethod, role: users.role,
          createdAt: users.createdAt, updatedAt: users.updatedAt,
          lastSignedIn: users.lastSignedIn, avatarUrl: users.avatarUrl,
          emailVerified: users.emailVerified, twoFactorEnabled: users.twoFactorEnabled,
        };

        // Build query
        let query = db.select(safeUserCols).from(users) as any;

        if (whereConditions.length > 0) {
          query = query.where(and(...whereConditions));
        }

        // Sort
        const sortColumn = input.sortBy === "createdAt" ? users.createdAt 
          : input.sortBy === "lastSignedIn" ? users.lastSignedIn 
          : users.email;
        
        const sortFn = input.sortOrder === "desc" ? desc : asc;
        query = query.orderBy(sortFn(sortColumn));

        // Paginate
        const offset = (input.page - 1) * input.limit;
        const data = await query.limit(input.limit).offset(offset);

        // Total via COUNT(*) (no full-table row load).
        const countRows = await (db
          .select({ n: sql`count(*)` })
          .from(users)
          .where(whereConditions.length > 0 ? and(...whereConditions) : undefined) as any);
        const total = Number(countRows?.[0]?.n ?? 0);

        return {
          data,
          pagination: {
            page: input.page,
            limit: input.limit,
            total,
            pages: Math.ceil(total / input.limit),
          },
        };
      } catch (error) {
        console.error("Error fetching users:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch users",
        });
      }
    }),

  // Get user statistics
  getUserStats: adminProcedure.query(async () => {
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { users } = await import("../../drizzle/schema");

      // Only load the columns the aggregation needs — never passwordHash/2FA secrets.
      const allUsers = await db.select({
        role: users.role, lastSignedIn: users.lastSignedIn, createdAt: users.createdAt,
      }).from(users);

      const totalUsers = allUsers.length;
      const adminCount = allUsers.filter((u) => u.role === "admin").length;
      const userCount = allUsers.filter((u) => u.role === "user").length;

      // Calculate active users (signed in last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const activeUsers = allUsers.filter((u) => {
        const lastSignedIn = new Date(u.lastSignedIn || 0);
        return lastSignedIn > thirtyDaysAgo;
      }).length;

      // Calculate new users (created in last 30 days)
      const newUsers = allUsers.filter((u) => {
        const createdAt = new Date(u.createdAt || 0);
        return createdAt > thirtyDaysAgo;
      }).length;

      return {
        totalUsers,
        adminCount,
        userCount,
        activeUsers,
        newUsers,
        activePercentage: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0,
      };
    } catch (error) {
      console.error("Error fetching user stats:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch user statistics",
      });
    }
  }),

  // Get single user details
  getUserDetails: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      try {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { users } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        // SECURITY: explicit safe projection — exclude passwordHash / twoFactorSecret
        // / twoFactorBackupCodes so secret material never leaves the DB.
        const safeUserCols = {
          id: users.id, name: users.name, email: users.email,
          loginMethod: users.loginMethod, role: users.role,
          createdAt: users.createdAt, updatedAt: users.updatedAt,
          lastSignedIn: users.lastSignedIn, avatarUrl: users.avatarUrl,
          emailVerified: users.emailVerified, twoFactorEnabled: users.twoFactorEnabled,
        };
        const user = await db
          .select(safeUserCols)
          .from(users)
          .where(eq(users.id, input.userId))
          .limit(1);

        if (!user || user.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        return user[0];
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error fetching user details:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch user details",
        });
      }
    }),

  // Get user activity log
  getUserActivity: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      try {
        // Real activity log (was previously a hardcoded mock identical for every user).
        const { getUserActivityLog } = await import("../services/activityLogger");
        const uid = parseInt(input.userId, 10);
        const logs = await getUserActivityLog(uid, input.page * input.limit);
        const mapped = logs.map((l: any) => ({
          id: String(l.id),
          userId: input.userId,
          type: l.activityType,
          description: l.description ?? "",
          timestamp: l.createdAt,
          ipAddress: l.ipAddress ?? null,
          success: l.success === 1,
        }));

        const offset = (input.page - 1) * input.limit;
        const data = mapped.slice(offset, offset + input.limit);
        const total = mapped.length;

        return {
          data,
          pagination: {
            page: input.page,
            limit: input.limit,
            total,
            pages: Math.ceil(total / input.limit),
          },
        };
      } catch (error) {
        console.error("Error fetching user activity:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch user activity",
        });
      }
    }),

  // Update user role
  updateUserRole: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        role: z.enum(["admin", "user"]),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { users } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        await db
          .update(users)
          .set({ role: input.role, updatedAt: new Date() })
          .where(eq(users.id, input.userId));

        return { success: true };
      } catch (error) {
        console.error("Error updating user role:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update user role",
        });
      }
    }),

  // Delete user
  deleteUser: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { users } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        await db.delete(users).where(eq(users.id, input.userId));

        return { success: true };
      } catch (error) {
        console.error("Error deleting user:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete user",
        });
      }
    }),
});