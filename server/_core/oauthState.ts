/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Signed OAuth `state` for connect/link flows (CSRF protection).
 * The state embeds the initiating userId and is HMAC-signed with JWT_SECRET, so a
 * forged state with a different userId is rejected. Includes a 15-minute expiry.
 */
import crypto from "crypto";

const MAX_AGE_MS = 15 * 60 * 1000;

function secret(): string {
  return process.env.JWT_SECRET || "";
}

export function signOAuthState(userId: number): string {
  const ts = Date.now();
  const nonce = crypto.randomBytes(8).toString("hex");
  const payload = `${userId}.${ts}.${nonce}`;
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

/** Returns the verified userId, or null if the state is forged/expired/malformed. */
export function verifyOAuthState(state: string): number | null {
  const parts = state.split(".");
  if (parts.length !== 4) return null;
  const [userIdStr, tsStr, nonce, sig] = parts;
  const payload = `${userIdStr}.${tsStr}.${nonce}`;
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const ts = parseInt(tsStr, 10);
  if (!Number.isFinite(ts) || Date.now() - ts > MAX_AGE_MS) return null;
  const userId = parseInt(userIdStr, 10);
  return Number.isFinite(userId) ? userId : null;
}