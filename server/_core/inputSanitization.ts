/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Request, Response, NextFunction } from "express";
import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize user inputs to prevent XSS and injection attacks
 */
export function sanitizeInputs(req: Request, res: Response, next: NextFunction) {
  // Sanitize request body
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === "object") {
    req.query = sanitizeObject(req.query);
  }

  next();
}

/**
 * Recursively sanitize object values
 */
function sanitizeObject(obj: any): any {
  if (typeof obj === "string") {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  if (typeof obj === "object" && obj !== null) {
    const sanitized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Sanitize string values
 */
function sanitizeString(str: string): string {
  if (typeof str !== "string") return str;

  // Remove null bytes
  str = str.replace(/\0/g, "");

  // Remove control characters (the control-char range here is intentional)
  // eslint-disable-next-line no-control-regex
  str = str.replace(/[\x00-\x1F\x7F]/g, "");

  // Sanitize HTML
  str = DOMPurify.sanitize(str, { ALLOWED_TAGS: [] });

  return str;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate phone number format (international)
 */
export function isValidPhoneNumber(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-()]{7,}$/;
  return phoneRegex.test(phone);
}

/**
 * Prevent NoSQL Injection
 */
export function preventNoSQLInjection(req: Request, res: Response, next: NextFunction) {
  const checkObject = (obj: any) => {
    if (typeof obj === "object" && obj !== null) {
      for (const key in obj) {
        // Check for MongoDB operators
        if (key.startsWith("$") || key.startsWith(".")) {
          console.warn(`[Security] Potential NoSQL injection detected: ${key}`);
          return false;
        }
        if (!checkObject(obj[key])) {
          return false;
        }
      }
    }
    return true;
  };

  if (!checkObject(req.body) || !checkObject(req.query)) {
    return res.status(400).json({ error: "Invalid request" });
  }

  next();
}

/**
 * Validate request size
 */
export function validateRequestSize(maxSize: number = 1024 * 100) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers["content-length"] || "0");
    if (contentLength > maxSize) {
      return res.status(413).json({ error: "Request entity too large" });
    }
    next();
  };
}

/**
 * Prevent XXE (XML External Entity) attacks
 */
export function preventXXE(req: Request, res: Response, next: NextFunction) {
  if (req.is("application/xml") || req.is("text/xml")) {
    // Disable XML parsing or use safe parser
    console.warn("[Security] XML request detected - consider disabling XML parsing");
  }
  next();
}

/**
 * SQL Injection prevention - use prepared statements
 * This is enforced at the database layer using Drizzle ORM
 * This middleware serves as a warning system
 */
export function detectSQLInjectionPatterns(req: Request, res: Response, next: NextFunction) {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(-{2}|\/\*|\*\/|;)/,
    /('|"|`)(.*?)(OR|AND)(.*?)('|"|`)/i,
  ];

  const checkString = (str: string) => {
    if (typeof str !== "string") return false;
    return sqlPatterns.some((pattern) => pattern.test(str));
  };

  const checkObject = (obj: any): boolean => {
    if (typeof obj === "string") {
      return checkString(obj);
    }
    if (Array.isArray(obj)) {
      return obj.some((item) => checkObject(item));
    }
    if (typeof obj === "object" && obj !== null) {
      for (const key in obj) {
        if (checkObject(obj[key])) {
          return true;
        }
      }
    }
    return false;
  };

  if (checkObject(req.body) || checkObject(req.query)) {
    console.warn("[Security] Potential SQL injection pattern detected");
    // Log but don't block - Drizzle ORM will prevent actual injection
  }

  next();
}