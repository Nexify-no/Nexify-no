/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import "dotenv/config"; // load .env before anything reads process.env (no-op in prod if absent)
import "./instrument"; // initialise Sentry BEFORE express/other modules load (v8+ requirement)
import * as Sentry from "@sentry/node";
import { captureException } from "./sentry";
import express from "express";
import { createServer } from "http";
import net from "net";
import { randomUUID } from "crypto";
import helmet from "helmet";
import { logger } from "./logger";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { validateEnv } from "./validateEnv";
import { registerTelegramWebhook } from "./telegramWebhookRoute";
import { registerLinkedInCallback } from "./linkedinCallback";
import { registerGoogleOAuthRoutes } from "../routes/googleOAuthRoutes";
import { registerMonitoringRoutes } from "../routes/monitoringRoutes";
import { appRouter } from "../routers";
import { startScheduler, stopScheduler } from "../schedulerService";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import sitemapRoutes from "../routes/sitemapRoutes";
import cookieParser from "cookie-parser";
import { ipRateLimiter, userRateLimiter, checkSubscriptionLimit, checkPlanLimit } from "./rateLimiter";
import { checkRequestSize, validateContentMiddleware, checkSuspiciousActivity } from "./abuseProtection";
import { trackUsage } from "./monitoring";
import { configureSecurityHeaders, enforceHttps } from "./securityHeaders";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Fail-fast: validate the whole environment up front (JWT_SECRET, DATABASE_URL,
  // and — in production — payment/security keys). One clear error beats confusing
  // runtime failures later.
  validateEnv();

  // Request correlation id + structured access log. Assigns/propagates
  // x-request-id so a single request can be traced across logs (and echoed to the
  // client/Sentry). Logs one structured line per /api request on completion.
  app.use((req, res, next) => {
    const rid = (req.headers["x-request-id"] as string) || randomUUID();
    (req as any).id = rid;
    res.setHeader("x-request-id", rid);
    const start = Date.now();
    res.on("finish", () => {
      if (req.path.startsWith("/api")) {
        logger.info("request", {
          rid,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          ms: Date.now() - start,
          uid: (req as any).user?.id,
        });
      }
    });
    next();
  });

  // Security headers with helmet
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://www.googletagmanager.com", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
        connectSrc: ["'self'", "https://api.stripe.com", "https://api.openai.com", "https://www.google-analytics.com", "wss:"],
        frameSrc: ["'self'", "https://js.stripe.com"],
        mediaSrc: ["'self'", "https:"],
        objectSrc: ["'none'"],
        // Local/Docker HTTP runs (DISABLE_HTTPS_REDIRECT=true) have no TLS, so don't
        // let the browser upgrade same-origin asset requests to https — they'd 503
        // and the SPA (Vite client / entry) would never load (blank page).
        ...(process.env.DISABLE_HTTPS_REDIRECT === "true"
          ? { upgradeInsecureRequests: null }
          : {}),
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }));
  
  // Configure security headers first
  configureSecurityHeaders(app);

  // Enforce HTTPS in production
  app.use(enforceHttps);
  
  // Trust proxy for Vercel
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }
  
  // Configure body parser with a bounded size limit (was 50mb — DoS risk).
  // Capture the raw body so webhooks (Vipps) can verify HMAC over the exact bytes.
  app.use(express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  app.use(cookieParser());

  // Explicit CORS allowlist. The SPA is served same-origin (no CORS needed for it),
  // so this is a deny-by-default policy: only the canonical site URL (PUBLIC_SITE_URL)
  // plus any CORS_ALLOWED_ORIGINS are permitted to make credentialed cross-origin
  // calls; every other origin gets no ACAO header and is blocked by the browser.
  const allowedOrigins = new Set(
    [process.env.PUBLIC_SITE_URL, ...(process.env.CORS_ALLOWED_ORIGINS?.split(",") ?? [])]
      .map((o) => o?.trim())
      .filter((o): o is string => !!o)
  );
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-request-id");
      if (req.method === "OPTIONS") return res.sendStatus(204);
    } else if (req.method === "OPTIONS") {
      // Preflight from a non-allowed origin → no CORS headers, end here.
      return res.sendStatus(204);
    }
    next();
  });

  // Global IP-based rate limiting (brute-force / cost-bombing / DoS protection).
  // NOTE: this uses an in-memory store; on serverless (Vercel) back it with a
  // shared store (Upstash/Redis via rate-limit-redis) for it to be effective.
  app.use(ipRateLimiter);
  
  // Liveness — the process is up.
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Readiness — dependencies (DB, Redis) are reachable. Use for load-balancer /
  // orchestrator readiness gating so traffic only routes to healthy instances.
  app.get("/ready", async (_req, res) => {
    const checks: Record<string, "ok" | "down" | "skipped"> = {};
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      await (db as any)?.execute?.("SELECT 1");
      checks.database = db ? "ok" : "down";
    } catch {
      checks.database = "down";
    }
    try {
      const { getRedis } = await import("./redis");
      const redis = getRedis();
      if (!redis) checks.redis = "skipped";
      else { await redis.ping(); checks.redis = "ok"; }
    } catch {
      checks.redis = "down";
    }
    // DB must be up. Redis: if it's CONFIGURED it must be reachable (a configured-
    // but-down Redis means rate limiting is silently broken → not ready). When
    // REDIS_URL is unset, "skipped" doesn't block readiness (single-instance/dev).
    const redisConfigured = !!process.env.REDIS_URL;
    const ready = checks.database === "ok" && (redisConfigured ? checks.redis === "ok" : true);
    res.status(ready ? 200 : 503).json({ ready, checks, timestamp: new Date().toISOString() });
  });

  // Populate req.user from the session cookie so downstream Express middleware
  // (rate limiting by identity, abuse detection, usage tracking) actually works.
  // Non-blocking: public procedures still pass through with req.user = null.
  app.use("/api/trpc", async (req, _res, next) => {
    try {
      const { sdk } = await import("./sdk");
      (req as any).user = await sdk.authenticateRequest(req);
    } catch {
      (req as any).user = null;
    }
    next();
  });

  // Usage/latency metrics per authenticated request (now that req.user is set)
  app.use("/api/trpc", trackUsage);

  // Level 2: Per-user/IP rate limiting on the API surface (login, AI, mutations)
  app.use("/api/trpc", userRateLimiter);

  // Level 3: Abuse Protection
  app.use("/api/trpc", checkRequestSize(100)); // 100KB max
  app.use("/api/trpc", checkSuspiciousActivity);
  app.use("/api/trpc", validateContentMiddleware);
  
  // Level 1: Plan-Based Limits (check subscription and plan)
  app.use("/api/trpc", checkSubscriptionLimit);
  app.use("/api/trpc", checkPlanLimit);
  
  // Google OAuth routes (standalone, sets the app session cookie)
  registerGoogleOAuthRoutes(app);
  
  // Demo/dev login — gated behind an explicit opt-in flag (ENABLE_DEV_LOGIN).
  // Signs you in without OAuth. Accepts GET so it can be opened in a browser.
  // HARD SAFETY: refuse to mount on a real production deploy (HTTPS). It is only
  // permitted in the explicit local/demo plain-HTTP mode (DISABLE_HTTPS_REDIRECT=true),
  // so a stray ENABLE_DEV_LOGIN can never open a no-auth admin door on a public host.
  const devLoginAllowed =
    process.env.ENABLE_DEV_LOGIN === "true" &&
    (process.env.NODE_ENV !== "production" || process.env.DISABLE_HTTPS_REDIRECT === "true");
  if (process.env.ENABLE_DEV_LOGIN === "true" && !devLoginAllowed) {
    console.error("[SECURITY] Refusing to mount dev-login: ENABLE_DEV_LOGIN=true on a production HTTPS deploy. Unset it or use DISABLE_HTTPS_REDIRECT=true for a local/demo run.");
  }
  if (devLoginAllowed) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[SECURITY] dev-login ENABLED (production + plain-HTTP demo) — NEVER expose this on a public deployment.");
    }
    app.all("/api/auth/dev-login", async (req, res) => {
      try {
        const { COOKIE_NAME, ONE_YEAR_MS } = await import("@shared/const");
        const { getSessionCookieOptions } = await import("./cookies");
        const { sdk } = await import("./sdk");
        const dbModule = await import("../db");
        
        console.log("[Dev Login] Starting dev login...");
        
        // Create or get dev user
        await dbModule.upsertUser({
          openId: "dev_user_12345",
          name: "Dev User",
          email: "dev@innlegg.local",
          loginMethod: "dev",
          lastSignedIn: new Date(),
        });
        
        console.log("[Dev Login] User created/updated");

        // Ensure the demo user has a trial subscription so the app is usable.
        try {
          const devUser = await dbModule.getUserByOpenId("dev_user_12345");
          if (devUser) {
            const existing = await dbModule.getUserSubscription(devUser.id);
            if (!existing) {
              await dbModule.createSubscription({
                userId: devUser.id,
                status: "trial",
                trialPostsLimit: 2,
                postsGenerated: 0,
              } as any);
            }
          }
        } catch (e) {
          console.warn("[Dev Login] subscription seed skipped:", (e as Error)?.message);
        }

        // Create session token using SDK
        const sessionToken = await sdk.createSessionToken("dev_user_12345", {
          name: "Dev User",
          expiresInMs: ONE_YEAR_MS,
        });
        
        console.log("[Dev Login] Session token created");
        
        // Set session cookie
        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });
        
        console.log("[Dev Login] Cookie set, redirecting to dashboard");
        res.redirect(302, "/dashboard");
      } catch (error) {
        console.error("[Dev Login] Failed:", error);
        res.redirect(302, "/login?error=dev_login_failed");
      }
    });
  }
  
  // Monitoring and alerting routes
  registerMonitoringRoutes(app);

  // Telegram webhook
  registerTelegramWebhook(app);
  
  // LinkedIn OAuth callback
  registerLinkedInCallback(app);

  // Sitemap and RSS feed routes
  app.use("/", sitemapRoutes);

  // Stripe webhook - MUST be before express.json() middleware for signature verification
  // Note: We need raw body for Stripe signature verification
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    try {
      const { constructWebhookEvent } = await import("../stripe/stripeService");
      const { updateSubscriptionFromStripe, updateSubscriptionStatus, getUserById, markWebhookEventProcessed } = await import("../db");
      const { notifyNewSubscription, notifySubscriptionCancelled, notifyPaymentFailed } = await import("../subscriptionNotifications");
      
      const signature = req.headers["stripe-signature"] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
      
      if (!signature || !webhookSecret) {
        logger.warn("stripe_webhook_missing_signature", { rid: (req as any).id });
        return res.status(400).json({ error: "Missing signature" });
      }

      const event = constructWebhookEvent(
        req.body as Buffer,
        signature,
        webhookSecret
      );

      logger.info("stripe_webhook_received", { rid: (req as any).id, eventId: event.id, type: event.type });

      // Idempotency: ignore events we've already processed (Stripe re-delivers).
      if (!(await markWebhookEventProcessed(event.id, "stripe"))) {
        logger.info("stripe_webhook_duplicate", { rid: (req as any).id, eventId: event.id });
        return res.json({ received: true });
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as any;
        // user_id is set by us on the trusted server side at checkout creation;
        // plan/amount are derived from the trusted product_key, never from the client.
        const userId = parseInt(session.metadata?.user_id || session.client_reference_id || "");
        const productKey = session.metadata?.product_key as string | undefined;

        if (userId && productKey) {
          const { STRIPE_PRODUCTS, getSubscriptionTier } = await import("../stripe/products");
          const { getPlanIdByTier } = await import("../db");
          const product = (STRIPE_PRODUCTS as any)[productKey];
          // Attach the plan so the monthly quota is actually enforced (without a
          // planId, enforcePostQuota treats the active subscription as unlimited).
          const planId = await getPlanIdByTier(getSubscriptionTier(productKey as any));
          await updateSubscriptionFromStripe(userId, {
            status: "active",
            planId: planId ?? undefined,
            stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
            stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : undefined,
          });
          const user = await getUserById(userId);
          if (user) {
            await notifyNewSubscription({
              userName: user.name || "Ukjent",
              userEmail: user.email || session.metadata?.customer_email || "",
              planName: product?.name || productKey,
              amount: ((session.amount_total ?? 0) / 100).toFixed(2),
              currency: (session.currency || "nok").toUpperCase(),
            });
          }
        }
      } else if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object as any;
        const metadata = subscription.metadata || {};
        const userId = parseInt(metadata.userId);

        if (userId) {
          await updateSubscriptionStatus(userId, "cancelled");
          const user = await getUserById(userId);
          if (user) {
            await notifySubscriptionCancelled({
              userName: user.name || "Ukjent",
              userEmail: user.email || "",
            });
          }
        }
      } else if (event.type === "payment_intent.payment_failed") {
        const paymentIntent = event.data.object as any;
        const metadata = paymentIntent.metadata || {};
        const userId = parseInt(metadata.userId);

        if (userId) {
          const user = await getUserById(userId);
          if (user) {
            await notifyPaymentFailed({
              userName: user.name || "Ukjent",
              userEmail: user.email || "",
              errorMessage: paymentIntent.last_payment_error?.message,
            });
          }
        }
      } else if (event.type === "invoice.payment_failed") {
        // Subscription dunning: a recurring charge failed. Stripe retries per its
        // smart-retry schedule and emits customer.subscription.deleted on final failure.
        const invoice = event.data.object as any;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : undefined;
        if (customerId) {
          const { getUserByStripeCustomerId } = await import("../db");
          const user = await getUserByStripeCustomerId(customerId);
          if (user) {
            await notifyPaymentFailed({
              userName: user.name || "Ukjent",
              userEmail: user.email || "",
              errorMessage: "Subscription renewal payment failed — please update your payment method.",
            });
          }
        }
      }

      res.json({ received: true });
    } catch (error) {
      // Signature-verification failures are expected noise; a thrown Error after
      // a verified event (e.g. a DB write failing) is a real incident Stripe will
      // retry — surface it to Sentry so the retry isn't silently invisible.
      logger.error("stripe_webhook_error", { rid: (req as any).id, msg: error instanceof Error ? error.message : String(error) });
      captureException(error instanceof Error ? error : new Error(String(error)), { scope: "stripe-webhook" });
      res.status(400).json({ error: "Webhook error" });
    }
  });

  // Vipps webhook routes (mounts /api/vipps/callback and fallback handlers)
  const { default: vippsWebhookRouter } = await import("../routes/vippsWebhook");
  app.use("/api/vipps", vippsWebhookRouter);

  // tRPC router
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Client serving: Vite dev middleware (HMR) in development; the pre-built
  // static client (dist/public) in production. Running setupVite in production
  // makes "/" 500 (it looks for client/index.html which isn't shipped).
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Report unhandled errors from routes/tRPC/webhooks to Sentry (no-op without DSN).
  Sentry.setupExpressErrorHandler(app);

  // Error-handling middleware — MUST be registered last so it actually catches
  // errors from the routes/tRPC/webhooks above. Fails closed and never leaks
  // internals to clients.
  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error("server_error", { rid: (req as any).id, path: req.path, msg: err?.message || String(err) });
    captureException(err instanceof Error ? err : new Error(String(err?.message || err)));
    if (res.headersSent) return;
    res.status(err?.status || 500).json({ error: "Internal Server Error" });
  });

  // Seed subscription plans so quota enforcement + Vipps amount-matching work.
  try {
    const { ensureSubscriptionPlans } = await import("../db");
    await ensureSubscriptionPlans();
    console.log("[Plans] subscription_plans ensured");
  } catch (e) {
    console.warn("[Plans] could not seed subscription_plans:", (e as Error)?.message);
  }

  // Start the auto-publish scheduler — but ONLY where it's meant to run.
  // It is an in-process node-cron loop, so it must run on exactly ONE instance:
  //  - single long-lived container (recommended): leave RUN_SCHEDULER unset/"true".
  //  - horizontally scaled / serverless: set RUN_SCHEDULER=false on web instances
  //    and run a single dedicated worker (or an external cron) with it "true".
  // Running it on every instance would multiply cron loops (the per-row claim
  // prevents double-publish, but that's a safety net, not the intended topology).
  if (process.env.RUN_SCHEDULER !== "false") {
    startScheduler();
  } else {
    console.log("[Scheduler] Disabled on this instance (RUN_SCHEDULER=false)");
  }

  const port = await findAvailablePort(process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // Graceful shutdown: on deploy/scale-down the platform sends SIGTERM. Stop the
  // scheduler, drain in-flight HTTP requests (so webhooks/payments aren't severed),
  // close Redis, then exit. A hard timeout guards against a stuck connection.
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[shutdown] ${signal} received — draining...`);
    const forceExit = setTimeout(() => {
      console.error("[shutdown] drain timed out, forcing exit");
      process.exit(1);
    }, 10_000);
    forceExit.unref();
    try {
      stopScheduler();
    } catch (e) {
      console.error("[shutdown] stopScheduler failed:", (e as Error)?.message);
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      const { getRedis } = await import("./redis");
      const redis = getRedis();
      if (redis) await redis.quit();
    } catch (e) {
      console.error("[shutdown] redis quit failed:", (e as Error)?.message);
    }
    clearTimeout(forceExit);
    console.log("[shutdown] complete");
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

// Last-resort handlers so a stray rejection in the scheduler/a webhook is
// reported instead of vanishing (or crashing the process unreported).
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
  captureException(reason instanceof Error ? reason : new Error(String(reason)), { kind: "unhandledRejection" });
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  captureException(err, { kind: "uncaughtException" });
});

// A fatal boot error must crash the process (so the orchestrator restarts/flags
// it) rather than leaving a half-initialised server limping.
startServer().catch((err) => {
  console.error("[boot] fatal startup error:", err);
  process.exit(1);
});