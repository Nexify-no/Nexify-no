/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

async function loadUser(userId: number) {
  const { getDb } = await import("../db");
  const { users } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return { db, users, eq, user: u };
}

export const twoFactorRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const { user } = await loadUser(ctx.user.id);
    return { enabled: !!user?.twoFactorEnabled };
  }),

  /** Generate a new secret (pending) and return it + the otpauth URI to scan. */
  setup: protectedProcedure.mutation(async ({ ctx }) => {
    const { db, users, eq, user } = await loadUser(ctx.user.id);
    if (user?.twoFactorEnabled) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "2FA er allerede aktivert. Deaktiver først." });
    }
    const { generateBase32Secret, totpUri } = await import("../_core/totp");
    const { encryptSecret } = await import("../_core/tokenCrypto");
    const secret = generateBase32Secret();
    await db.update(users).set({ twoFactorSecret: encryptSecret(secret) }).where(eq(users.id, ctx.user.id));
    const account = user?.email || `user-${ctx.user.id}`;
    return { secret, otpauthUri: totpUri(secret, account) };
  }),

  /** Verify a code against the pending secret and turn 2FA on; returns backup codes once. */
  enable: protectedProcedure
    .input(z.object({ code: z.string().min(6).max(8) }))
    .mutation(async ({ ctx, input }) => {
      const { db, users, eq, user } = await loadUser(ctx.user.id);
      if (!user?.twoFactorSecret) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Start oppsett først." });
      }
      const { decryptSecret } = await import("../_core/tokenCrypto");
      const { verifyTotp, generateBackupCodes } = await import("../_core/totp");
      const secret = decryptSecret(user.twoFactorSecret);
      if (!secret || !verifyTotp(secret, input.code)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Feil kode. Prøv igjen." });
      }
      const codes = generateBackupCodes(10);
      const bcrypt = (await import("bcryptjs")).default;
      const hashed = await Promise.all(codes.map((c) => bcrypt.hash(c, 10)));
      await db.update(users)
        .set({ twoFactorEnabled: 1, twoFactorBackupCodes: JSON.stringify(hashed) })
        .where(eq(users.id, ctx.user.id));
      return { success: true, backupCodes: codes };
    }),

  /** Disable 2FA after verifying a current TOTP or a backup code. */
  disable: protectedProcedure
    .input(z.object({ code: z.string().min(6).max(12) }))
    .mutation(async ({ ctx, input }) => {
      const { db, users, eq, user } = await loadUser(ctx.user.id);
      if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
        return { success: true };
      }
      const { decryptSecret } = await import("../_core/tokenCrypto");
      const { verifyTotp } = await import("../_core/totp");
      const secret = decryptSecret(user.twoFactorSecret);
      let ok = !!secret && verifyTotp(secret, input.code);
      if (!ok && user.twoFactorBackupCodes) {
        const bcrypt = (await import("bcryptjs")).default;
        const hashes: string[] = JSON.parse(user.twoFactorBackupCodes);
        for (const h of hashes) {
          if (await bcrypt.compare(input.code.trim(), h)) { ok = true; break; }
        }
      }
      if (!ok) throw new TRPCError({ code: "BAD_REQUEST", message: "Feil kode." });
      await db.update(users)
        .set({ twoFactorEnabled: 0, twoFactorSecret: null, twoFactorBackupCodes: null })
        .where(eq(users.id, ctx.user.id));
      return { success: true };
    }),
});
