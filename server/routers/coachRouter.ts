/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Extracted from server/routers.ts (app-layer feature router).
import { aiProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const coachRouter = router({
    chat: aiProcedure
      .input(z.object({ message: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const { invokeLLM } = await import("../_core/llm");
        const { getUserPosts, getUserContentAnalyses } = await import("../db");
        
        // Get user's posts and analyses for context
        const posts = await getUserPosts(ctx.user.id);
        const analyses = await getUserContentAnalyses(ctx.user.id);
        
        // Build context
        const avgScore = analyses.length > 0
          ? analyses.reduce((sum: number, a: any) => sum + a.overallScore, 0) / analyses.length
          : 0;
        
        const platformCounts = posts.reduce((acc: Record<string, number>, p) => {
          acc[p.platform] = (acc[p.platform] || 0) + 1;
          return acc;
        }, {});
        
        const analysesText = analyses.slice(0, 3).map((a: any) => {
          const strengths = typeof a.strengths === 'string' ? JSON.parse(a.strengths) : a.strengths;
          return `Score: ${a.overallScore}/10, Strengths: ${Array.isArray(strengths) ? strengths.join(", ") : ""}`;
        }).join(" | ");
        
        const context = `You are an expert content coach helping a user improve their social media content.

User Stats:
- Total posts: ${posts.length}
- Average content score: ${avgScore.toFixed(1)}/10
- Platforms used: ${Object.entries(platformCounts).map(([p, c]) => `${p} (${c})`).join(", ")}
- Recent analyses: ${analysesText}

Provide helpful, actionable advice. Be encouraging but honest. Keep responses concise (2-3 paragraphs max).`;
        
        const response = await invokeLLM({
          messages: [
            { role: "system", content: context },
            { role: "user", content: input.message },
          ],
        });
        
        return {
          message: response.choices[0]?.message?.content || "Sorry, I couldn't generate a response.",
        };
      }),
  });