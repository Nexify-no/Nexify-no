/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Image Prompt Optimizer
 * Generates high-quality, detailed prompts for AI image generation
 * based on post content, platform, and tone
 */

export interface ImagePromptInput {
  topic: string;
  platform: "linkedin" | "twitter" | "instagram" | "facebook";
  tone: "professional" | "casual" | "friendly" | "formal" | "humorous";
  keywords?: string[];
}

export interface OptimizedImagePrompt {
  prompt: string;
  negativePrompt: string;
  style: string;
}

/**
 * Generate an optimized image prompt for AI image generation
 * Returns a detailed, high-quality prompt with style guidelines
 */
export function generateOptimizedImagePrompt(input: ImagePromptInput): OptimizedImagePrompt {
  const { topic, platform, tone, keywords } = input;

  // Platform-specific visual styles
  const platformStyles = {
    linkedin: "professional business setting, corporate aesthetic, clean modern design, office environment",
    twitter: "eye-catching, bold colors, simple composition, trending visual style",
    instagram: "aesthetic, visually stunning, vibrant colors, Instagram-worthy, high contrast",
    facebook: "friendly, relatable, warm colors, community-focused, approachable"
  };

  // Tone-specific visual modifiers
  const toneModifiers = {
    professional: "polished, sophisticated, high-end, corporate, refined",
    casual: "relaxed, natural, everyday, comfortable, approachable",
    friendly: "warm, inviting, cheerful, welcoming, positive",
    formal: "elegant, traditional, classic, dignified, structured",
    humorous: "playful, fun, lighthearted, creative, whimsical"
  };

  // Extract key concepts from topic
  const topicKeywords = extractKeywords(topic);
  const allKeywords = [...topicKeywords, ...(keywords || [])];

  // Build the main prompt
  const mainConcept = allKeywords.slice(0, 3).join(", ");
  const styleGuide = platformStyles[platform];
  const toneGuide = toneModifiers[tone];

  const prompt = `
A high-quality, professional image representing: ${mainConcept}.
Visual style: ${styleGuide}, ${toneGuide}.
Context: ${topic.substring(0, 150)}.
Requirements:
- 4K resolution quality
- Professional photography or digital art style
- Clear focal point
- Balanced composition
- Modern aesthetic
- No text or watermarks
- Suitable for ${platform} social media platform
${allKeywords.length > 0 ? `- Include visual elements related to: ${allKeywords.join(", ")}` : ""}
  `.trim();

  // Negative prompt to avoid unwanted elements
  const negativePrompt = `
low quality, blurry, pixelated, distorted, ugly, deformed, text, watermark, logo, 
signature, username, copyright, low resolution, amateur, poor lighting, cluttered,
messy, chaotic, inappropriate, offensive, nsfw, violence, gore
  `.trim();

  // Style classification for image generation APIs
  const style = determineStyle(platform, tone);

  return {
    prompt,
    negativePrompt,
    style
  };
}

/**
 * Extract key concepts from topic text
 */
function extractKeywords(text: string): string[] {
  // Remove common stop words and extract meaningful terms
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
    "be", "have", "has", "had", "do", "does", "did", "will", "would", "should",
    "could", "may", "might", "can", "this", "that", "these", "those", "i", "you",
    "he", "she", "it", "we", "they", "what", "which", "who", "when", "where",
    "why", "how", "all", "each", "every", "both", "few", "more", "most", "other",
    "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than",
    "too", "very", "just", "about", "into", "through", "during", "before", "after"
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));

  // Return unique keywords, limited to top 5
  return Array.from(new Set(words)).slice(0, 5);
}

/**
 * Determine the best style classification for the image
 */
function determineStyle(
  platform: string,
  tone: string
): string {
  // Map platform + tone to specific style categories
  const styleMap: Record<string, string> = {
    "linkedin-professional": "corporate_photography",
    "linkedin-formal": "business_professional",
    "instagram-casual": "lifestyle_photography",
    "instagram-friendly": "bright_colorful",
    "twitter-humorous": "creative_illustration",
    "facebook-friendly": "warm_inviting"
  };

  const key = `${platform}-${tone}`;
  return styleMap[key] || "modern_professional";
}

/**
 * Generate a simplified prompt for faster generation (Nano Banana/Gemini)
 */
export function generateSimplifiedPrompt(input: ImagePromptInput): string {
  const { topic, platform, tone } = input;
  
  const platformStyles = {
    linkedin: "professional business",
    twitter: "eye-catching bold",
    instagram: "aesthetic vibrant",
    facebook: "friendly warm"
  };

  const toneModifiers = {
    professional: "polished sophisticated",
    casual: "relaxed natural",
    friendly: "warm inviting",
    formal: "elegant classic",
    humorous: "playful fun"
  };

  return `${platformStyles[platform]} ${toneModifiers[tone]} image about: ${topic.substring(0, 100)}. High quality, no text, modern style.`;
}