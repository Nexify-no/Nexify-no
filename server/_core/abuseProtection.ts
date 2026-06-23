/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Request, Response, NextFunction } from "express";

/**
 * Level 3: Abuse Protection
 * Validates content and enforces request size limits
 */

// Banned words/patterns (basic profanity and spam detection)
const BANNED_PATTERNS = [
  /viagra|cialis|casino|lottery/gi,
  /click here|buy now|limited offer/gi,
  /bitcoin|crypto|nft|blockchain/gi, // Optional: adjust based on your policy
];

// Spam indicators
const SPAM_INDICATORS = {
  EXCESSIVE_LINKS: /https?:\/\/[^\s]+/g,
  EXCESSIVE_CAPS: /[A-Z]{10,}/g,
  EXCESSIVE_PUNCTUATION: /[!?]{3,}/g,
  EXCESSIVE_EMOJIS: /[\uD83C-\uDBFF][\uDC00-\uDFFF]/g, // Emoji pattern for ES5 compatibility
};

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  spamScore: number;
}

/**
 * Validate content for abuse
 */
export function validateContent(content: string): ValidationResult {
  const errors: string[] = [];
  let spamScore = 0;

  // Check for banned patterns
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(content)) {
      errors.push("Content contains prohibited words or patterns");
      spamScore += 30;
    }
  }

  // Check for excessive links
  const links = content.match(SPAM_INDICATORS.EXCESSIVE_LINKS) || [];
  if (links.length > 5) {
    errors.push("Too many links in content");
    spamScore += 20;
  }

  // Check for excessive caps (more than 30% of text)
  const capsMatches = content.match(SPAM_INDICATORS.EXCESSIVE_CAPS) || [];
  const capsPercentage = (capsMatches.join("").length / content.length) * 100;
  if (capsPercentage > 30) {
    errors.push("Excessive uppercase letters detected");
    spamScore += 15;
  }

  // Check for excessive punctuation
  const punctuationMatches = content.match(SPAM_INDICATORS.EXCESSIVE_PUNCTUATION) || [];
  if (punctuationMatches.length > 3) {
    errors.push("Excessive punctuation detected");
    spamScore += 10;
  }

  // Check for excessive emojis (more than 20% of text)
  const emojiMatches = content.match(SPAM_INDICATORS.EXCESSIVE_EMOJIS) || [];
  const emojiPercentage = (emojiMatches.length / content.length) * 100;
  if (emojiPercentage > 20) {
    errors.push("Excessive emojis detected");
    spamScore += 10;
  }

  // Check for repetitive text
  const words = content.split(/\s+/);
  const wordFreq: Record<string, number> = {};
  for (const word of words) {
    wordFreq[word.toLowerCase()] = (wordFreq[word.toLowerCase()] || 0) + 1;
  }
  const maxFreq = Math.max(...Object.values(wordFreq));
  if (maxFreq > words.length * 0.3) {
    errors.push("Repetitive text detected");
    spamScore += 15;
  }

  return {
    isValid: errors.length === 0 && spamScore < 50,
    errors,
    spamScore,
  };
}

/**
 * Middleware to check request size
 */
export function checkRequestSize(maxSizeKB: number = 100) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers["content-length"] || "0", 10);
    const maxSizeBytes = maxSizeKB * 1024;

    if (contentLength > maxSizeBytes) {
      return res.status(413).json({
        error: "Request body too large",
        code: "PAYLOAD_TOO_LARGE",
        maxSize: `${maxSizeKB}KB`,
        received: `${(contentLength / 1024).toFixed(2)}KB`,
      });
    }

    next();
  };
}

/**
 * Middleware to validate content in request body
 */
export function validateContentMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = req.body;

    // Check for content fields that need validation
    const contentFields = ["rawInput", "generatedContent", "content", "text", "description"];
    
    for (const field of contentFields) {
      if (body[field] && typeof body[field] === "string") {
        const validation = validateContent(body[field]);

        if (!validation.isValid) {
          return res.status(400).json({
            error: "Content validation failed",
            code: "INVALID_CONTENT",
            field,
            issues: validation.errors,
            spamScore: validation.spamScore,
          });
        }

        // Warn if spam score is high (but still allow)
        if (validation.spamScore > 30) {
          console.warn(
            `[AbuseProtection] High spam score (${validation.spamScore}) for user ${(req as any).user?.id} in field ${field}`
          );
        }
      }
    }

    next();
  } catch (error) {
    console.error("[AbuseProtection] Error validating content:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Middleware to check for suspicious patterns
 */
export function checkSuspiciousActivity(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = (req as any).user;
    if (!user) {
      return next();
    }

    // Check for rapid requests from same user
    const now = Date.now();
    const key = `activity-${user.id}`;

    // This would be better with Redis, but for now we'll use a simple in-memory store
    // In production, use Redis for distributed rate limiting
    if (!(global as any).activityLog) {
      (global as any).activityLog = {};
    }

    const log = (global as any).activityLog[key] || [];
    const recentRequests = log.filter((t: number) => now - t < 60000); // Last 60 seconds

    if (recentRequests.length > 50) {
      console.warn(
        `[AbuseProtection] Suspicious activity detected: ${recentRequests.length} requests in 60s from user ${user.id}`
      );
      return res.status(429).json({
        error: "Too many requests detected",
        code: "SUSPICIOUS_ACTIVITY",
        retryAfter: 60,
      });
    }

    recentRequests.push(now);
    (global as any).activityLog[key] = recentRequests;

    next();
  } catch (error) {
    console.error("[AbuseProtection] Error checking suspicious activity:", error);
    next(); // Don't block on error
  }
}