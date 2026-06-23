/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Extracted from server/routers.ts (app-layer feature router).
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { storagePut } from "../storage";

export const blogRouter = router({
    list: publicProcedure.query(async () => {
      const { getAllBlogPosts } = await import("../db");
      return await getAllBlogPosts();
    }),
    
    getBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const { getBlogPostBySlug } = await import("../db");
        return await getBlogPostBySlug(input.slug);
      }),
    
    getByCategory: publicProcedure
      .input(z.object({ category: z.string() }))
      .query(async ({ input }) => {
        const { getBlogPostsByCategory } = await import("../db");
        return await getBlogPostsByCategory(input.category);
      }),
      
    // Admin procedures
    adminList: protectedProcedure.query(async ({ ctx }) => {
      // Check if user is admin
      if (ctx.user.role !== "admin") {
        throw new Error("Unauthorized: Admin access required");
      }
      
      const { getAllBlogPostsAdmin } = await import("../db");
      return await getAllBlogPostsAdmin();
    }),
    
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        slug: z.string().min(1),
        excerpt: z.string().min(1),
        content: z.string().min(1),
        category: z.enum(["tips", "guides", "news", "case-studies"]),
        tags: z.string().optional(),
        authorName: z.string().min(1),
        readingTime: z.number().min(1),
        imageUrl: z.string().optional(),
        published: z.number().min(0).max(1),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if user is admin
        if (ctx.user.role !== "admin") {
          throw new Error("Unauthorized: Admin access required");
        }
        
        const { createBlogPost } = await import("../db");
        return await createBlogPost(input as any);
      }),
      
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        slug: z.string().min(1).optional(),
        excerpt: z.string().min(1).optional(),
        content: z.string().min(1).optional(),
        category: z.enum(["tips", "guides", "news", "case-studies"]).optional(),
        tags: z.string().optional(),
        author: z.string().min(1).optional(),
        imageUrl: z.string().optional(),
        published: z.number().min(0).max(1).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if user is admin
        if (ctx.user.role !== "admin") {
          throw new Error("Unauthorized: Admin access required");
        }
        
        const { id, ...updates } = input;
        const { updateBlogPostAdmin } = await import("../db");
        await updateBlogPostAdmin(id, updates as any);
        return { success: true };
      }),
      
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Check if user is admin
        if (ctx.user.role !== "admin") {
          throw new Error("Unauthorized: Admin access required");
        }
        
        const { deleteBlogPostAdmin } = await import("../db");
        await deleteBlogPostAdmin(input.id);
        return { success: true };
      }),
      
    uploadImage: protectedProcedure
      .input(z.object({
        // No path separators / traversal; bounded length.
        fileName: z.string().min(1).max(128).regex(/^[A-Za-z0-9._-]+$/, "Invalid file name"),
        fileData: z.string().min(1).max(9_000_000), // ~6.5 MB of base64
        // Only real raster image types — blocks SVG/HTML content-type smuggling (stored XSS).
        contentType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if user is admin
        if (ctx.user.role !== "admin") {
          throw new Error("Unauthorized: Admin access required");
        }

        // Generate unique file key. fileName is regex-validated above (no `/`, `\`, `..`).
        const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" }[input.contentType];
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(7);
        const fileKey = `blog-images/${timestamp}-${randomSuffix}.${ext}`;

        // Convert base64 to buffer
        const base64Data = input.fileData.split(',')[1] || input.fileData;
        const buffer = Buffer.from(base64Data, 'base64');

        // Upload to S3
        const { url } = await storagePut(fileKey, buffer, input.contentType);

        return { url, fileKey };
      }),
  });