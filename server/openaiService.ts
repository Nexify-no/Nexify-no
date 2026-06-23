/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import OpenAI from "openai";

const forgeApiUrl = process.env.BUILT_IN_FORGE_API_URL || "https://api.openai.com";
const forgeApiKey = process.env.BUILT_IN_FORGE_API_KEY || process.env.OPENAI_API_KEY || "";

const openai = new OpenAI({
  apiKey: forgeApiKey,
  baseURL: `${forgeApiUrl.replace(/\/$/, "")}/v1`,
});

import { buildContentPrompt, type ContentOptions } from "./promptBuilder";
import { ENV } from "./_core/env";

export type Platform = "linkedin" | "twitter" | "instagram" | "facebook";

export type ContentTone = "professional" | "casual" | "friendly" | "formal" | "humorous";

// Generation now accepts the full expanded option set (see promptBuilder.ContentOptions).
export type GenerateContentParams = ContentOptions;

const platformInstructions = {
  linkedin: {
    maxLength: 3000,
    style: "Professional networking content with insights and value. Use line breaks for readability. Include relevant hashtags (3-5).",
    format: "Start with a hook, provide value, end with a call-to-action or question.",
  },
  twitter: {
    maxLength: 280,
    style: "Concise, engaging, and punchy. Use 1-2 relevant hashtags.",
    format: "Hook + value in under 280 characters. Make every word count.",
  },
  instagram: {
    maxLength: 2200,
    style: "Visual storytelling with emojis and line breaks. Include 10-15 relevant hashtags at the end.",
    format: "Engaging caption that complements visual content. Use emojis strategically.",
  },
  facebook: {
    maxLength: 63206,
    style: "Conversational and engaging. Encourage comments and shares.",
    format: "Start with attention-grabbing hook, tell a story, end with engagement prompt.",
  },
};

export async function generateContent(params: GenerateContentParams): Promise<string> {
  const { platform } = params;

  // The prompt-engineering layer: turn the user's options into a professional prompt.
  const { system, user, maxLength } = buildContentPrompt(params);

  try {
    const completion = await openai.chat.completions.create({
      model: ENV.contentModel,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.8,
      max_tokens: platform === "twitter" ? 100 : 1000,
    });

    const content = completion.choices[0]?.message?.content || "";

    // Ensure content doesn't exceed platform limits
    if (content.length > maxLength) {
      return content.substring(0, maxLength - 3) + "...";
    }

    return content.trim();
  } catch (error) {
    console.error("Error generating content with OpenAI:", error);
    throw new Error("Failed to generate content. Please try again.");
  }
}

export async function improveContent(
  originalContent: string,
  platform: Platform,
  improvementType: "grammar" | "engagement" | "clarity" | "tone"
): Promise<string> {
  const improvementPrompts = {
    grammar: "Fix any grammar, spelling, or punctuation errors while preserving the original meaning and style.",
    engagement: "Rewrite to be more engaging and likely to generate likes, comments, and shares. Keep the core message.",
    clarity: "Improve clarity and readability while maintaining the original message. Make it easier to understand.",
    tone: "Adjust the tone to be more professional and appropriate for the platform while keeping the content.",
  };

  const platformInfo = platformInstructions[platform];

  try {
    const completion = await openai.chat.completions.create({
      model: ENV.llmModel,
      messages: [
        {
          role: "system",
          content: `You are an expert ${platform} content editor. ${improvementPrompts[improvementType]}
          
Platform: ${platform}
Style Guidelines: ${platformInfo.style}
Max Length: ${platformInfo.maxLength} characters

CRITICAL: Keep the output in the SAME language as the original content (do not translate it).

Return ONLY the improved content, no explanations or meta-commentary.`,
        },
        {
          role: "user",
          content: originalContent,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    return completion.choices[0]?.message?.content?.trim() || originalContent;
  } catch (error) {
    console.error("Error improving content with OpenAI:", error);
    throw new Error("Failed to improve content. Please try again.");
  }
}

/**
 * Generate image using DALL-E 3
 * @param prompt - Detailed image generation prompt
 * @returns URL of the generated image stored in S3
 */
export async function generateImageWithDallE(prompt: string): Promise<string> {
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard", // or "hd" for higher quality (costs more)
      response_format: "url",
    });

    if (!response.data || response.data.length === 0) {
      throw new Error("No image data returned from DALL-E 3");
    }
    
    const imageUrl = response.data[0]?.url;
    if (!imageUrl) {
      throw new Error("No image URL returned from DALL-E 3");
    }

    // Download the image and upload to S3
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image from DALL-E: ${imageResponse.statusText}`);
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    
    // Upload to S3
    const { storagePut } = await import("./storage");
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(7);
    const { url } = await storagePut(
      `generated/dalle-${timestamp}-${randomSuffix}.png`,
      imageBuffer,
      "image/png"
    );

    return url;
  } catch (error) {
    console.error("Error generating image with DALL-E 3:", error);
    throw new Error(`Failed to generate image with DALL-E 3: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}