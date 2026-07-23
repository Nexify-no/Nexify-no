/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Extracted from server/routers.ts (app-layer feature router).
import { protectedProcedure, aiProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";

// Shared shape for the expanded content-generation "properties". Reused by the
// generate + enhanceIdea procedures here and (mirrored) by presetsRouter.
export const contentOptionsShape = {
  topic: z.string().min(1).max(4000),
  platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
  tone: z.enum(["professional", "casual", "friendly", "formal", "humorous"]).optional(),
  length: z.enum(["short", "medium", "long"]).optional(),
  keywords: z.array(z.string().max(60)).max(20).optional(),
  // Expanded properties
  targetAudience: z.string().max(280).optional(),
  goal: z.enum(["awareness", "engagement", "sales", "leads", "traffic", "community"]).optional(),
  cta: z.string().max(280).optional(),
  angle: z
    .enum([
      "personal_story", "actionable_tips", "contrarian_opinion", "case_study",
      "shocking_stat", "how_to", "listicle", "question",
    ])
    .optional(),
  // Formatting details
  emojiUsage: z.enum(["none", "minimal", "moderate", "heavy"]).optional(),
  hashtagCount: z.number().int().min(0).max(30).optional(),
  useBullets: z.boolean().optional(),
  closingQuestion: z.boolean().optional(),
  language: z.enum(["no", "en", "ar"]).optional(),
  // When true, the server loads the user's trained voice profile into the prompt.
  useVoiceProfile: z.boolean().optional(),
  useBrandProfile: z.boolean().optional(),
  // Optional generated/uploaded image to persist on the post. May be a long
  // base64 data URL, hence the large max.
  imageUrl: z.string().max(2_000_000).optional(),
} as const;

/** Parse a column that may hold a JSON-encoded string array; tolerate junk. */
function parseStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : undefined;
  } catch {
    return undefined;
  }
}

export const contentRouter = router({
    generate: protectedProcedure
      .input(z.object(contentOptionsShape))
      .mutation(async ({ ctx, input }) => {
        const { getUserSubscription, enforcePostQuota, createPost } = await import("../db");
        const { generateContent } = await import("../openaiService");

        // Single source of truth: checks trial/monthly limit AND reserves the slot
        // server-side (throws if over quota or subscription unusable). Map the quota
        // errors to a clear, user-facing Norwegian message (FORBIDDEN is not
        // redacted in production, unlike a generic 500).
        try {
          await enforcePostQuota(ctx.user.id);
        } catch (e: any) {
          const msg = String(e?.message || "");
          if (/trial limit/i.test(msg)) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Du har brukt opp de gratis innleggene dine. Oppgrader til Pro for 15 innlegg per måned." });
          }
          if (/monthly post limit/i.test(msg)) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Du har brukt opp månedens innlegg på planen din. Oppgrader planen eller vent til neste måned." });
          }
          if (/not active|renew/i.test(msg)) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Abonnementet ditt er ikke aktivt. Forny abonnementet for å fortsette." });
          }
          throw new TRPCError({ code: "FORBIDDEN", message: "Du kan ikke generere flere innlegg akkurat nå. Sjekk abonnementet ditt." });
        }

        // When the user opts in, load their trained voice profile (server-trusted,
        // never client-supplied) and fold it into the prompt.
        // Unique id for THIS generation; stamped on the saved post for provenance
        // and returned to the client. profileVersion records which voice-profile
        // version (if any) shaped the output — 0 means no profile was used.
        const generationId = randomUUID();
        let profileVersion = 0;
        let voiceProfile;
        let brandProfile;
        if (input.useVoiceProfile) {
          const { getDb } = await import("../db");
          const db = await getDb();
          if (db) {
            const { voiceProfiles } = await import("../../drizzle/schema");
            const { eq } = await import("drizzle-orm");
            const [vp] = await db.select().from(voiceProfiles).where(eq(voiceProfiles.userId, ctx.user.id)).limit(1);
            if (vp && vp.trainingStatus === "trained") {
              profileVersion = (vp as any).version ?? 1;
              voiceProfile = {
                profileSummary: vp.profileSummary,
                vocabularyLevel: vp.vocabularyLevel,
                sentenceStyle: vp.sentenceStyle,
                favoriteWords: parseStringArray(vp.favoriteWords),
                signaturePhrases: parseStringArray(vp.signaturePhrases),
              };
            }
          }
        }

        if (input.useBrandProfile !== false) {
          const { getDb } = await import("../db");
          const db = await getDb();
          if (db) {
            const { brandProfiles } = await import("../../drizzle/schema");
            const { and, eq } = await import("drizzle-orm");
            const [bp] = await db.select().from(brandProfiles).where(and(eq(brandProfiles.userId, ctx.user.id), eq(brandProfiles.status, "ready"))).limit(1);
            if (bp) brandProfile = {
              companyName: bp.companyName, industry: bp.industry, summary: bp.summary,
              offers: bp.offers, audiences: bp.audiences, customerProblems: bp.customerProblems,
              differentiators: bp.differentiators, tonePersonality: bp.tonePersonality,
              writingStyle: bp.writingStyle, preferredWords: bp.preferredWords,
              avoidWords: bp.avoidWords, callsToAction: bp.callsToAction,
              contentPillars: bp.contentPillars, facts: bp.facts,
            };
          }
        }

        // Generate content using OpenAI (full expanded option set is forwarded).
        const { useVoiceProfile: _omit, useBrandProfile: _brand, imageUrl: _img, ...genInput } = input;
        const content = await generateContent({ ...genInput, voiceProfile, brandProfile });

        // Provenance trail: one line per generation, strictly scoped to this user.
        console.info("[content.generate]", JSON.stringify({
          generationId,
          userId: ctx.user.id,
          profileVersion,
          usedVoiceProfile: !!voiceProfile,
          platform: input.platform,
          topicChars: input.topic.length,
        }));

        // Persist the generated content as a draft so it shows up under "Mine innlegg".
        // (Generation previously only counted quota and never saved the post, so the
        // list stayed empty and work was lost on navigation.)
        const savedPost = await createPost({
          userId: ctx.user.id,
          platform: input.platform,
          tone: input.tone ?? "professional",
          rawInput: input.topic,
          generatedContent: content,
          imageUrl: (input.imageUrl && /^https?:\/\//.test(input.imageUrl)) ? input.imageUrl : null, // only persist hosted URLs, never giant data: URLs
          tags: input.keywords ?? null,
          status: "draft",
          generationId,
          profileVersion,
        });

        // Get updated subscription
        const updatedSubscription = await getUserSubscription(ctx.user.id);

        return {
          content,
          generationId,
          postId: savedPost.id,
          postsGenerated: updatedSubscription?.postsGenerated || 0,
          postsRemaining: updatedSubscription?.status === "trial"
            ? (updatedSubscription.trialPostsLimit - updatedSubscription.postsGenerated)
            : null,
        };
      }),
      
    // Persist a (later-generated) image onto an existing post. Ownership-checked
    // so a user can only attach to their own posts. Best-effort from the client.
    attachImage: protectedProcedure
      .input(z.object({
        postId: z.number().int().positive(),
        imageUrl: z.string().max(2_000_000),
        // The generation that owns this image. The image is applied only if it
        // still owns the post's image slot; a late/superseded one is rejected.
        generationId: z.string().min(1).max(64).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { posts } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const { nextImageStatus, shouldApplyImage, verifyImageUrl } = await import("../imageLifecycle");

        const [post] = await db
          .select()
          .from(posts)
          .where(and(eq(posts.id, input.postId), eq(posts.userId, ctx.user.id)))
          .limit(1);
        if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke innlegget" });

        // Reject a late/superseded image: a newer generation now owns the slot.
        if (input.generationId && !shouldApplyImage({ imageGenerationId: post.imageGenerationId }, input.generationId)) {
          return { applied: false as const, reason: "superseded" as const, imageStatus: post.imageStatus };
        }

        // verifying -> completed (valid url) or failed (invalid). Only a verified
        // url is ever stored, so a broken/AI-refused image never sticks to a post.
        const verifying = nextImageStatus(post.imageStatus, "uploaded");
        if (verifyImageUrl(input.imageUrl)) {
          const status = nextImageStatus(verifying, "verified");
          await db
            .update(posts)
            .set({ imageUrl: input.imageUrl, imageStatus: status })
            .where(and(eq(posts.id, input.postId), eq(posts.userId, ctx.user.id)));
          return { applied: true as const, imageStatus: status };
        }
        const failed = nextImageStatus(verifying, "verifyFailed");
        await db
          .update(posts)
          .set({ imageStatus: failed })
          .where(and(eq(posts.id, input.postId), eq(posts.userId, ctx.user.id)));
        return { applied: true as const, reason: "invalid_url" as const, imageStatus: failed };
      }),

    // Claim the image slot for a NEW image generation and move it to "generating"
    // so the UI shows a skeleton. Overwrites the owning generationId, so any older
    // in-flight attempt's response is rejected by attachImage afterwards.
    setImageGenerating: protectedProcedure
      .input(z.object({ postId: z.number().int().positive(), generationId: z.string().min(1).max(64) }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { posts } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        await db
          .update(posts)
          .set({ imageGenerationId: input.generationId, imageStatus: "generating" })
          .where(and(eq(posts.id, input.postId), eq(posts.userId, ctx.user.id)));
        return { imageStatus: "generating" as const };
      }),

    enhanceIdea: aiProcedure
      .input(z.object(contentOptionsShape))
      .mutation(async ({ input }) => {
        const { enhanceIdea } = await import("../promptBuilder");
        const enhanced = await enhanceIdea(input);
        return { enhanced };
      }),

    improve: aiProcedure
      .input(z.object({
        content: z.string().min(1),
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
        improvementType: z.enum(["grammar", "engagement", "clarity", "tone"]),
      }))
      .mutation(async ({ input }) => {
        const { improveContent } = await import("../openaiService");
        
        const improvedContent = await improveContent(
          input.content,
          input.platform,
          input.improvementType
        );
        
        return { content: improvedContent };
      }),
      
    generateImageDallE: aiProcedure
      .input(z.object({
        topic: z.string().min(1),
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
        tone: z.enum(["professional", "casual", "friendly", "formal", "humorous"]),
        keywords: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getUserSubscription } = await import("../db");
        const { generateOptimizedImagePrompt } = await import("../imagePromptOptimizer");
        const { generateImageWithDallE } = await import("../openaiService");
        
        // Check subscription - DALL-E 3 is Pro only
        const subscription = await getUserSubscription(ctx.user.id);
        if (!subscription || subscription.status === "trial") {
          throw new TRPCError({ code: "FORBIDDEN", message: "DALL-E 3 krever et Pro-abonnement. Oppgrader, eller bruk FLUX (gratis)." });
        }
        // Server-side image quota + cost cap (same meter as the FLUX path) so the
        // Pro DALL-E route can't be used to run up unbounded OpenAI image spend.
        const { enforceImageQuota } = await import("../db");
        await enforceImageQuota(ctx.user.id);
        
        // Generate optimized prompt
        const optimizedPrompt = generateOptimizedImagePrompt({
          topic: input.topic,
          platform: input.platform,
          tone: input.tone,
          keywords: input.keywords,
        });
        
        // Generate image with DALL-E 3 (provider errors mapped to clean tRPC errors)
        let imageUrl: string;
        try {
          imageUrl = await generateImageWithDallE(optimizedPrompt.prompt);
        } catch (e: any) {
          console.error("[image-gen] failed:", e?.status, e?.message);
          if (e?.code === "TOO_MANY_REQUESTS" || e?.status === 429 || /rate.?limit|too many|429/i.test(String(e?.message))) {
            throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Bildegenerering er opptatt \u2014 pr\u00f8v igjen om litt." });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Kunne ikke generere bilde akkurat n\u00e5. Pr\u00f8v igjen." });
        }

        return { 
          url: imageUrl,
          prompt: optimizedPrompt.prompt,
        };
      }),
      
    generateImageNanoBanana: aiProcedure
      .input(z.object({
        topic: z.string().min(1),
        platform: z.enum(["linkedin", "twitter", "instagram", "facebook"]),
        tone: z.enum(["professional", "casual", "friendly", "formal", "humorous"]),
        keywords: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Enforce per-plan image quota (free/trial = 2 AI images per month).
        const { enforceImageQuota } = await import("../db");
        try {
          await enforceImageQuota(ctx.user.id);
        } catch (e: any) {
          throw new TRPCError({ code: "FORBIDDEN", message: e?.message || "Du har n\u00e5dd bildegrensen for planen din." });
        }
        const { generateSimplifiedPrompt } = await import("../imagePromptOptimizer");
        const { generateImage } = await import("../_core/imageGeneration");

        // Build a faithful, concrete visual prompt with the LLM so the image
        // actually matches the user's topic (which is often Norwegian marketing
        // prose, not a visual description). Fall back to the template on failure.
        let prompt = generateSimplifiedPrompt({
          topic: input.topic,
          platform: input.platform,
          tone: input.tone,
          keywords: input.keywords,
        });
        try {
          const { invokeLLM } = await import("../_core/llm");
          const kw = (input.keywords || []).join(", ");
          const r: any = await invokeLLM({
            messages: [
              {
                role: "system",
                content:
                  "You convert a social-media post idea into ONE concise, concrete English prompt for an AI image generator (FLUX) that CANNOT render text. The generated image MUST contain zero text: no letters, numbers, words or symbols. Rules: (1) NEVER describe signs, banners, posters, cards, screens, books, labels, packaging, logos or any object bearing writing. (2) If the topic implies a written element (a birthday banner, a cake with a name, a poster), REPLACE it with a plain unwritten version: plain colourful balloons, an undecorated cake, plain bunting, blank walls. (3) NEVER quote or transcribe any words from the topic as something visible in the image. (4) Prefer a close-up or shallow-depth-of-field shot of a single concrete subject (people, hands, food, flowers, objects, nature, textures) so no text could appear. Keep the subject concrete, not abstract. Max 50 words. Reply with ONLY the prompt.",
              },
              {
                role: "user",
                content: `Platform: ${input.platform}. Tone: ${input.tone}.${kw ? ` Keywords: ${kw}.` : ""} Post idea (may be Norwegian): ${input.topic.slice(0, 400)}`,
              },
            ],
          });
          const built = String(r?.choices?.[0]?.message?.content || "").trim();
          if (built.length > 10) prompt = `${built.slice(0, 600)} Photorealistic close-up, plain unmarked surfaces.`;
        } catch (e) {
          console.warn("[image-gen] prompt LLM failed, using template:", (e as Error)?.message);
        }
        
        // Generate image (provider errors mapped to clean tRPC errors)
        let result: { url?: string };
        try {
          result = await generateImage({ prompt });
        } catch (e: any) {
          console.error("[image-gen] failed:", e?.status, e?.message);
          if (e?.code === "TOO_MANY_REQUESTS" || e?.status === 429 || /rate.?limit|too many|429/i.test(String(e?.message))) {
            throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Bildegenerering er opptatt \u2014 pr\u00f8v igjen om litt." });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Kunne ikke generere bilde akkurat n\u00e5. Pr\u00f8v igjen." });
        }
        if (!result.url) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Kunne ikke generere bilde akkurat n\u00e5. Pr\u00f8v igjen." });
        }

        return { 
          url: result.url,
          prompt,
        };
      }),
      
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getUserPosts } = await import("../db");
      return getUserPosts(ctx.user.id);
    }),
    
    getActivityData: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { posts } = await import("../../drizzle/schema");
      const { sql } = await import("drizzle-orm");
      
      // Get posts from last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentPosts = await db
        .select({
          createdAt: posts.createdAt,
        })
        .from(posts)
        .where(
          sql`${posts.userId} = ${ctx.user.id} AND ${posts.createdAt} >= ${sevenDaysAgo.getTime()}`
        );
      
      // Group by day
      const activityMap = new Map<string, number>();
      const dayNames = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
      
      // Initialize last 7 days with 0
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayName = dayNames[date.getDay()];
        activityMap.set(dayName, 0);
      }
      
      // Count posts per day
      recentPosts.forEach(post => {
        const date = new Date(post.createdAt);
        const dayName = dayNames[date.getDay()];
        activityMap.set(dayName, (activityMap.get(dayName) || 0) + 1);
      });
      
      // Convert to array format for chart
      const activityData = Array.from(activityMap.entries()).map(([day, posts]) => ({
        day,
        posts,
      }));
      
      return activityData;
    }),
    
    delete: protectedProcedure
      .input(z.object({ postId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getPostById, deletePost } = await import("../db");
        
        // Verify ownership
        const post = await getPostById(input.postId);
        if (!post || post.userId !== ctx.user.id) {
          throw new Error("Post not found or unauthorized");
        }
        
        await deletePost(input.postId, ctx.user.id);
        return { success: true };
      }),
      
    repurpose: protectedProcedure
      .input(z.object({
        postId: z.number(),
        targetPlatform: z.string(),
        repurposeType: z.enum(["platform_adapt", "format_change", "audience_shift", "update"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getUserSubscription, getPostById, createPost } = await import("../db");
        const { invokeLLM } = await import("../_core/llm");
        
        // Check Pro subscription
        const subscription = await getUserSubscription(ctx.user.id);
        if (!subscription || subscription.status !== "active") {
          throw new Error("Gjenbruk-Maskin krever Pro-abonnement");
        }
        
        // Get original post
        const post = await getPostById(input.postId);
        if (!post || post.userId !== ctx.user.id) {
          throw new Error("Post not found or unauthorized");
        }

        // Reuse Merkehjerne so repurposed content keeps the brand voice (M4).
        const { loadBrandHints, renderBrandVoiceBlock } = await import("../services/merkehjerne/brandContext");
        const brandBlock = renderBrandVoiceBlock(await loadBrandHints(ctx.user.id));

        // Generate repurposed content
        const repurposeInstructions = {
          platform_adapt: `Tilpass dette innholdet for ${input.targetPlatform}. Juster lengde, tone og format til plattformen.`,
          format_change: `Endre formatet på dette innholdet for ${input.targetPlatform}. Hvis det er en liste, gjør det til en fortelling, og omvendt.`,
          audience_shift: `Skriv om dette innholdet for en annen målgruppe på ${input.targetPlatform}. Juster språk og eksempler.`,
          update: `Oppdater dette innholdet med fersk informasjon og nye insights for ${input.targetPlatform}.`,
        };
        
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Du er en ekspert på å gjenbruke og tilpasse innhold for sosiale medier. ${repurposeInstructions[input.repurposeType]} Behold kjernebudskapet, men tilpass presentasjonen.${brandBlock ? `\n\n${brandBlock}` : ""}`
            },
            {
              role: "user",
              content: `Originalt innlegg (${post.platform}):\n\n${post.generatedContent}\n\nGjenbruk dette for ${input.targetPlatform}.`
            }
          ]
        });
        
        const { stripMarkdownEmphasis } = await import("../openaiService");
        const repurposedContent = stripMarkdownEmphasis(response.choices[0]?.message?.content ?? "");
        if (typeof repurposedContent !== 'string' || !repurposedContent) {
          throw new Error("Kunne ikke gjenbruke innhold");
        }

        // Persist the repurposed content as a draft so it isn't lost and shows up
        // under "Mine innlegg". Fall back to the source platform if targetPlatform
        // isn't a known post platform.
        const validPlatforms = ["linkedin", "twitter", "instagram", "facebook"] as const;
        const platform = (validPlatforms as readonly string[]).includes(input.targetPlatform)
          ? (input.targetPlatform as (typeof validPlatforms)[number])
          : post.platform;
        const savedPost = await createPost({
          userId: ctx.user.id,
          platform,
          tone: post.tone,
          rawInput: `Gjenbruk (${input.repurposeType}) av innlegg #${post.id}`,
          generatedContent: repurposedContent,
          tags: post.tags ?? null,
          status: "draft",
        });

        return { content: repurposedContent, postId: savedPost.id };
      }),
      
    update: protectedProcedure
      .input(z.object({ postId: z.number(), content: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { getPostById, updatePost } = await import("../db");
        const post = await getPostById(input.postId);
        if (!post || post.userId !== ctx.user.id) {
          throw new Error("Post not found or unauthorized");
        }
        await updatePost(input.postId, ctx.user.id, input.content);
        return { success: true };
      }),
      
    getScheduledPosts: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { posts } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      
      // Get all posts for the user (including scheduled, draft, and published)
      const userPosts = await db
        .select()
        .from(posts)
        .where(eq(posts.userId, ctx.user.id));
      
      return userPosts;
    }),
    
    reschedule: protectedProcedure
      .input(z.object({ postId: z.number(), scheduledFor: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { posts, scheduledPosts } = await import("../../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const { schedulePost } = await import("../services/schedulingService");

        // Verify ownership
        const [post] = await db.select().from(posts).where(
          and(
            eq(posts.id, input.postId),
            eq(posts.userId, ctx.user.id)
          )
        ).limit(1);

        if (!post) {
          throw new Error("Post not found or unauthorized");
        }

        const when = new Date(input.scheduledFor);
        // Atomic: mark the post scheduled, cancel any prior pending schedule
        // entry, and create the fresh schedule row in ONE transaction — so we can
        // never end up with posts.status='scheduled' but no scheduled_posts row
        // (or vice-versa) if a step fails midway.
        await db.transaction(async (tx: any) => {
          await tx.update(posts)
            .set({ scheduledFor: when, status: "scheduled" })
            .where(eq(posts.id, input.postId));

          await tx.update(scheduledPosts)
            .set({ status: "cancelled" })
            .where(and(eq(scheduledPosts.postId, input.postId), eq(scheduledPosts.status, "scheduled")));

          await schedulePost(input.postId, ctx.user.id, post.platform, when, "UTC", tx);
        });

        return { success: true };
      }),
  });
