/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { router, aiProcedure } from "./_core/trpc";
import { z } from "zod";

/**
 * LangChain tRPC Router
 * Exposes LangChain functionality to the frontend.
 *
 * NOTE: langchain/service is imported LAZILY inside each procedure (not at module
 * scope). It constructs a ChatOpenAI/LangChain instance on load, which is a heavy
 * part of cold-start; deferring it keeps it off the server boot path (appRouter is
 * imported eagerly at startup) so it's only paid on the first LangChain request.
 */

export const langchainRouter = router({
  /**
   * Generate content with voice profile
   */
  generateWithVoice: aiProcedure
    .input(
      z.object({
        platform: z.enum(["linkedin", "twitter", "facebook", "instagram"]),
        topic: z.string().min(5).max(500),
        tone: z.string(),
        length: z.enum(["short", "medium", "long"]),
        keywords: z.string().optional(),
        language: z.enum(["no", "en"]).default("no"),
        vocabularyLevel: z.string().optional(),
        sentenceLength: z.string().optional(),
        emojiUsage: z.string().optional(),
        hashtagStyle: z.string().optional()
      })
    )
    .mutation(async ({ input }: { input: any }) => {
      try {
        const { langchainService } = await import("./langchain/service");
        const content = await langchainService.generateContentWithVoice({
          platform: input.platform,
          topic: input.topic,
          tone: input.tone,
          length: input.length,
          keywords: input.keywords || "",
          language: input.language,
          vocabularyLevel: input.vocabularyLevel,
          sentenceLength: input.sentenceLength,
          emojiUsage: input.emojiUsage,
          hashtagStyle: input.hashtagStyle
        });

        return {
          success: true,
          content,
          generatedAt: new Date()
        };
      } catch (error) {
        console.error("Error generating content with voice:", error);
        throw new Error("Failed to generate content with voice profile");
      }
    }),

  /**
   * Analyze content quality and engagement potential
   */
  analyzeContent: aiProcedure
    .input(
      z.object({
        content: z.string().min(10).max(5000),
        platform: z.enum(["linkedin", "twitter", "facebook", "instagram"]),
        language: z.enum(["no", "en"]).default("no")
      })
    )
    .query(async ({ input }: { input: any }) => {
      try {
        const { langchainService } = await import("./langchain/service");
        const analysis = await langchainService.analyzeContent({
          content: input.content,
          platform: input.platform,
          language: input.language
        });

        return {
          success: true,
          analysis,
          analyzedAt: new Date()
        };
      } catch (error) {
        console.error("Error analyzing content:", error);
        throw new Error("Failed to analyze content");
      }
    }),

  /**
   * AI Coach conversation
   */
  coachChat: aiProcedure
    .input(
      z.object({
        userMessage: z.string().min(1).max(2000),
        conversationHistory: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string()
            })
          )
          .optional()
      })
    )
    .mutation(async ({ input }: { input: any }) => {
      try {
        const { langchainService } = await import("./langchain/service");
        const response = await langchainService.coachConversation({
          userMessage: input.userMessage,
          conversationHistory: input.conversationHistory
        });

        return {
          success: true,
          response,
          respondedAt: new Date()
        };
      } catch (error) {
        console.error("Error in coach conversation:", error);
        throw new Error("Failed to process coach conversation");
      }
    }),

  /**
   * Analyze trends and get content ideas
   */
  analyzeTrends: aiProcedure
    .input(
      z.object({
        trends: z.string().min(10),
        platform: z.enum(["linkedin", "twitter", "facebook", "instagram"]),
        expertise: z.string().optional(),
        targetAudience: z.string().optional(),
        contentStyle: z.string().optional(),
        language: z.enum(["no", "en"]).default("no")
      })
    )
    .query(async ({ input }: { input: any }) => {
      try {
        const { langchainService } = await import("./langchain/service");
        const ideas = await langchainService.analyzeTrends({
          trends: input.trends,
          platform: input.platform,
          expertise: input.expertise || "general",
          targetAudience: input.targetAudience || "general audience",
          contentStyle: input.contentStyle || "professional",
          language: input.language
        });

        return {
          success: true,
          ideas,
          analyzedAt: new Date()
        };
      } catch (error) {
        console.error("Error analyzing trends:", error);
        throw new Error("Failed to analyze trends");
      }
    }),

  /**
   * Improve existing content
   */
  improveContent: aiProcedure
    .input(
      z.object({
        originalContent: z.string().min(10).max(5000),
        platform: z.enum(["linkedin", "twitter", "facebook", "instagram"]),
        tone: z.string(),
        length: z.enum(["short", "medium", "long"]),
        language: z.enum(["no", "en"]).default("no"),
        keywords: z.string().optional(),
        addEmojis: z.boolean().default(true),
        addHashtags: z.boolean().default(true)
      })
    )
    .mutation(async ({ input }: { input: any }) => {
      try {
        const { langchainService } = await import("./langchain/service");
        const improvedContent = await langchainService.improveContent({
          originalContent: input.originalContent,
          platform: input.platform,
          tone: input.tone,
          length: input.length,
          language: input.language,
          keywords: input.keywords || "",
          addEmojis: input.addEmojis,
          addHashtags: input.addHashtags
        });

        return {
          success: true,
          improvedContent,
          improvedAt: new Date()
        };
      } catch (error) {
        console.error("Error improving content:", error);
        throw new Error("Failed to improve content");
      }
    }),

  /**
   * Generate hashtags
   */
  generateHashtags: aiProcedure
    .input(
      z.object({
        content: z.string().min(10).max(5000),
        platform: z.enum(["linkedin", "twitter", "facebook", "instagram"]),
        language: z.enum(["no", "en"]).default("no"),
        numberOfHashtags: z.number().min(3).max(30).default(10),
        includeTrending: z.boolean().default(true)
      })
    )
    .query(async ({ input }: { input: any }) => {
      try {
        const { langchainService } = await import("./langchain/service");
        const hashtags = await langchainService.generateHashtags({
          content: input.content,
          platform: input.platform,
          language: input.language,
          numberOfHashtags: input.numberOfHashtags,
          includeTrending: input.includeTrending
        });

        return {
          success: true,
          hashtags,
          generatedAt: new Date()
        };
      } catch (error) {
        console.error("Error generating hashtags:", error);
        throw new Error("Failed to generate hashtags");
      }
    }),

  /**
   * Create content series
   */
  createContentSeries: aiProcedure
    .input(
      z.object({
        topic: z.string().min(5).max(500),
        numberOfPosts: z.number().min(2).max(10),
        platform: z.enum(["linkedin", "twitter", "facebook", "instagram"]),
        tone: z.string(),
        language: z.enum(["no", "en"]).default("no")
      })
    )
    .mutation(async ({ input }: { input: any }) => {
      try {
        const { langchainService } = await import("./langchain/service");
        const series = await langchainService.createContentSeries({
          topic: input.topic,
          numberOfPosts: input.numberOfPosts,
          platform: input.platform,
          tone: input.tone,
          language: input.language
        });

        return {
          success: true,
          series,
          createdAt: new Date()
        };
      } catch (error) {
        console.error("Error creating content series:", error);
        throw new Error("Failed to create content series");
      }
    })
});