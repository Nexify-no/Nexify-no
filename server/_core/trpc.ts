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