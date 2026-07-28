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
/**
 * Redact credentials that live in URL QUERY STRINGS, wherever Sentry stores a URL.
 *
 * Key-name scrubbing is blind to these: the secret is a substring of a value
 * (`https://graph.facebook.com/v21.0/me/accounts?access_token=EAAB...`), not a
 * field called "token". Meta's Graph API puts `access_token` on every read and
 * `client_secret` on the OAuth exchange, so an unredacted span URL is a live
 * credential sitting in an issue tracker.
 *
 * Walks the whole event rather than a fixed list of paths, because the URL turns
 * up in several shapes — `event.request.url`, `contexts.trace.data["url.full"]`,
 * and one `attributes` bag per span — and a list would silently miss the next one.
 */
const SECRET_QUERY_PARAM = /\b(access_token|client_secret|refresh_token|fb_exchange_token|code)=[^&\s"']+/gi;

function redactSecretsInUrls(node: unknown, depth = 0): void {
  if (!node || typeof node !== "object" || depth > 8) return;
  const record = node as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (typeof value === "string") {
      if (SECRET_QUERY_PARAM.test(value)) {
        // `lastIndex` persists on a /g regex between calls; reset it or every
        // other match is skipped.
        SECRET_QUERY_PARAM.lastIndex = 0;
        record[key] = value.replace(SECRET_QUERY_PARAM, "$1=[redacted]");
      }
      SECRET_QUERY_PARAM.lastIndex = 0;
    } else if (value && typeof value === "object") {
      redactSecretsInUrls(value, depth + 1);
    }
  }
}

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
    // Never let Sentry auto-attach IP/cookies/user PII.
    sendDefaultPii: false,
    // Scrub PII/secrets from every event before it leaves the process.
    beforeSend(event) {
      const SECRET_KEY = /pass(word)?|token|secret|authorization|cookie|api[_-]?key|session/i;
      const scrub = (obj: unknown): void => {
        if (!obj || typeof obj !== "object") return;
        const rec = obj as Record<string, unknown>;
        for (const k of Object.keys(rec)) {
          if (SECRET_KEY.test(k)) rec[k] = "[redacted]";
          else if (rec[k] && typeof rec[k] === "object") scrub(rec[k]);
        }
      };
      if (event.request) {
        // Drop cookies + auth headers entirely.
        delete (event.request as { cookies?: unknown }).cookies;
        const headers = event.request.headers as Record<string, string> | undefined;
        if (headers) {
          for (const h of ["authorization", "Authorization", "cookie", "Cookie"]) delete headers[h];
        }
        scrub(event.request.data);
      }
      scrub(event.extra);
      redactSecretsInUrls(event);
      return event;
    },
    // Transactions are a SEPARATE pipeline from errors — `beforeSend` never sees
    // them. Without this hook, every outgoing HTTP span carries `url.full` and
    // `url.query` verbatim, and the Meta Graph API takes its credentials as query
    // parameters: `access_token` on every read, and `client_secret` on the OAuth
    // exchange. At a 10% trace sample that shipped roughly one in ten Graph calls
    // — including a 60-day user token and the app's client secret — to Sentry in
    // cleartext. Key-name scrubbing cannot catch it, because the secret is inside
    // a string value, not under a key.
    beforeSendTransaction(event) {
      redactSecretsInUrls(event);
      return event;
    },
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