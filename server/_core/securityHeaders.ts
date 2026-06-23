/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Request, Response, NextFunction } from "express";
import helmet from "helmet";

/**
 * Configure comprehensive security headers
 * Implements OWASP security best practices
 */
export function configureSecurityHeaders(app: any) {
  // Use Helmet.js for security headers
  app.use(
    helmet({
      // CSP is defined authoritatively in _core/index.ts (with the correct
      // Stripe/analytics allowances). Disable it here so this second helmet does
      // not override it with a more permissive/incompatible policy.
      contentSecurityPolicy: false,
      // Prevent MIME type sniffing
      noSniff: true,
      // Enable XSS protection
      xssFilter: true,
      // Prevent clickjacking
      frameguard: {
        action: "deny",
      },
      // HSTS - Force HTTPS. Skipped for local/Docker HTTP runs (no TLS) so the
      // browser is never told to force https on this host.
      hsts:
        process.env.DISABLE_HTTPS_REDIRECT === "true"
          ? false
          : {
              maxAge: 31536000, // 1 year
              includeSubDomains: true,
              preload: true,
            },
      // Referrer Policy
      referrerPolicy: {
        policy: "strict-origin-when-cross-origin",
      },
      // Permissions Policy (formerly Feature Policy) - handled separately
      // permissionsPolicy is set via custom header below
    })
  );

  // Additional security headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Disable X-Powered-By header
    res.removeHeader("X-Powered-By");

    // Add custom security headers
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    if (process.env.DISABLE_HTTPS_REDIRECT !== "true") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }

    // Prevent browser caching of sensitive data
    if (req.path.includes("/api/") || req.path.includes("/admin/")) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }

    next();
  });
}

/**
 * Validate and sanitize request headers
 */
export function validateRequestHeaders(req: Request, res: Response, next: NextFunction) {
  // Check for suspicious headers
  const suspiciousHeaders = [
    "x-forwarded-for",
    "x-forwarded-proto",
    "x-forwarded-host",
    "x-original-url",
    "x-rewrite-url",
  ];

  for (const header of suspiciousHeaders) {
    if (req.headers[header] && typeof req.headers[header] !== "string") {
      return res.status(400).json({ error: "Invalid request headers" });
    }
  }

  next();
}

/**
 * Prevent HTTP Parameter Pollution (HPP)
 */
export function preventParameterPollution(req: Request, res: Response, next: NextFunction) {
  // Check for duplicate parameters
  const query = req.query;
  for (const key in query) {
    if (Array.isArray(query[key]) && query[key].length > 1) {
      // Multiple values for same parameter - potential HPP attack
      console.warn(`[Security] Potential HPP attack detected: ${key}`);
      return res.status(400).json({ error: "Invalid request parameters" });
    }
  }

  next();
}

/**
 * Enforce HTTPS in production
 */
export function enforceHttps(req: Request, res: Response, next: NextFunction) {
  // Escape hatch for local/Docker runs without a TLS proxy (set DISABLE_HTTPS_REDIRECT=true).
  if (process.env.NODE_ENV === "production" && process.env.DISABLE_HTTPS_REDIRECT !== "true") {
    if (req.header("x-forwarded-proto") !== "https") {
      // Redirect to a trusted canonical host, never the attacker-controlled Host header.
      let host = req.header("host") || "";
      const canonical = process.env.PUBLIC_SITE_URL;
      if (canonical) {
        try { host = new URL(canonical).host; } catch { /* keep req host */ }
      }
      return res.redirect(301, `https://${host}${req.url}`);
    }
  }
  next();
}

/**
 * Prevent Open Redirect attacks
 */
export function preventOpenRedirect(req: Request, res: Response, next: NextFunction) {
  const redirectUrl = req.query.redirect as string;

  if (redirectUrl) {
    // Allow ONLY same-site relative paths. Reject protocol-relative ("//evil.com"),
    // backslash tricks ("/\evil.com"), and absolute URLs ("http://evil.com").
    const isSafeRelative =
      redirectUrl.startsWith("/") &&
      !redirectUrl.startsWith("//") &&
      !redirectUrl.startsWith("/\\") &&
      !redirectUrl.includes("://");
    if (!isSafeRelative) {
      console.warn(`[Security] Potential open redirect blocked: ${redirectUrl}`);
      return res.status(400).json({ error: "Invalid redirect URL" });
    }
  }

  next();
}