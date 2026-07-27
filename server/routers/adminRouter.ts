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
        status: z.enum(["active", "suspended", "deleted"]).optional(),
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
        const { eq, like, or, desc, asc, and, sql } = await import("drizzle-orm");

        // Build where clause
        const whereConditions = [];

        if (input.search) {
          // Name as well as email. The table has always shown a Name column while
          // the search only matched email, so searching for a customer by the name
          // in front of you returned nothing.
          whereConditions.push(
            or(like(users.email, `%${input.search}%`), like(users.name, `%${input.search}%`))!
          );
        }

        if (input.role) {
          whereConditions.push(eq(users.role, input.role));
        }

        if (input.status) {
          whereConditions.push(eq(users.status, input.status));
        }

        // SECURITY: never select() the whole row — users holds passwordHash,
        // twoFactorSecret and twoFactorBackupCodes. Project safe columns only.
        const safeUserCols = {
          id: users.id, name: users.name, email: users.email,
          loginMethod: users.loginMethod, role: users.role,
          status: users.status, suspendedAt: users.suspendedAt,
          suspendedReason: users.suspendedReason,
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
      const { sql } = await import("drizzle-orm");

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // ONE aggregate query. This used to pull every user row into Node and count
      // with Array.filter — fine at 50 users, a full table scan plus the whole
      // result set over the wire at 50 000, on a dashboard that auto-refreshes.
      const [row] = (await db
        .select({
          total: sql<number>`count(*)`,
          admins: sql<number>`sum(case when ${users.role} = 'admin' then 1 else 0 end)`,
          suspended: sql<number>`sum(case when ${users.status} = 'suspended' then 1 else 0 end)`,
          active: sql<number>`sum(case when ${users.lastSignedIn} > ${thirtyDaysAgo} then 1 else 0 end)`,
          fresh: sql<number>`sum(case when ${users.createdAt} > ${thirtyDaysAgo} then 1 else 0 end)`,
        })
        .from(users)) as Array<Record<string, unknown>>;

      const n = (v: unknown) => Number(v ?? 0);
      const totalUsers = n(row?.total);
      const adminCount = n(row?.admins);
      const activeUsers = n(row?.active);

      return {
        totalUsers,
        adminCount,
        userCount: totalUsers - adminCount,
        suspendedCount: n(row?.suspended),
        activeUsers,
        newUsers: n(row?.fresh),
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
          status: users.status, suspendedAt: users.suspendedAt,
          suspendedReason: users.suspendedReason,
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

  /**
   * Update a user's name and/or role.
   *
   * Replaces `updateUserRole`, which took only a role. The edit dialog has always
   * collected a Name and an Email too, and silently discarded both while showing
   * "User updated successfully".
   *
   * EMAIL IS DELIBERATELY NOT EDITABLE HERE. Email/password login resolves the
   * account with `getUserByEmail` (server/routes/emailAuthRoutes.ts:143), so
   * changing this field from an admin panel — with no verification, no uniqueness
   * check and no notice to the owner — is an account-takeover primitive, not an
   * edit. A customer who needs their address changed goes through verification.
   */
  updateUser: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        name: z.string().trim().min(1).max(200).optional(),
        role: z.enum(["admin", "user"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.name === undefined && input.role === undefined) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ingenting å oppdatere." });
      }

      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { users } = await import("../../drizzle/schema");
      const { eq, and, sql } = await import("drizzle-orm");

      const [target] = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke brukeren." });
      }

      // Two guards that did not exist. Combined with the dialog bug that made this
      // mutation fire with role:"user" on whoever was open, the only admin could
      // lock themselves out of their own product in two clicks — with no way back
      // in through the UI, because the UI is the thing they just lost.
      if (input.role === "user" && target.role === "admin") {
        if (target.id === ctx.user.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Du kan ikke fjerne din egen administratortilgang. Be en annen administrator gjøre det.",
          });
        }
        const [{ n }] = (await db
          .select({ n: sql<number>`count(*)` })
          .from(users)
          .where(and(eq(users.role, "admin"), eq(users.status, "active")))) as Array<{ n: number }>;
        if (Number(n) <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Dette er den siste administratoren. Utnevn en ny først.",
          });
        }
      }

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) patch.name = input.name;
      if (input.role !== undefined) patch.role = input.role;

      await db.update(users).set(patch).where(eq(users.id, input.userId));
      return { success: true };
    }),

  /**
   * Suspend or reactivate an account.
   *
   * This is what the Suspend button in the admin UI should always have called. It
   * could not: the `users` table had no status column at all, so the button was a
   * `toast.success()` over a `// TODO`. Migration 0095 adds the column, and
   * `sdk.authenticateRequest` refuses suspended accounts on their very next
   * request — a suspension that only greys out buttons is decoration.
   *
   * Reversible, unlike deleteUser: the account's data is untouched.
   */
  setUserStatus: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        status: z.enum(["active", "suspended"]),
        reason: z.string().trim().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Du kan ikke sperre din egen konto.",
        });
      }

      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { users } = await import("../../drizzle/schema");
      const { eq, and, sql } = await import("drizzle-orm");

      const [target] = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke brukeren." });
      }

      // Suspending an admin removes an admin just as surely as demoting one.
      if (input.status === "suspended" && target.role === "admin") {
        const [{ n }] = (await db
          .select({ n: sql<number>`count(*)` })
          .from(users)
          .where(and(eq(users.role, "admin"), eq(users.status, "active")))) as Array<{ n: number }>;
        if (Number(n) <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Dette er den siste aktive administratoren. Utnevn en ny først.",
          });
        }
      }

      await db
        .update(users)
        .set(
          input.status === "suspended"
            ? {
                status: "suspended" as const,
                suspendedAt: new Date(),
                suspendedReason: input.reason || null,
                updatedAt: new Date(),
              }
            : {
                status: "active" as const,
                suspendedAt: null,
                suspendedReason: null,
                updatedAt: new Date(),
              }
        )
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  /**
   * Permanently delete a user AND everything they own.
   *
   * The old implementation was one line — `DELETE FROM users WHERE id = ?`. The
   * schema declares 78 tables and exactly 4 foreign keys, all on two
   * subscription tables. **51 tables carry `user_id` with no FK and no cascade**,
   * so that one line left posts, brands, ideas, drafts, scheduled posts, usage
   * records, activity logs and OAuth tokens behind, each pointing at a user id
   * that no longer exists — invisibly, and forever. For a Norwegian company that
   * is also a data-protection problem, not only a tidiness one.
   *
   * The table list is DERIVED FROM THE SCHEMA at call time rather than written
   * out here, so a table added next year is covered the day it is added. A
   * hand-maintained list is the same bug with extra steps.
   */
  deleteUser: adminProcedure
    .input(z.object({ userId: z.number(), confirmEmail: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Du kan ikke slette din egen konto herfra.",
        });
      }

      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const schema = await import("../../drizzle/schema");
      const { users } = schema;
      const { eq, and, sql, getTableColumns, getTableName } = await import("drizzle-orm");

      const [target] = await db
        .select({ id: users.id, email: users.email, role: users.role })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke brukeren." });
      }

      // Typing the email is the confirmation. A numeric id in a URL is far too
      // easy to be off by one about for an irreversible, cascading delete.
      if ((target.email ?? "").toLowerCase() !== input.confirmEmail.toLowerCase()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "E-postadressen stemmer ikke med brukeren du prøver å slette.",
        });
      }

      if (target.role === "admin") {
        const [{ n }] = (await db
          .select({ n: sql<number>`count(*)` })
          .from(users)
          .where(and(eq(users.role, "admin"), eq(users.status, "active")))) as Array<{ n: number }>;
        if (Number(n) <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Dette er den siste administratoren. Utnevn en ny først.",
          });
        }
      }

      // Every table that carries a user_id, discovered from the schema itself.
      // `getTableColumns` throws on anything that is not a table (the schema
      // module also exports types, enums and relation helpers), so the try/catch
      // is the membership test — cheaper and more robust than maintaining a list.
      //
      // But "has a user_id" is not the same as "belongs to this user", and two
      // kinds of table must be held back explicitly:
      //
      //  a) `user_id` means someone ELSE. `support_ticket_replies.user_id` is
      //     documented in the schema as "User or admin replying" — cascading it
      //     when an ADMIN account is deleted strips that admin's answers out of
      //     every other customer's open ticket. `security_alerts.user_id` is the
      //     SUBJECT of the alert, so deleting the account would erase the
      //     evidence about it.
      //  b) Records we are required to keep. Norwegian bokføringsloven requires
      //     accounting records be retained for five years. Purging invoices and
      //     payment orders alongside the account is not a GDPR win, it is a
      //     compliance breach — and the send log was deliberately built to
      //     outlive the account for exactly this reason.
      const KEEP: Record<string, string> = {
        support_ticket_replies: "user_id kan være admin som svarte — sletting fjerner svar i ANDRE kunders saker",
        security_alerts: "user_id er den varselet HANDLER om — bevismateriale",
        invoices: "regnskapsmateriale, oppbevaringsplikt 5 år (bokføringsloven)",
        payment_orders: "regnskapsmateriale, oppbevaringsplikt 5 år",
        stripe_payment_intents: "regnskapsmateriale, oppbevaringsplikt 5 år",
        subscription_history: "regnskaps-/faktureringsspor",
        admin_email_sends: "revisjonsspor som skal overleve kontoen",
      };

      const usersTableName = getTableName(users);
      const ownedTables: Array<{ table: never; cols: Record<string, unknown>; name: string }> = [];
      for (const exported of Object.values(schema) as unknown[]) {
        let cols: Record<string, unknown>;
        let name: string;
        try {
          cols = getTableColumns(exported as never) as Record<string, unknown>;
          name = getTableName(exported as never);
        } catch {
          continue;
        }
        if (!name || name === usersTableName) continue;
        if (!("userId" in cols)) continue;
        if (name in KEEP) continue;
        ownedTables.push({ table: exported as never, cols, name });
      }

      const purged: string[] = [];

      // ONE TRANSACTION. Without it, a deadlock on the thirtieth table leaves the
      // first twenty-nine already destroyed while the account still exists — the
      // admin is told to retry an operation that has already half-run, and the
      // customer's posts are gone either way. All or nothing is the only safe
      // shape for a cascade this wide.
      //
      // Children first, the user row last, so the foreign keys that DO exist are
      // satisfied on the way down.
      try {
        await db.transaction(async (tx) => {
          for (const { table, cols, name } of ownedTables) {
            await tx.delete(table).where(eq(cols.userId as never, input.userId));
            purged.push(name);
          }
          await tx.delete(users).where(eq(users.id, input.userId));
        });
      } catch (error) {
        console.error("[admin.deleteUser] rolled back:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Slettingen feilet og ble rullet tilbake. Kontoen og alt innholdet er urørt. " +
            "Se serverloggen.",
        });
      }

      console.log(
        `[admin.deleteUser] admin ${ctx.user.id} deleted user ${input.userId} (${target.email}); ` +
          `purged ${purged.length} tables, retained ${Object.keys(KEEP).length} (regnskap/revisjon)`
      );
      return {
        success: true,
        purgedTables: purged.length,
        /** Tables deliberately left alone, so the admin knows what still exists. */
        retainedTables: Object.entries(KEEP).map(([table, reason]) => ({ table, reason })),
      };
    }),

  // ───────────────────────── bulk actions ─────────────────────────
  //
  // These back the three buttons in the member list that, until now, were
  // `// TODO` comments followed by `toast.success(...)`. An admin selected 200
  // members, pressed Confirm, and was told it had worked.
  //
  // Each one reports what it actually did, per user, so a partial failure is
  // visible instead of being rounded up to success.

  bulkSetRole: adminProcedure
    .input(
      z.object({
        userIds: z.array(z.number()).min(1).max(500),
        role: z.enum(["admin", "user"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { users } = await import("../../drizzle/schema");
      const { eq, and, inArray, sql } = await import("drizzle-orm");

      const targets = await db
        .select({ id: users.id, email: users.email, role: users.role })
        .from(users)
        .where(inArray(users.id, input.userIds));

      const [{ n }] = (await db
        .select({ n: sql<number>`count(*)` })
        .from(users)
        .where(and(eq(users.role, "admin"), eq(users.status, "active")))) as Array<{ n: number }>;

      // Applied in one statement, but only after removing the ids that must not
      // be touched — a bulk demotion that includes the caller, or that would
      // empty the admin list, is refused for those ids rather than for the batch.
      const demoting = input.role === "user";
      const currentAdmins = targets.filter((t) => t.role === "admin").length;
      const skipped: Array<{ email: string; reason: string }> = [];
      const applicable = targets.filter((t) => {
        if (demoting && t.id === ctx.user.id) {
          skipped.push({ email: t.email ?? String(t.id), reason: "Du kan ikke fjerne din egen tilgang" });
          return false;
        }
        if (demoting && t.role === "admin" && Number(n) - currentAdmins < 1) {
          skipped.push({ email: t.email ?? String(t.id), reason: "Ville fjerne siste administrator" });
          return false;
        }
        return true;
      });

      if (applicable.length > 0) {
        await db
          .update(users)
          .set({ role: input.role, updatedAt: new Date() })
          .where(inArray(users.id, applicable.map((t) => t.id)));
      }

      return { updated: applicable.length, skipped };
    }),

  bulkSetStatus: adminProcedure
    .input(
      z.object({
        userIds: z.array(z.number()).min(1).max(500),
        status: z.enum(["active", "suspended"]),
        reason: z.string().trim().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { users } = await import("../../drizzle/schema");
      const { eq, and, inArray, sql } = await import("drizzle-orm");

      const targets = await db
        .select({ id: users.id, email: users.email, role: users.role })
        .from(users)
        .where(inArray(users.id, input.userIds));

      const [{ n }] = (await db
        .select({ n: sql<number>`count(*)` })
        .from(users)
        .where(and(eq(users.role, "admin"), eq(users.status, "active")))) as Array<{ n: number }>;

      const suspending = input.status === "suspended";
      const adminsInBatch = targets.filter((t) => t.role === "admin").length;
      const skipped: Array<{ email: string; reason: string }> = [];
      const applicable = targets.filter((t) => {
        if (suspending && t.id === ctx.user.id) {
          skipped.push({ email: t.email ?? String(t.id), reason: "Du kan ikke sperre deg selv" });
          return false;
        }
        if (suspending && t.role === "admin" && Number(n) - adminsInBatch < 1) {
          skipped.push({ email: t.email ?? String(t.id), reason: "Ville sperre siste administrator" });
          return false;
        }
        return true;
      });

      if (applicable.length > 0) {
        await db
          .update(users)
          .set(
            suspending
              ? {
                  status: "suspended" as const,
                  suspendedAt: new Date(),
                  suspendedReason: input.reason || null,
                  updatedAt: new Date(),
                }
              : {
                  status: "active" as const,
                  suspendedAt: null,
                  suspendedReason: null,
                  updatedAt: new Date(),
                }
          )
          .where(inArray(users.id, applicable.map((t) => t.id)));
      }

      return { updated: applicable.length, skipped };
    }),

  // ───────────────────────── email ─────────────────────────

  /** Who a segment would reach, so the admin sees the number BEFORE sending. */
  previewEmailAudience: adminProcedure
    .input(
      z.object({
        segment: z.enum(["all", "active", "suspended", "admins", "inactive_30d"]).optional(),
        userIds: z.array(z.number()).max(500).optional(),
      })
    )
    .query(async ({ input }) => {
      const { countSegment, MAX_RECIPIENTS_PER_SEND } = await import("../services/adminEmail");
      const { isEmailConfigured } = await import("../_core/email");

      let count: number;
      if (input.userIds && input.userIds.length > 0) {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { users } = await import("../../drizzle/schema");
        const { inArray, and, isNotNull, sql } = await import("drizzle-orm");
        const [row] = (await db
          .select({ n: sql<number>`count(*)` })
          .from(users)
          .where(and(inArray(users.id, input.userIds), isNotNull(users.email)))) as Array<{
          n: number;
        }>;
        count = Number(row?.n ?? 0);
      } else {
        // A COUNT, not a fetch. Resolving the segment to rows just to read
        // `.length` meant merely OPENING the compose page pulled every active
        // user over the wire.
        count = await countSegment(input.segment ?? "active");
      }

      return {
        count,
        // The compose screen needs both of these BEFORE anything is written:
        // whether a transport exists at all, and whether this audience is even
        // sendable. Discovering the 500 ceiling after composing a message to
        // 3 000 people is the same class of surprise this PR exists to remove.
        maxPerSend: MAX_RECIPIENTS_PER_SEND,
        tooLarge: count > MAX_RECIPIENTS_PER_SEND,
        emailConfigured: isEmailConfigured(),
      };
    }),

  sendEmail: adminProcedure
    .input(
      z.object({
        segment: z.enum(["all", "active", "suspended", "admins", "inactive_30d"]).optional(),
        userIds: z.array(z.number()).max(500).optional(),
        subject: z.string().trim().min(1).max(300),
        body: z.string().trim().min(1).max(20000),
        ctaLabel: z.string().trim().max(60).optional(),
        ctaHref: z.string().url().max(500).optional(),
        /** Operational mail only (security, billing). Defaults to honouring opt-out. */
        respectOptOut: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { sendAdminEmail, resolveSegment } = await import("../services/adminEmail");

      let recipients;
      if (input.userIds && input.userIds.length > 0) {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { users } = await import("../../drizzle/schema");
        const { inArray } = await import("drizzle-orm");
        const rows = await db
          .select({ userId: users.id, email: users.email, name: users.name })
          .from(users)
          .where(inArray(users.id, input.userIds));
        recipients = rows
          .filter((r) => Boolean(r.email))
          .map((r) => ({ userId: r.userId, email: r.email as string, name: r.name }));
      } else {
        recipients = await resolveSegment(input.segment ?? "active");
      }

      try {
        return await sendAdminEmail({
          sentByUserId: ctx.user.id,
          recipients,
          subject: input.subject,
          bodyText: input.body,
          ctaLabel: input.ctaLabel,
          ctaHref: input.ctaHref,
          respectOptOut: input.respectOptOut,
        });
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Kunne ikke sende e-post",
        });
      }
    }),

  /** Send history, newest first — one row per recipient. */
  emailHistory: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return { batches: [] };

      const { adminEmailSends } = await import("../../drizzle/schema");
      const { desc, sql } = await import("drizzle-orm");

      const rows = await db
        .select({
          batchId: adminEmailSends.batchId,
          subject: adminEmailSends.subject,
          sentByUserId: adminEmailSends.sentByUserId,
          createdAt: sql<Date>`max(${adminEmailSends.createdAt})`,
          sent: sql<number>`sum(case when ${adminEmailSends.status} = 'sent' then 1 else 0 end)`,
          failed: sql<number>`sum(case when ${adminEmailSends.status} = 'failed' then 1 else 0 end)`,
          skipped: sql<number>`sum(case when ${adminEmailSends.status} = 'skipped' then 1 else 0 end)`,
        })
        .from(adminEmailSends)
        .groupBy(adminEmailSends.batchId, adminEmailSends.subject, adminEmailSends.sentByUserId)
        .orderBy(desc(sql`max(${adminEmailSends.createdAt})`))
        .limit(input.limit);

      return {
        batches: rows.map((r) => ({
          ...r,
          sent: Number(r.sent ?? 0),
          failed: Number(r.failed ?? 0),
          skipped: Number(r.skipped ?? 0),
        })),
      };
    }),
});