/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getUserActivityLog,
  getUserSecurityAlerts,
  getUnresolvedSecurityAlerts,
  resolveSecurityAlert,
} from "../services/activityLogger";

// Create adminProcedure from protectedProcedure
const adminProcedure = protectedProcedure.use(async ({ ctx, next }: any) => {
  if (ctx.user?.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

export const securityRouter = router({
  /**
   * Get activity log for a specific user (admin only)
   */
  getUserActivity: adminProcedure
    .input(z.object({ userId: z.number(), limit: z.number().optional() }))
    .query(async ({ input }: any) => {
      const logs = await getUserActivityLog(input.userId, input.limit);
      return {
        data: logs,
        count: logs.length,
      };
    }),

  /**
   * Get security alerts for a specific user (admin only)
   */
  getUserSecurityAlerts: adminProcedure
    .input(z.object({ userId: z.number(), limit: z.number().optional() }))
    .query(async ({ input }: any) => {
      const alerts = await getUserSecurityAlerts(input.userId, input.limit);
      return {
        data: alerts,
        count: alerts.length,
      };
    }),

  /**
   * Get all unresolved security alerts (admin only)
   */
  getUnresolvedAlerts: adminProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(async ({ input }: any) => {
      const alerts = await getUnresolvedSecurityAlerts(input.limit);
      return {
        data: alerts,
        count: alerts.length,
      };
    }),

  /**
   * Resolve a security alert (admin only)
   */
  resolveAlert: adminProcedure
    .input(
      z.object({
        alertId: z.number(),
        resolutionNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }: any) => {
      if (!ctx.user) throw new Error("Unauthorized");

      await resolveSecurityAlert(input.alertId, ctx.user.id, input.resolutionNotes);

      return {
        success: true,
        message: "Alert resolved successfully",
      };
    }),
});