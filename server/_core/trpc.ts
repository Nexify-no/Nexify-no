/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  // Never leak internal error messages or stack traces to clients in production.
  // Validation (BAD_REQUEST) and explicit auth errors keep their messages; any
  // unexpected throw (DB errors, etc.) is redacted to a generic message.
  errorFormatter({ shape, error }) {
    const isProd = process.env.NODE_ENV === "production";
    const data = { ...shape.data, stack: isProd ? undefined : shape.data?.stack };
    if (isProd && error.code === "INTERNAL_SERVER_ERROR") {
      return { ...shape, message: "Internal server error", data };
    }
    return { ...shape, data };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

// Use for paid AI endpoints (LLM / image generation). Same as protectedProcedure
// plus a per-user rate-limit backstop against runaway OpenAI cost / abuse.
export const aiProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  // Require a verified email for email/password accounts before any paid AI call.
  // Prevents draining the free tier (image-generation cost) via throwaway,
  // unverified signups. OAuth accounts (Google/Vipps/etc.) are provider-verified
  // and therefore exempt (their openId is not prefixed "email_").
  const { getUserById } = await import("../db");
  const u = await getUserById(ctx.user.id);
  // Owner account (OWNER_EMAIL) is exempt from the verification gate — the owner
  // may be unable to receive the verification email (e.g. their own mail host
  // blocks the sender), and must never be locked out of their own product.
  const ownerEmail = process.env.OWNER_EMAIL?.toLowerCase();
  const isOwnerAccount = !!ownerEmail && !!u?.email && u.email.toLowerCase() === ownerEmail;
  if (u && !u.emailVerified && !isOwnerAccount && typeof u.openId === "string" && u.openId.startsWith("email_")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "EMAIL_NOT_VERIFIED" });
  }
  const { enforceAiRateLimit } = await import("./aiRateLimit");
  await enforceAiRateLimit(ctx.user.id);
  return next();
});

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
