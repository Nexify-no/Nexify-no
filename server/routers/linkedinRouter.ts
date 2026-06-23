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
      const { getLinkedInAuthUrl } = await import("../linkedinService");
      
      const credentials = await db.select().from(linkedinAppCredentials).limit(1);
      
      if (credentials.length === 0) {
        throw new Error("LinkedIn credentials not configured");
      }
      
      const redirectUri = `${ctx.req.headers.origin}/api/linkedin/callback`;
      const { signOAuthState } = await import("../_core/oauthState");
      const state = signOAuthState(ctx.user.id); // HMAC-signed, tamper-proof CSRF state
      
      const authUrl = getLinkedInAuthUrl(
        {
          clientId: credentials[0].clientId,
          clientSecret: credentials[0].clientSecret,
        },
        redirectUri,
        state
      );
      
      return { url: authUrl, state };
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
      
      return {
        connected: !expired,
        profileName: connection[0].profileName,
        profileEmail: connection[0].profileEmail,
        expiresAt: connection[0].expiresAt,
      };
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
        
        // Create post (token is encrypted at rest)
        const { decryptSecret } = await import("../_core/tokenCrypto");
        const result = await createLinkedInPost(
          decryptSecret(connection[0].accessToken) ?? "",
          connection[0].personUrn,
          input.content
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
        if (publishedPostId) await recordPostAnalytics(ctx.user.id, publishedPostId, "linkedin", publishedAt);

        return result;
      }),
  });