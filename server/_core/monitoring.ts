/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Request, Response, NextFunction } from "express";

/**
 * Level 4: Monitoring and Alerting
 * Tracks usage and sends alerts for suspicious activity
 */

export interface UsageMetrics {
  userId: number;
  timestamp: Date;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  requestSize: number;
  responseSize: number;
  userAgent?: string;
  ipAddress?: string;
}

export interface AnomalyAlert {
  userId: number;
  type: "high_usage" | "spike_detected" | "abuse_suspected" | "limit_exceeded";
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  timestamp: Date;
  metadata: Record<string, any>;
}

// In-memory storage for metrics (use database in production)
const metricsStore: UsageMetrics[] = [];
const alertsStore: AnomalyAlert[] = [];

/**
 * Middleware to track all requests
 */
export function trackUsage(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const user = (req as any).user;

  // Capture response
  const originalSend = res.send;
  res.send = function (data: any) {
    const responseTime = Date.now() - startTime;
    const responseSize = typeof data === "string" ? Buffer.byteLength(data) : 0;

    // Record metrics
    if (user) {
      const metrics: UsageMetrics = {
        userId: user.id,
        timestamp: new Date(),
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        responseTime,
        requestSize: parseInt(req.headers["content-length"] || "0", 10),
        responseSize,
        userAgent: req.headers["user-agent"],
        ipAddress: req.ip,
      };

      metricsStore.push(metrics);

      // Keep only last 10000 metrics in memory
      if (metricsStore.length > 10000) {
        metricsStore.shift();
      }

      // Check for anomalies (fire-and-forget — must not block the response)
      void checkAnomalies(metrics);
    }

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Check for usage anomalies
 */
async function checkAnomalies(metrics: UsageMetrics) {
  const { sendUsageSpikAlert, sendAbuseAlert } = await import("./sentry");
  const userId = metrics.userId;
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // Get user's metrics from last hour
  const userMetrics = metricsStore.filter(
    (m) => m.userId === userId && m.timestamp > oneHourAgo
  );

  // Check for high usage
  if (userMetrics.length > 200) {
    createAlert({
      userId,
      type: "high_usage",
      message: `User has made ${userMetrics.length} requests in the last hour`,
      severity: "medium",
      metadata: { requestCount: userMetrics.length, timeWindow: "1 hour" },
    });
  }

  // Check for spike (sudden increase)
  const last5Min = userMetrics.filter(
    (m) => m.timestamp > new Date(now.getTime() - 5 * 60 * 1000)
  );
  const prev5Min = userMetrics.filter(
    (m) =>
      m.timestamp > new Date(now.getTime() - 10 * 60 * 1000) &&
      m.timestamp <= new Date(now.getTime() - 5 * 60 * 1000)
  );

  if (last5Min.length > prev5Min.length * 3 && prev5Min.length > 0) {
    createAlert({
      userId,
      type: "spike_detected",
      message: `Request spike detected: ${last5Min.length} requests in last 5 minutes vs ${prev5Min.length} in previous 5 minutes`,
      severity: "high",
      metadata: { current: last5Min.length, previous: prev5Min.length },
    });
    sendUsageSpikAlert(userId, last5Min.length, prev5Min.length);
  }

  // Check for error spike
  const errorMetrics = userMetrics.filter((m) => m.statusCode >= 400);
  if (errorMetrics.length > userMetrics.length * 0.5 && userMetrics.length > 10) {
    createAlert({
      userId,
      type: "abuse_suspected",
      message: `High error rate detected: ${errorMetrics.length}/${userMetrics.length} requests failed`,
      severity: "high",
      metadata: { errorCount: errorMetrics.length, totalCount: userMetrics.length },
    });
    sendAbuseAlert(userId, "High error rate", { errorCount: errorMetrics.length, totalCount: userMetrics.length });
  }

  // Check for slow responses
  const slowRequests = userMetrics.filter((m) => m.responseTime > 10000);
  if (slowRequests.length > 5) {
    createAlert({
      userId,
      type: "high_usage",
      message: `${slowRequests.length} slow requests detected (>10s response time)`,
      severity: "low",
      metadata: { slowCount: slowRequests.length },
    });
  }
}

/**
 * Create an alert
 */
function createAlert(alert: Omit<AnomalyAlert, "timestamp">) {
  const fullAlert: AnomalyAlert = {
    ...alert,
    timestamp: new Date(),
  };

  alertsStore.push(fullAlert);

  // Keep only last 1000 alerts
  if (alertsStore.length > 1000) {
    alertsStore.shift();
  }

  // Log alert
  console.warn(`[Monitoring] Alert: ${alert.type} - User ${alert.userId}: ${alert.message}`);

  // In production, send to external monitoring service (e.g., Sentry, DataDog)
  // sendToMonitoringService(fullAlert);
}

/**
 * Get usage statistics for a user
 */
export function getUserUsageStats(userId: number, hours: number = 24) {
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  const userMetrics = metricsStore.filter(
    (m) => m.userId === userId && m.timestamp > cutoffTime
  );

  return {
    totalRequests: userMetrics.length,
    totalResponseTime: userMetrics.reduce((sum, m) => sum + m.responseTime, 0),
    averageResponseTime:
      userMetrics.length > 0
        ? userMetrics.reduce((sum, m) => sum + m.responseTime, 0) / userMetrics.length
        : 0,
    errorCount: userMetrics.filter((m) => m.statusCode >= 400).length,
    errorRate:
      userMetrics.length > 0
        ? (userMetrics.filter((m) => m.statusCode >= 400).length / userMetrics.length) * 100
        : 0,
    topEndpoints: getTopEndpoints(userMetrics),
    timeRange: { start: cutoffTime, end: new Date() },
  };
}

/**
 * Get top endpoints by request count
 */
function getTopEndpoints(metrics: UsageMetrics[]) {
  const endpointCounts: Record<string, number> = {};
  for (const metric of metrics) {
    endpointCounts[metric.endpoint] = (endpointCounts[metric.endpoint] || 0) + 1;
  }

  return Object.entries(endpointCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([endpoint, count]) => ({ endpoint, count }));
}

/**
 * Get all alerts
 */
export function getAlerts(
  userId?: number,
  type?: string,
  limit: number = 100
) {
  let filtered = alertsStore;

  if (userId) {
    filtered = filtered.filter((a) => a.userId === userId);
  }

  if (type) {
    filtered = filtered.filter((a) => a.type === type);
  }

  return filtered.slice(-limit);
}

/**
 * Get alerts for admin dashboard
 */
export function getAdminAlerts(limit: number = 50) {
  return alertsStore
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit)
    .map((alert) => ({
      ...alert,
      severity: alert.severity,
      timeAgo: getTimeAgo(alert.timestamp),
    }));
}

/**
 * Format time ago
 */
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Get system health metrics
 */
export function getSystemMetrics() {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const metricsLast24h = metricsStore.filter((m) => m.timestamp > last24h);
  const alertsLast24h = alertsStore.filter((a) => a.timestamp > last24h);

  return {
    totalRequests: metricsLast24h.length,
    totalAlerts: alertsLast24h.length,
    criticalAlerts: alertsLast24h.filter((a) => a.severity === "critical").length,
    averageResponseTime:
      metricsLast24h.length > 0
        ? metricsLast24h.reduce((sum, m) => sum + m.responseTime, 0) / metricsLast24h.length
        : 0,
    errorRate:
      metricsLast24h.length > 0
        ? (metricsLast24h.filter((m) => m.statusCode >= 400).length / metricsLast24h.length) *
          100
        : 0,
    uniqueUsers: new Set(metricsLast24h.map((m) => m.userId)).size,
  };
}