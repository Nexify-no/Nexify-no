/**
 * Email + password authentication routes.
 *
 * Session model matches Google/Vipps OAuth: on success we mint the SAME JWT
 * session token (sdk.createSessionToken) and set the SAME cookie (COOKIE_NAME).
 * Passwords are bcrypt-hashed; verification/reset tokens are random 256-bit
 * values of which only the SHA-256 hash is stored (raw token lives only in the
 * emailed link). All flows use generic responses to avoid account enumeration.
 *
 * Global middleware already applied before these handlers (see _core/index.ts):
 *   express.json(), cookieParser(), ipRateLimiter.
 */
import crypto from "crypto";
import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { nanoid } from "nanoid";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { authRateLimiter } from "../_core/rateLimiter";
import { sdk } from "../_core/sdk";
import { sendVerificationEmail, sendPasswordResetEmail } from "../_core/email";
import * as db from "../db";
import { SignJWT, jwtVerify } from "jose";

const CHALLENGE_TTL_S = 5 * 60; // 5 minutes
function challengeSecret() { return new TextEncoder().encode(process.env.JWT_SECRET || ""); }

const BCRYPT_ROUNDS = 12;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RESET_TTL_MS = 60 * 60 * 1000; // 1h

const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(12).max(200),
  name: z.string().trim().min(1).max(120).optional(),
});
const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
});
const forgotSchema = z.object({ email: z.string().email().max(320) });
const resetSchema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(12).max(200),
});

/**
 * Reject trivially weak passwords beyond the length floor: all-same-char,
 * simple sequences, and a small blocklist of the most common choices. Cheap,
 * offline, no external dependency (a full HIBP k-anonymity check can layer on
 * top later).
 */
const COMMON_WEAK = new Set([
  "password", "passord", "12345678", "123456789", "1234567890",
  "qwertyuiop", "iloveyou", "admin1234", "welcome1234", "passordet",
]);
function isWeakPassword(pw: string): boolean {
  const p = pw.toLowerCase();
  if (COMMON_WEAK.has(p)) return true;
  if (/^(.)\1+$/.test(pw)) return true;                 // all same character
  if (/^(0123456789|abcdefghij|qwertyuiop)/.test(p)) return true; // obvious sequence
  return false;
}

function setSessionCookie(req: Request, res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
}

/** Random raw token + its SHA-256 hash (only the hash is persisted). */
function makeToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

function siteUrl(req: Request): string {
  const env = process.env.PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string) ?? req.protocol ?? "https";
  const host = (req.headers["x-forwarded-host"] as string) ?? (req.headers.host as string) ?? "";
  return `${proto}://${host}`;
}

export function registerEmailAuthRoutes(app: Express) {
  /** POST /api/auth/register { email, password, name? } */
  app.post("/api/auth/register", authRateLimiter, async (req: Request, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Ugyldig e-post eller passord (passordet må være minst 12 tegn)." });
    }
    if (isWeakPassword(parsed.data.password)) {
      return res.status(400).json({ error: "Passordet er for svakt. Velg et sterkere passord (minst 12 tegn, unngå vanlige passord)." });
    }
    const email = parsed.data.email.toLowerCase().trim();
    try {
      const existing = await db.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: "E-postadressen er allerede registrert." });
      }
      const passwordHash = await bcrypt.hash(parsed.data.password, BCRYPT_ROUNDS);
      const openId = "email_" + nanoid(24);
      const name = parsed.data.name ?? email.split("@")[0];
      const user = await db.createEmailUser({ openId, email, name, passwordHash });

      // Fire-and-forget verification email; never block registration on email errors.
      try {
        const { raw, hash } = makeToken();
        await db.createAuthToken({
          userId: user.id,
          type: "verify_email",
          tokenHash: hash,
          expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
        });
        const link = `${siteUrl(req)}/api/auth/verify-email?token=${raw}`;
        await sendVerificationEmail(email, name, link);
      } catch (mailErr) {
        console.error("[EmailAuth] verification email failed (continuing):", mailErr);
      }

      const sessionToken = await sdk.createSessionToken(openId, {
        name: user.name ?? "",
        expiresInMs: ONE_YEAR_MS,
      });
      setSessionCookie(req, res, sessionToken);
      return res.json({ ok: true });
    } catch (err) {
      console.error("[EmailAuth] register failed:", err);
      return res.status(500).json({ error: "Det oppstod en feil. Prøv igjen." });
    }
  });

  /** POST /api/auth/login/email { email, password } */
  app.post("/api/auth/login/email", authRateLimiter, async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Ugyldig e-post eller passord." });
    }
    const email = parsed.data.email.toLowerCase().trim();
    try {
      const user = await db.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: "Feil e-post eller passord." });
      }
      const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!ok) {
        return res.status(401).json({ error: "Feil e-post eller passord." });
      }
      // If 2FA is on, do NOT issue a session yet — return a short-lived challenge.
      if ((user as any).twoFactorEnabled) {
        const challenge = await new SignJWT({ purpose: "2fa", uid: user.id, openId: user.openId })
          .setProtectedHeader({ alg: "HS256" })
          .setExpirationTime(`${CHALLENGE_TTL_S}s`)
          .sign(challengeSecret());
        return res.json({ requires2fa: true, challenge });
      }
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name ?? "",
        expiresInMs: ONE_YEAR_MS,
      });
      setSessionCookie(req, res, sessionToken);
      return res.json({ ok: true });
    } catch (err) {
      console.error("[EmailAuth] login failed:", err);
      return res.status(500).json({ error: "Det oppstod en feil. Prøv igjen." });
    }
  });

  /** POST /api/auth/login/2fa { challenge, code } — completes a 2FA login. */
  app.post("/api/auth/login/2fa", authRateLimiter, async (req: Request, res: Response) => {
    const challenge = typeof req.body?.challenge === "string" ? req.body.challenge : "";
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    if (!challenge || !code) return res.status(400).json({ error: "Ugyldig forespørsel." });
    try {
      let uid: number;
      let openId: string;
      try {
        const { payload } = await jwtVerify(challenge, challengeSecret());
        if (payload.purpose !== "2fa") throw new Error("bad purpose");
        uid = Number(payload.uid);
        openId = String(payload.openId);
      } catch {
        return res.status(401).json({ error: "Utløpt eller ugyldig forespørsel. Logg inn på nytt." });
      }
      const { getDb } = await import("../db");
      const { users } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const dbi = await getDb();
      if (!dbi) return res.status(500).json({ error: "Det oppstod en feil." });
      const [user] = await dbi.select().from(users).where(eq(users.id, uid)).limit(1);
      if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
        return res.status(401).json({ error: "Feil kode." });
      }
      const { decryptSecret } = await import("../_core/tokenCrypto");
      const { verifyTotp } = await import("../_core/totp");
      const secret = decryptSecret(user.twoFactorSecret);
      let valid = !!secret && verifyTotp(secret, code);
      // Fall back to (and consume) a backup code.
      if (!valid && user.twoFactorBackupCodes) {
        const hashes: string[] = JSON.parse(user.twoFactorBackupCodes);
        let usedIdx = -1;
        for (let i = 0; i < hashes.length; i++) {
          if (await bcrypt.compare(code, hashes[i])) { usedIdx = i; break; }
        }
        if (usedIdx >= 0) {
          valid = true;
          hashes.splice(usedIdx, 1);
          await dbi.update(users).set({ twoFactorBackupCodes: JSON.stringify(hashes) }).where(eq(users.id, uid));
        }
      }
      if (!valid) return res.status(401).json({ error: "Feil kode." });
      const sessionToken = await sdk.createSessionToken(openId, { name: user.name ?? "", expiresInMs: ONE_YEAR_MS });
      setSessionCookie(req, res, sessionToken);
      return res.json({ ok: true });
    } catch (err) {
      console.error("[EmailAuth] 2fa login failed:", err);
      return res.status(500).json({ error: "Det oppstod en feil. Prøv igjen." });
    }
  });

  /** GET /api/auth/verify-email?token=... (link target; redirects back to the app) */
  app.get("/api/auth/verify-email", async (req: Request, res: Response) => {
    const raw = typeof req.query.token === "string" ? req.query.token : "";
    if (!raw) return res.redirect(302, "/login?error=verify_failed");
    try {
      const hash = crypto.createHash("sha256").update(raw).digest("hex");
      const token = await db.getValidAuthToken(hash, "verify_email");
      if (!token) return res.redirect(302, "/login?error=verify_failed");
      await db.markEmailVerified(token.userId);
      await db.markAuthTokenUsed(token.id);
      return res.redirect(302, "/login?verified=1");
    } catch (err) {
      console.error("[EmailAuth] verify-email failed:", err);
      return res.redirect(302, "/login?error=verify_failed");
    }
  });

  /** POST /api/auth/forgot-password { email } — always returns ok (no enumeration). */
  app.post("/api/auth/forgot-password", authRateLimiter, async (req: Request, res: Response) => {
    const parsed = forgotSchema.safeParse(req.body);
    // Generic success even on bad input, to avoid leaking which emails exist.
    if (!parsed.success) return res.json({ ok: true });
    const email = parsed.data.email.toLowerCase().trim();
    try {
      const user = await db.getUserByEmail(email);
      if (user && user.passwordHash) {
        const { raw, hash } = makeToken();
        await db.createAuthToken({
          userId: user.id,
          type: "reset_password",
          tokenHash: hash,
          expiresAt: new Date(Date.now() + RESET_TTL_MS),
        });
        const link = `${siteUrl(req)}/reset-password?token=${raw}`;
        await sendPasswordResetEmail(email, user.name ?? email.split("@")[0], link);
      }
    } catch (err) {
      console.error("[EmailAuth] forgot-password failed:", err);
    }
    return res.json({ ok: true });
  });

  /** POST /api/auth/resend-verification { email } — re-sends the verification link. */
  app.post("/api/auth/resend-verification", async (req: Request, res: Response) => {
    const parsed = forgotSchema.safeParse(req.body);
    if (!parsed.success) return res.json({ ok: true });
    const email = parsed.data.email.toLowerCase().trim();
    try {
      const user = await db.getUserByEmail(email);
      if (user && user.passwordHash && !user.emailVerified) {
        const { raw, hash } = makeToken();
        await db.createAuthToken({
          userId: user.id,
          type: "verify_email",
          tokenHash: hash,
          expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
        });
        const link = `${siteUrl(req)}/api/auth/verify-email?token=${raw}`;
        await sendVerificationEmail(email, user.name ?? email.split("@")[0], link);
      }
    } catch (err) {
      console.error("[EmailAuth] resend-verification failed:", err);
    }
    return res.json({ ok: true });
  });

  /** POST /api/auth/reset-password { token, password } */
  app.post("/api/auth/reset-password", authRateLimiter, async (req: Request, res: Response) => {
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Ugyldig forespørsel (passordet må være minst 12 tegn)." });
    }
    if (isWeakPassword(parsed.data.password)) {
      return res.status(400).json({ error: "Passordet er for svakt. Velg et sterkere passord (minst 12 tegn, unngå vanlige passord)." });
    }
    try {
      const hash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");
      const token = await db.getValidAuthToken(hash, "reset_password");
      if (!token) {
        return res.status(400).json({ error: "Lenken er ugyldig eller utløpt. Be om en ny." });
      }
      const passwordHash = await bcrypt.hash(parsed.data.password, BCRYPT_ROUNDS);
      await db.updateUserPassword(token.userId, passwordHash);
      await db.markAuthTokenUsed(token.id);
      // Invalidate every existing session after a password reset.
      await db.incrementUserTokenVersion(token.userId);
      return res.json({ ok: true });
    } catch (err) {
      console.error("[EmailAuth] reset-password failed:", err);
      return res.status(500).json({ error: "Det oppstod en feil. Prøv igjen." });
    }
  });
}
