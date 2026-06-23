/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { protectedProcedure, publicProcedure, aiProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const hashtagRouter = router({
  generateSuggestions: aiProcedure
    .input(z.object({
      contentTitle: z.string(),
      contentExcerpt: z.string(),
      platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
      postId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { invokeLLM } = await import("../_core/llm");
      const { createHashtagSuggestion, getTrendingHashtags, getUserInterests } = await import("../db");
      
      // Get user's interests for context
      const userInterests = await getUserInterests(ctx.user.id);
      const trendingHashtags = await getTrendingHashtags(input.platform, 15);
      
      // Build prompt for hashtag generation
      const trendingList = trendingHashtags.map(h => h.hashtag).join(", ");
      const userTopics = userInterests?.topics ? (() => { try { return JSON.parse(userInterests.topics!).join(", "); } catch { return userInterests.topics || "general"; } })() : "general";
      const userIndustry = userInterests?.industry || "general";
      
      const prompt = `You are an expert social media strategist. Generate 10-15 relevant hashtags for this ${input.platform} post.

Post Title: ${input.contentTitle}
Post Content: ${input.contentExcerpt}
User Industry: ${userIndustry}
User Topics: ${userTopics}

Trending hashtags to consider: ${trendingList}

Return ONLY a JSON array of hashtag objects with this format:
[{"hashtag": "#example", "relevance": 0.95, "trending": true}, ...]

Make sure hashtags are:
1. Relevant to the content
2. Popular on ${input.platform}
3. Mix of trending and evergreen tags
4. Include niche-specific tags`;
      
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a JSON-generating AI. Always respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
      });
      
      let hashtags = [];
      try {
        const content = response.choices[0]?.message?.content;
        if (content && typeof content === 'string') {
          // Extract JSON from response
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            hashtags = JSON.parse(jsonMatch[0]);
          }
        }
      } catch (e) {
        console.error("Error parsing hashtag response:", e);
      }
      
      // Save suggestions to database
      const suggestion = await createHashtagSuggestion({
        userId: ctx.user.id,
        postId: input.postId,
        contentTitle: input.contentTitle,
        contentExcerpt: input.contentExcerpt,
        platform: input.platform,
        hashtags: JSON.stringify(hashtags),
        trendingHashtags: JSON.stringify(trendingHashtags.map(h => h.hashtag)),
        niche: userIndustry,
        relevanceScore: hashtags.length > 0 
          ? Math.round(hashtags.reduce((sum: number, h: any) => sum + (h.relevance || 0), 0) / hashtags.length * 100)
          : 0,
      });
      
      return {
        hashtags,
        suggestion,
      };
    }),
  
  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ ctx, input }) => {
      const { getHashtagSuggestions } = await import("../db");
      return await getHashtagSuggestions(ctx.user.id, input.limit);
    }),
  
  getTrending: publicProcedure
    .input(z.object({ platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]) }))
    .query(async ({ input }) => {
      const { getTrendingHashtags } = await import("../db");
      return await getTrendingHashtags(input.platform, 20);
    }),
});