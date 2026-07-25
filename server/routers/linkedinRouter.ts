/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Extracted from server/routers.ts (app-layer feature router).
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const linkedinRouter = router({    // Save LinkedIn app credentials (owner only)
    saveCredentials: protectedProcedure
      .input(z.object({
        clientId: z.string().min(1),
        clientSecret: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        // Platform-wide LinkedIn OAuth credentials — admin only.
        if ((ctx.user as any)?.role !== "admin") throw new Error("Unauthorized");
        const { getDb } = await import("../db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { linkedinAppCredentials } = await import("../../drizzle/schema");

        // Check if credentials already exist
        const existing = await db.select().from(linkedinAppCredentials).limit(1);
        
        if (existing.length > 0) {
          // Update existing
          const { eq } = await import("drizzle-orm");
          await db.update(linkedinAppCredentials)
            .set({
              clientId: input.clientId,
              clientSecret: input.clientSecret,
            })
            .where(eq(linkedinAppCredentials.id, existing[0].id));
        } else {
          // Insert new
          await db.insert(linkedinAppCredentials).values({
            clientId: input.clientId,
            clientSecret: input.clientSecret,
          });
        }
        
        return { success: true };
      }),

    // Get LinkedIn app credentials (admin only)
    getCredentials: protectedProcedure.query(async ({ ctx }) => {
      if ((ctx.user as any)?.role !== "admin") throw new Error("Unauthorized");
      // Env vars (set in Render) take priority and need no DB row.
      if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
        return { clientId: process.env.LINKEDIN_CLIENT_ID, configured: true };
      }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { linkedinAppCredentials } = await import("../../drizzle/schema");

      const credentials = await db.select().from(linkedinAppCredentials).limit(1);
      
      if (credentials.length === 0) {
        return null;
      }
      
      // Return only clientId (hide secret)
      return {
        clientId: credentials[0].clientId,
        configured: true,
      };
    }),

    // Get LinkedIn authorization URL
    getAuthUrl: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { linkedinAppCredentials } = await import("../../drizzle/schema");
      const { getLinkedInAuthUrl, resolveLinkedInCredentials } = await import("../linkedinService");
      
      const credentials = await db.select().from(linkedinAppCredentials).limit(1);
      const appCreds = resolveLinkedInCredentials(credentials[0] ?? null);
      if (!appCreds) {
        throw new Error("LinkedIn credentials not configured");
      }
      
      // Build an ABSOLUTE https callback that LinkedIn will accept. The Origin
      // header is often absent on the tRPC request (=> "undefined/..."), so derive
      // from the Host header (or the configured env) and force https.
      const redirectUri = process.env.LINKEDIN_REDIRECT_URI
        || `https://${ctx.req.headers.host || "penna.no"}/api/linkedin/callback`;
      const { signOAuthState } = await import("../_core/oauthState");
      const state = signOAuthState(ctx.user.id); // HMAC-signed, tamper-proof CSRF state
      
      const authUrl = getLinkedInAuthUrl(appCreds, redirectUri, state);
      
      return { url: authUrl, state };
    }),

    // Authorization URL for connecting the Company-Page app (org scopes).
    getOrgAuthUrl: protectedProcedure.query(async ({ ctx }) => {
      const { getLinkedInOrgAuthUrl, resolveLinkedInOrgCredentials } = await import("../linkedinService");
      const orgCreds = resolveLinkedInOrgCredentials();
      if (!orgCreds) throw new Error("Company-Page app not configured");
      const redirectUri = process.env.LINKEDIN_ORG_REDIRECT_URI
        || `https://${ctx.req.headers.host || "penna.no"}/api/linkedin/org/callback`;
      const { signOAuthState } = await import("../_core/oauthState");
      const state = signOAuthState(ctx.user.id);
      return { url: getLinkedInOrgAuthUrl(orgCreds, redirectUri, state), state };
    }),

    // Get user's LinkedIn connection status
    getConnectionStatus: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { linkedinConnections } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const { isTokenExpired } = await import("../linkedinService");
      
      const connection = await db.select()
        .from(linkedinConnections)
        .where(eq(linkedinConnections.userId, ctx.user.id))
        .limit(1);
      
      if (connection.length === 0) {
        return { connected: false };
      }
      
      const expired = isTokenExpired(connection[0].expiresAt);
      
      const { isOrgPostingEnabled } = await import("../linkedinService");
      return {
        connected: !expired,
        profileName: connection[0].profileName,
        profileEmail: connection[0].profileEmail,
        expiresAt: connection[0].expiresAt,
        // Company-Page publishing controls (only meaningful when enabled).
        orgPostingEnabled: isOrgPostingEnabled(),
        orgConnected: !!(connection[0] as any).orgAccessToken,
        publishTarget: (connection[0] as any).publishTarget || "person",
        organizationUrn: (connection[0] as any).organizationUrn || null,
        organizationName: (connection[0] as any).organizationName || null,
      };
    }),

    // List the Company Pages the connected member administers, so the UI can
    // offer them as publish targets. Returns { enabled:false } unless org posting
    // is turned on (env flag) AND the app was approved for the scopes.
    listOrganizations: protectedProcedure.query(async ({ ctx }) => {
      const { isOrgPostingEnabled, getAdminOrganizations } = await import("../linkedinService");
      if (!isOrgPostingEnabled()) return { enabled: false, organizations: [] as { urn: string; id: string; name: string }[] };
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { linkedinConnections } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const conn = await db.select().from(linkedinConnections).where(eq(linkedinConnections.userId, ctx.user.id)).limit(1);
      if (conn.length === 0) return { enabled: true, orgConnected: false, organizations: [] };
      const orgToken = (conn[0] as any).orgAccessToken;
      if (!orgToken) return { enabled: true, orgConnected: false, organizations: [] };
      const { decryptSecret } = await import("../_core/tokenCrypto");
      try {
        const organizations = await getAdminOrganizations(decryptSecret(orgToken) ?? "");
        return { enabled: true, orgConnected: true, organizations };
      } catch (e) {
        return { enabled: true, orgConnected: true, organizations: [], error: (e as Error).message };
      }
    }),

    // Choose whether to publish to the personal feed or a Company Page.
    setPublishTarget: protectedProcedure
      .input(z.object({
        target: z.enum(["person", "organization"]),
        organizationUrn: z.string().optional(),
        organizationName: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.target === "organization" && !input.organizationUrn) {
          throw new Error("Velg en side å publisere til.");
        }
        const { getDb } = await import("../db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { linkedinConnections } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db.update(linkedinConnections)
          .set({
            publishTarget: input.target,
            organizationUrn: input.target === "organization" ? (input.organizationUrn ?? null) : null,
            organizationName: input.target === "organization" ? (input.organizationName ?? null) : null,
          })
          .where(eq(linkedinConnections.userId, ctx.user.id));
        return { success: true };
      }),

    // Disconnect LinkedIn
    disconnect: protectedProcedure.mutation(async ({ ctx }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { linkedinConnections } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      
      await db.delete(linkedinConnections)
        .where(eq(linkedinConnections.userId, ctx.user.id));
      
      return { success: true };
    }),

    // Create LinkedIn post
    createPost: protectedProcedure
      .input(z.object({
        content: z.string().min(1).max(3000),
        postId: z.number().optional(),
        imageUrl: z.string().optional(),
        /** Multi-brand: publish only through this brand's destination (MB2). */
        brandId: z.number().int().positive().optional(),
        /** Client-supplied key so a double click can never publish twice (MB2). */
        idempotencyKey: z.string().trim().min(8).max(64).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { linkedinConnections, posts } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const { createLinkedInPost, isTokenExpired } = await import("../linkedinService");
        
        // Get user's LinkedIn connection
        const connection = await db.select()
          .from(linkedinConnections)
          .where(eq(linkedinConnections.userId, ctx.user.id))
          .limit(1);
        
        if (connection.length === 0) {
          throw new Error("LinkedIn not connected");
        }
        
        // Check if token expired
        if (isTokenExpired(connection[0].expiresAt)) {
          throw new Error("LinkedIn token expired. Please reconnect.");
        }
        
        // ── Multi-brand safety (MB2) ─────────────────────────────────────
        // A post may only go out through a connection owned by the SAME brand.
        // Also reserve an idempotency row so a repeated click cannot double-post.
        const { ENV: _ENV } = await import("../_core/env");
        let publicationId: number | null = null;
        let publishBrandId: number | null = null;
        if (_ENV.featureMultiBrand) {
          const { getActiveBrandId } = await import("../services/brands");
          const { getDestination, assertBrandOwnsConnection } = await import("../services/socialDestinations");
          const { publications } = await import("../../drizzle/schema");

          publishBrandId = input.brandId ?? (await getActiveBrandId(ctx.user.id));
          // The post's own brand wins when it is known (never publish A as B).
          if (input.postId) {
            const [owned] = await db.select().from(posts)
              .where(and(eq(posts.id, input.postId), eq(posts.userId, ctx.user.id))).limit(1);
            if (!owned) throw new Error("Innlegget finnes ikke.");
            if (owned.brandId != null) publishBrandId = owned.brandId;
          }

          const destination = await getDestination(ctx.user.id, publishBrandId, "linkedin");
          if (!destination) {
            throw new Error("Denne merkevaren har ingen tilkoblet LinkedIn-side. Koble til før du publiserer.");
          }
          assertBrandOwnsConnection({
            accountId: ctx.user.id,
            postBrandId: publishBrandId,
            connectionBrandId: destination.brandId,
            platform: "linkedin",
            postId: input.postId,
          });

          if (input.idempotencyKey) {
            try {
              await db.insert(publications).values({
                accountId: ctx.user.id,
                brandId: publishBrandId,
                postId: input.postId ?? 0,
                connectionId: destination.id,
                platform: "linkedin",
                destinationId: destination.destinationId,
                destinationName: destination.destinationName,
                idempotencyKey: input.idempotencyKey,
                status: "pending",
              });
              const [row] = await db.select().from(publications)
                .where(and(
                  eq(publications.accountId, ctx.user.id),
                  eq(publications.idempotencyKey, input.idempotencyKey),
                )).limit(1);
              publicationId = row?.id ?? null;
            } catch {
              // Unique(account, idempotency_key) hit -> this exact publish already ran.
              throw new Error("Dette innlegget er allerede publisert.");
            }
          }
        }

        // Create post (tokens are encrypted at rest). Company-Page posting uses
        // the SEPARATE org token from the Community-Management app; personal
        // posting uses the member token.
        const { decryptSecret } = await import("../_core/tokenCrypto");
        const toOrg =
          (connection[0] as any).publishTarget === "organization" && (connection[0] as any).organizationUrn;
        const authorOverride = toOrg ? (connection[0] as any).organizationUrn : null;
        if (toOrg && !(connection[0] as any).orgAccessToken) {
          throw new Error("Bedriftsside ikke tilkoblet. Koble til bedriftsside først.");
        }
        const activeToken = toOrg
          ? decryptSecret((connection[0] as any).orgAccessToken) ?? ""
          : decryptSecret(connection[0].accessToken) ?? "";
        // Resolve the image to attach: prefer the saved post's stored image
        // (source of truth), else the one passed in. Text-only if none.
        let imageUrl: string | null = input.imageUrl ?? null;
        if (input.postId) {
          const row = await db.select().from(posts)
            .where(and(eq(posts.id, input.postId), eq(posts.userId, ctx.user.id)))
            .limit(1);
          if (row.length > 0 && (row[0] as any).imageUrl) imageUrl = (row[0] as any).imageUrl;
        }
        const result = await createLinkedInPost(
          activeToken,
          connection[0].personUrn,
          input.content,
          authorOverride,
          imageUrl
        );

        // Record the publication locally so "Mine innlegg" reflects it as published
        // (previously the post went live on LinkedIn but left no local trace).
        const publishedAt = new Date();
        const { createPost, recordPostAnalytics } = await import("../db");
        let publishedPostId = input.postId;
        if (input.postId) {
          await db.update(posts)
            .set({ status: "published", publishedAt })
            .where(and(eq(posts.id, input.postId), eq(posts.userId, ctx.user.id)));
        } else {
          const saved = await createPost({
            userId: ctx.user.id,
            platform: "linkedin",
            tone: "professional",
            rawInput: "Publisert direkte til LinkedIn",
            generatedContent: input.content,
            status: "published",
            publishedAt,
          });
          publishedPostId = saved.id;
        }
        // result.id is the LinkedIn platform post id (URN/share id) returned by createLinkedInPost.
        if (publishedPostId) await recordPostAnalytics(ctx.user.id, publishedPostId, "linkedin", publishedAt, result?.id ?? null);

        // Close the publication record with the provider response (MB2 audit trail).
        if (publicationId != null) {
          const { publications } = await import("../../drizzle/schema");
          await db.update(publications).set({
            status: "published",
            providerPostId: result?.id ?? null,
            providerResponse: JSON.stringify(result ?? {}).slice(0, 2_000),
            publishedAt,
            postId: publishedPostId ?? 0,
          }).where(eq(publications.id, publicationId));
        }

        return result;
      }),
  });
