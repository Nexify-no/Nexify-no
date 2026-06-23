/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Router, Request, Response } from "express";
import { getUserUsageStats, getAlerts, getAdminAlerts, getSystemMetrics } from "../_core/monitoring";

export function registerMonitoringRoutes(app: any) {
  const router = Router();

  /**
   * Get usage statistics for current user
   */
  router.get("/api/monitoring/usage", (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const stats = getUserUsageStats(user.id, 24);
      res.json(stats);
    } catch (error) {
      console.error("[Monitoring] Error getting usage stats:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Get alerts for current user
   */
  router.get("/api/monitoring/alerts", (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const alerts = getAlerts(user.id, undefined, limit);
      res.json(alerts);
    } catch (error) {
      console.error("[Monitoring] Error getting alerts:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Admin: Get all alerts
   */
  router.get("/api/admin/monitoring/alerts", (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const alerts = getAdminAlerts(limit);
      res.json(alerts);
    } catch (error) {
      console.error("[Monitoring] Error getting admin alerts:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Admin: Get system metrics
   */
  router.get("/api/admin/monitoring/system", (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }

      const metrics = getSystemMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("[Monitoring] Error getting system metrics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Admin: Get user usage statistics
   */
  router.get("/api/admin/monitoring/user/:userId", (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }

      const userId = parseInt(req.params.userId);
      const hours = parseInt(req.query.hours as string) || 24;
      const stats = getUserUsageStats(userId, hours);
      res.json(stats);
    } catch (error) {
      console.error("[Monitoring] Error getting user stats:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.use(router);
}