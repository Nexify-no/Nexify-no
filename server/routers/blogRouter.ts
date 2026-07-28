/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Extracted from server/routers.ts (app-layer feature router).
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { storagePut } from "../storage";
import { submitBlogPostToIndexNow } from "../services/indexNow";

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
        const created = await createBlogPost(input as any);
        // Notify IndexNow (Bing/Yandex/DuckDuckGo) instantly on publish.
        if (input.published === 1) {
          void submitBlogPostToIndexNow(input.slug);
        }
        return created;
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
        // Notify IndexNow when an article is (re)published and its slug is known.
        if (input.published === 1 && input.slug) {
          void submitBlogPostToIndexNow(input.slug);
        }
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

        // One shared implementation — this used to be a byte-identical copy of
        // what adminRouter.uploadEmailImage does, and two copies of a validation
        // rule is one copy that gets tightened and one that does not.
        const { uploadRasterImage } = await import("../services/imageUpload");
        return uploadRasterImage("blog-images", input);
      }),
  });