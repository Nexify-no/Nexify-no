/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import * as Sentry from "@sentry/node";
import { AnomalyAlert } from "./monitoring";

/**
 * Initialize Sentry for error tracking and alerting
 */
export function initSentry() {
  const sentryDSN = process.env.SENTRY_DSN;

  if (!sentryDSN) {
    console.warn("[Sentry] SENTRY_DSN not configured. Sentry integration disabled.");
    return;
  }

  Sentry.init({
    dsn: sentryDSN,
    environment: process.env.NODE_ENV || "development",
    // Tag errors with the deployed release for regression tracking (CI sets SENTRY_RELEASE).
    release: process.env.SENTRY_RELEASE || "nexify-ai@1.0.0",
    // 100% tracing is expensive in production — sample down there.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  });

  console.log("[Sentry] Initialized successfully");
}

/**
 * Send alert to Sentry
 */
export function sendAlertToSentry(alert: AnomalyAlert) {
  if (!process.env.SENTRY_DSN) {
    return; // Sentry not configured
  }

  const severityMap: Record<string, Sentry.SeverityLevel> = {
    low: "info",
    medium: "warning",
    high: "error",
    critical: "fatal",
  };

  const level = severityMap[alert.severity] || "warning";

  Sentry.captureMessage(alert.message, {
    level,
    tags: {
      alertType: alert.type,
      userId: alert.userId.toString(),
      severity: alert.severity,
    },
    extra: {
      metadata: alert.metadata,
      timestamp: alert.timestamp.toISOString(),
    },
  });
}

/**
 * Send critical alerts to Sentry immediately
 */
export function sendCriticalAlert(
  type: string,
  message: string,
  userId: number,
  metadata: Record<string, any> = {}
) {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  Sentry.captureMessage(message, {
    level: "fatal",
    tags: {
      alertType: type,
      userId: userId.toString(),
      severity: "critical",
    },
    extra: {
      metadata,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Send usage spike alert
 */
export function sendUsageSpikAlert(userId: number, currentRequests: number, previousRequests: number) {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  const message = `Usage spike detected for user ${userId}: ${currentRequests} requests in last 5 minutes vs ${previousRequests} in previous 5 minutes`;

  Sentry.captureMessage(message, {
    level: "warning",
    tags: {
      alertType: "spike_detected",
      userId: userId.toString(),
    },
    extra: {
      currentRequests,
      previousRequests,
      spike: ((currentRequests - previousRequests) / previousRequests * 100).toFixed(2) + "%",
    },
  });
}

/**
 * Send abuse alert
 */
export function sendAbuseAlert(userId: number, reason: string, metadata: Record<string, any> = {}) {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  const message = `Potential abuse detected for user ${userId}: ${reason}`;

  Sentry.captureMessage(message, {
    level: "error",
    tags: {
      alertType: "abuse_suspected",
      userId: userId.toString(),
    },
    extra: {
      reason,
      ...metadata,
    },
  });
}

/**
 * Send subscription limit exceeded alert
 */
export function sendLimitExceededAlert(
  userId: number,
  planId: string,
  limit: number,
  used: number
) {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  const message = `User ${userId} exceeded subscription limit for plan ${planId}: ${used}/${limit}`;

  Sentry.captureMessage(message, {
    level: "warning",
    tags: {
      alertType: "limit_exceeded",
      userId: userId.toString(),
      planId,
    },
    extra: {
      limit,
      used,
      percentage: ((used / limit) * 100).toFixed(2) + "%",
    },
  });
}

/**
 * Capture exception to Sentry
 */
export function captureException(error: Error, context: Record<string, any> = {}) {
  if (!process.env.SENTRY_DSN) {
    console.error("[Sentry] Error (not sent):", error);
    return;
  }

  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Create transaction for performance monitoring
 */
export function createTransaction(name: string, op: string) {
  if (!process.env.SENTRY_DSN) {
    return null;
  }

  // Sentry v7+ uses startSpan with a callback
  let span: any = null;
  Sentry.startSpan(
    {
      name,
      op,
    },
    (s) => {
      span = s;
    }
  );
  return span;
}