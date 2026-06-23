/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { getDb } from "../db";
import { encryptSecret, decryptSecret } from "../_core/tokenCrypto";
import {
  userAccountSettings,
  notificationSettings,
  platformIntegrationSettings,
  userContentPreferences,
} from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Settings Service - Manage user account, notification, platform, and content preferences
 */

export class SettingsService {
  /**
   * Get or create user account settings
   */
  static async getAccountSettings(userId: number) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const settings = await (db as any).query.userAccountSettings.findFirst({
      where: eq(userAccountSettings.userId, userId),
    });

    if (!settings) {
      const [newSettings] = await db
        .insert(userAccountSettings)
        .values({
          userId,
          language: "no",
          timezone: "Europe/Oslo",
          theme: "light",
        })
        .execute();

      return newSettings;
    }

    return settings;
  }

  /**
   * Update user account settings
   */
  static async updateAccountSettings(
    userId: number,
    updates: Partial<typeof userAccountSettings.$inferInsert>
  ) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [updated] = await db
      .update(userAccountSettings)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(userAccountSettings.userId, userId))
      .execute();

    return updated;
  }

  /**
   * Get or create notification settings
   */
  static async getNotificationSettings(userId: number) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const settings = await (db as any).query.notificationSettings.findFirst({
      where: eq(notificationSettings.userId, userId),
    });

    if (!settings) {
      const [newSettings] = await db
        .insert(notificationSettings)
        .values({
          userId,
          emailNotifications: true,
          emailFrequency: "daily",
          pushNotifications: true,
          pushFrequency: "immediate",
        })
        .execute();

      return newSettings;
    }

    return settings;
  }

  /**
   * Update notification settings
   */
  static async updateNotificationSettings(
    userId: number,
    updates: Partial<typeof notificationSettings.$inferInsert>
  ) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [updated] = await db
      .update(notificationSettings)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(notificationSettings.userId, userId))
      .execute();

    return updated;
  }

  /**
   * Get all platform integrations for a user
   */
  static async getPlatformIntegrations(userId: number) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const rows = await (db as any).query.platformIntegrationSettings.findMany({
      where: eq(platformIntegrationSettings.userId, userId),
    });
    return (rows || []).map((r: any) => ({
      ...r,
      accessToken: decryptSecret(r.accessToken),
      refreshToken: decryptSecret(r.refreshToken),
    }));
  }

  /**
   * Get specific platform integration
   */
  static async getPlatformIntegration(userId: number, platform: string) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const row = await (db as any).query.platformIntegrationSettings.findFirst({
      where: (t: any) =>
        t.userId === userId && t.platform === platform,
    });
    if (!row) return row;
    return {
      ...row,
      accessToken: decryptSecret(row.accessToken),
      refreshToken: decryptSecret(row.refreshToken),
    };
  }

  /**
   * Create or update platform integration
   */
  static async upsertPlatformIntegration(
    userId: number,
    platform: string,
    data: Partial<typeof platformIntegrationSettings.$inferInsert>
  ) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const existing = await this.getPlatformIntegration(userId, platform);

    // Encrypt tokens at rest before persisting.
    const enc: typeof data = { ...data };
    if (typeof enc.accessToken === "string") enc.accessToken = encryptSecret(enc.accessToken);
    if (typeof enc.refreshToken === "string") enc.refreshToken = encryptSecret(enc.refreshToken);

    if (existing) {
      return await db
        .update(platformIntegrationSettings)
        .set({
          ...enc,
          updatedAt: new Date(),
        })
        .where(eq(platformIntegrationSettings.id, existing.id))
        .execute();
    } else {
      return await db
        .insert(platformIntegrationSettings)
        .values({
          userId,
          platform,
          ...enc,
        })
        .execute();
    }
  }

  /**
   * Disconnect platform integration
   */
  static async disconnectPlatform(userId: number, platform: string) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const integration = await this.getPlatformIntegration(userId, platform);

    if (!integration) {
      throw new Error(`Platform ${platform} not connected`);
    }

    return await db
      .update(platformIntegrationSettings)
      .set({
        isConnected: false,
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(platformIntegrationSettings.id, integration.id))
      .execute();
  }

  /**
   * Get or create content preferences
   */
  static async getContentPreferences(userId: number) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const prefs = await (db as any).query.userContentPreferences.findFirst({
      where: eq(userContentPreferences.userId, userId),
    });

    if (!prefs) {
      const [newPrefs] = await db
        .insert(userContentPreferences)
        .values({
          userId,
          defaultTone: "professional",
          defaultPlatform: "linkedin",
          contentLength: "medium",
          hashtagStyle: "moderate",
          ctaStyle: "professional",
          emojiUsage: "moderate",
        })
        .execute();

      return newPrefs;
    }

    return prefs;
  }

  /**
   * Update content preferences
   */
  static async updateContentPreferences(
    userId: number,
    updates: Partial<typeof userContentPreferences.$inferInsert>
  ) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [updated] = await db
      .update(userContentPreferences)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(userContentPreferences.userId, userId))
      .execute();

    return updated;
  }

  /**
   * Get all settings for a user (complete profile)
   */
  static async getAllSettings(userId: number) {
    const [account, notifications, platformIntegrations, contentPrefs] = await Promise.all([
      this.getAccountSettings(userId),
      this.getNotificationSettings(userId),
      this.getPlatformIntegrations(userId),
      this.getContentPreferences(userId),
    ]);

    return {
      account,
      notifications,
      platformIntegrations,
      contentPreferences: contentPrefs,
    };
  }

  /**
   * Get connected platforms
   */
  static async getConnectedPlatforms(userId: number) {
    const integrations = await this.getPlatformIntegrations(userId);
    return integrations.filter((i: any) => i.isConnected);
  }

  /**
   * Check if platform is connected
   */
  static async isPlatformConnected(userId: number, platform: string) {
    const integration = await this.getPlatformIntegration(userId, platform);
    return integration?.isConnected ?? false;
  }

  /**
   * Update last synced time for platform
   */
  static async updateLastSyncedAt(userId: number, platform: string) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const integration = await this.getPlatformIntegration(userId, platform);

    if (!integration) {
      throw new Error(`Platform ${platform} not found`);
    }

    return await db
      .update(platformIntegrationSettings)
      .set({
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(platformIntegrationSettings.id, integration.id))
      .execute();
  }

  /**
   * Record platform sync error
   */
  static async recordSyncError(
    userId: number,
    platform: string,
    errorMessage: string
  ) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const integration = await this.getPlatformIntegration(userId, platform);

    if (!integration) {
      throw new Error(`Platform ${platform} not found`);
    }

    return await db
      .update(platformIntegrationSettings)
      .set({
        lastErrorMessage: errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(platformIntegrationSettings.id, integration.id))
      .execute();
  }
}