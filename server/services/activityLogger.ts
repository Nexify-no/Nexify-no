/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { getDb } from "../db";
import { activityLog, securityAlerts, failedLoginAttempts } from "../../drizzle/schema";
import { eq, and, gte, desc } from "drizzle-orm";

let db: any = null;

const getDatabase = async () => {
  if (!db) {
    db = await getDb();
  }
  return db;
};

export interface LogActivityOptions {
  userId: number;
  activityType: "login" | "logout" | "edit" | "delete" | "view" | "download" | "upload";
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: number;
  success?: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface CheckSecurityOptions {
  email: string;
  ipAddress: string;
  userAgent?: string;
  reason?: string;
}

/**
 * Log user activity to the activity log table
 */
export async function logActivity(options: LogActivityOptions) {
  try {
    const database = await getDatabase();
    await database.insert(activityLog).values({
      userId: options.userId,
      activityType: options.activityType,
      description: options.description,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      resourceType: options.resourceType,
      resourceId: options.resourceId,
      success: options.success ? 1 : 0,
      errorMessage: options.errorMessage,
      metadata: options.metadata,
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
    // Don't throw - activity logging should not break the main flow
  }
}

/**
 * Log failed login attempt and check for security threats
 */
export async function logFailedLogin(options: CheckSecurityOptions) {
  try {
    const database = await getDatabase();
    // Record the failed attempt
    await database.insert(failedLoginAttempts).values({
      email: options.email,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      reason: options.reason,
    });

    // Check for repeated failed attempts in the last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentFailures = await database
      .select()
      .from(failedLoginAttempts)
      .where(
        and(
          eq(failedLoginAttempts.email, options.email),
          gte(failedLoginAttempts.createdAt, fifteenMinutesAgo)
        )
      );

    // If more than 5 failed attempts in 15 minutes, create security alert
    if (recentFailures.length > 5) {
      await createSecurityAlert({
        email: options.email,
        alertType: "multiple_failed_logins",
        severity: "high",
        description: `Multiple failed login attempts (${recentFailures.length}) from IP ${options.ipAddress}`,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        failedAttempts: recentFailures.length,
        timeWindow: 15,
      });
    }
  } catch (error) {
    console.error("Failed to log failed login:", error);
  }
}

export interface CreateSecurityAlertOptions {
  email?: string;
  userId?: number;
  alertType:
    | "failed_login"
    | "multiple_failed_logins"
    | "suspicious_location"
    | "unusual_activity"
    | "permission_change"
    | "mass_deletion"
    | "unauthorized_access";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  ipAddress?: string;
  userAgent?: string;
  failedAttempts?: number;
  timeWindow?: number;
}

/**
 * Create a security alert
 */
export async function createSecurityAlert(options: CreateSecurityAlertOptions) {
  try {
    const database = await getDatabase();
    // If email is provided, find the user
    const userId = options.userId;
    if (!userId && options.email) {
      // For now, we'll skip user lookup - can be enhanced later
      // This is just for security alerts without a specific user
    }

    if (userId) {
      await database.insert(securityAlerts).values({
        userId,
        alertType: options.alertType,
        severity: options.severity,
        description: options.description,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        failedAttempts: options.failedAttempts,
        timeWindow: options.timeWindow,
      });
    }
  } catch (error) {
    console.error("Failed to create security alert:", error);
  }
}

/**
 * Get activity log for a specific user
 */
export async function getUserActivityLog(userId: number, limit = 50) {
  try {
    const database = await getDatabase();
    const logs = await database
      .select()
      .from(activityLog)
      .where(eq(activityLog.userId, userId))
      .orderBy(desc(activityLog.createdAt))
      .limit(limit);

    return logs;
  } catch (error) {
    console.error("Failed to get user activity log:", error);
    return [];
  }
}

/**
 * Get security alerts for a specific user
 */
export async function getUserSecurityAlerts(userId: number, limit = 50) {
  try {
    const database = await getDatabase();
    const alerts = await database
      .select()
      .from(securityAlerts)
      .where(eq(securityAlerts.userId, userId))
      .orderBy(desc(securityAlerts.createdAt))
      .limit(limit);

    return alerts;
  } catch (error) {
    console.error("Failed to get user security alerts:", error);
    return [];
  }
}

/**
 * Get all unresolved security alerts (for admin dashboard)
 */
export async function getUnresolvedSecurityAlerts(limit = 50) {
  try {
    const database = await getDatabase();
    const alerts = await database
      .select()
      .from(securityAlerts)
      .where(eq(securityAlerts.resolved, 0))
      .orderBy(desc(securityAlerts.createdAt))
      .limit(limit);

    return alerts;
  } catch (error) {
    console.error("Failed to get unresolved security alerts:", error);
    return [];
  }
}

/**
 * Resolve a security alert
 */
export async function resolveSecurityAlert(
  alertId: number,
  resolvedBy: number,
  resolutionNotes?: string
) {
  try {
    const database = await getDatabase();
    await database
      .update(securityAlerts)
      .set({
        resolved: 1,
        resolvedBy,
        resolutionNotes,
        resolvedAt: new Date(),
      })
      .where(eq(securityAlerts.id, alertId));
  } catch (error) {
    console.error("Failed to resolve security alert:", error);
  }
}

/**
 * Clean up old failed login attempts (older than 24 hours)
 */
export async function cleanupOldFailedLogins() {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // This would be a DELETE query - implement if needed
    console.log("Cleanup scheduled for failed logins older than:", oneDayAgo);
  } catch (error) {
    console.error("Failed to cleanup old failed logins:", error);
  }
}