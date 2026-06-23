/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Symmetric encryption for secrets stored at rest (OAuth access/refresh tokens).
 * AES-256-GCM with a random 12-byte IV per value and an auth tag (tamper-evident).
 *
 * Key: TOKEN_ENCRYPTION_KEY (any string; normalized to 32 bytes via SHA-256).
 * If the key is unset, values are stored as-is (dev fallback) — set it in prod.
 * Decryption transparently passes through legacy plaintext values.
 */
import crypto from "crypto";

const ALGO = "aes-256-gcm";
const PREFIX = "enc:v1:";

function getKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY || "";
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw).digest(); // 32 bytes
}

export function encryptSecret(plain: string): string;
export function encryptSecret(plain: string | null | undefined): string | null;
export function encryptSecret(plain: string | null | undefined): string | null {
  if (plain == null) return null;
  const key = getKey();
  if (!key) return plain; // no key configured → store as-is (dev)
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (!value.startsWith(PREFIX)) return value; // legacy plaintext
  const key = getKey();
  if (!key) return value;
  try {
    const raw = Buffer.from(value.slice(PREFIX.length), "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}