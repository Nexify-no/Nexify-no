/**
 * Email + password authentication routes.
 *
 * Mirrors the session model used by Google/Vipps OAuth: on success we mint the
 * SAME JWT session token (sdk.createSessionToken) and set the SAME cookie
 * (COOKIE_NAME via getSessionCookieOptions), so the rest of the app treats an
 * email user exactly like an OAuth user. Passwords are hashed with bcrypt and
 * never stored or logged in plaintext.
 *
 * Global middleware already applied before these handlers (see _core/index.ts):
 *   - express.json()  -> req.body parsed
 *   - cookieParser()
 *   - ipRateLimiter   -> per-IP rate limiting
 */
import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { nanoid } from "nanoid";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import * as db from "../db";

const BCRYPT_ROUNDS = 12;

const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
});

function setSessionCookie(req: Request, res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(req),
    maxAge: ONE_YEAR_MS,
  });
}

export function registerEmailAuthRoutes(app: Express) {
  /**
   * POST /api/auth/register  { email, password, name? }
   * Creates a new email/password user and starts a session.
   */
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Ugyldig e-post eller passord (passordet må være minst 8 tegn)." });
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

  /**
   * POST /api/auth/login/email  { email, password }
   * Verifies credentials and starts a session. Uses a single generic error
   * for unknown email vs. wrong password to avoid account enumeration.
   */
  app.post("/api/auth/login/email", async (req: Request, res: Response) => {
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
}
