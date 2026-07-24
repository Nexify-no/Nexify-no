/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import OpenAI from "openai";

// Text LLM endpoint. Override order: LLM_API_URL (e.g. a local Ollama / any
// OpenAI-compatible server) → BUILT_IN_FORGE_API_URL → OpenAI default.
const textApiUrl = process.env.LLM_API_URL || process.env.BUILT_IN_FORGE_API_URL || "https://api.openai.com";
const textApiKey = process.env.LLM_API_KEY || process.env.BUILT_IN_FORGE_API_KEY || process.env.OPENAI_API_KEY || "";

const openai = new OpenAI({
  apiKey: textApiKey,
  baseURL: `${textApiUrl.replace(/\/$/, "")}/v1`,
});

// Image generation (DALL-E) must always hit OpenAI — local/text providers like
// Ollama cannot generate images. Kept on OPENAI_API_KEY regardless of LLM_API_URL.
const imageOpenai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || textApiKey,
  baseURL: "https://api.openai.com/v1",
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

/**
 * A single chat completion. Injectable so tests can capture the EXACT prompt
 * each call receives and prove no context bleeds between concurrent calls.
 * Each invocation is fully self-contained: only the system+user built from its
 * own params are sent — there is no shared history or state across calls.
 */
export interface GenerateContentDeps {
  createCompletion?: (args: {
    system: string;
    user: string;
    model: string;
    temperature: number;
    maxTokens: number;
  }) => Promise<string>;
}

/**
 * Strip markdown emphasis (**bold**, ***x***, __bold__) from social copy. Models
 * often emit these, but they render as literal asterisks in a LinkedIn/Facebook
 * post. Hashtags (#tag), bullet dashes and single * are left untouched.
 */
export function stripMarkdownEmphasis(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/___(.+?)___/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/___/g, "")
    .replace(/__/g, "");
}

export async function generateContent(
  params: GenerateContentParams,
  deps: GenerateContentDeps = {},
): Promise<string> {
  const { platform } = params;

  // The prompt-engineering layer: turn the user's options into a professional prompt.
  const { system, user, maxLength } = buildContentPrompt(params);

  const runCompletion =
    deps.createCompletion ??
    (async ({ system, user, model, temperature, maxTokens }) => {
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature,
        max_tokens: maxTokens,
      });
      return completion.choices[0]?.message?.content || "";
    });

  try {
    const content = stripMarkdownEmphasis(await runCompletion({
      system,
      user,
      model: ENV.contentModel,
      temperature: 0.8,
      maxTokens: platform === "twitter" ? 100 : 1000,
    }));

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

    return stripMarkdownEmphasis(completion.choices[0]?.message?.content?.trim() || originalContent);
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
// Retry transient image-provider failures (429 / 5xx) with exponential backoff.
async function withImageRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: any;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const status = e?.status ?? e?.statusCode ?? e?.response?.status;
      const retriable = status === 429 || (typeof status === "number" && status >= 500 && status < 600);
      if (!retriable || i === attempts) break;
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (i - 1), 8000)));
    }
  }
  throw lastErr;
}

export async function generateImageWithDallE(prompt: string): Promise<string> {
  try {
    // Try the image models this OpenAI key actually has access to (varies by
    // account): gpt-image-1 first, then dall-e-3/2. Skip a model the key can't use
    // ("The model '...' does not exist.") instead of failing.
    const models = ["gpt-image-1", "dall-e-3", "dall-e-2"];
    let response: any = null;
    let lastErr: any = null;
    for (const model of models) {
      try {
        response = await withImageRetry(() =>
          imageOpenai.images.generate({ model, prompt, n: 1, size: "1024x1024" })
        );
        break;
      } catch (e: any) {
        const msg = String(e?.message || e);
        const status = e?.status ?? e?.statusCode;
        if ((status === 400 || status === 404) && /does not exist|not have access|unsupported|model/i.test(msg)) {
          lastErr = e;
          continue;
        }
        throw e;
      }
    }
    if (!response) throw lastErr || new Error("No usable image model for this OpenAI key");

    const item = response.data?.[0];
    if (!item) {
      throw new Error("No image data returned from the image API");
    }

    // gpt-image-1 returns base64; dall-e-* returns a URL — handle both.
    let imageBuffer: Buffer;
    if (item.b64_json) {
      imageBuffer = Buffer.from(item.b64_json, "base64");
    } else if (item.url) {
      const imageResponse = await fetch(item.url);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download generated image: ${imageResponse.statusText}`);
      }
      imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    } else {
      throw new Error("No image data (url/b64) returned from the image API");
    }
    
    // Upload to object storage; fall back to an inline data URL if storage is not
    // configured/reachable so the image still displays.
    const { storagePut } = await import("./storage");
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(7);
    try {
      const { url } = await storagePut(
        `generated/dalle-${timestamp}-${randomSuffix}.png`,
        imageBuffer,
        "image/png"
      );
      return url;
    } catch (e) {
      console.warn("[image-gen] storage upload failed, returning data URL:", (e as Error)?.message);
      return `data:image/png;base64,${imageBuffer.toString("base64")}`;
    }
  } catch (error: any) {
    console.error("Error generating image with DALL-E 3:", error);
    const status = error?.status ?? error?.statusCode ?? error?.response?.status;
    if (status === 429) {
      const e = new Error("Image provider rate limited");
      (e as any).code = "TOO_MANY_REQUESTS";
      throw e;
    }
    throw new Error(`Failed to generate image with DALL-E 3: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
