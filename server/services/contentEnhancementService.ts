/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Content Enhancement Service
 * Provides writing suggestions, spell/grammar checking, hashtag optimization, and CTA improvements
 */

import { invokeLLM } from "../_core/llm";

/**
 * Content analysis result
 */
export interface ContentAnalysisResult {
  score: number; // 0-100
  suggestions: string[];
  spellErrors: SpellError[];
  grammarErrors: GrammarError[];
  hashtags: HashtagSuggestion[];
  ctas: CTASuggestion[];
  readability: ReadabilityMetrics;
  tone: ToneAnalysis;
}

export interface SpellError {
  word: string;
  position: number;
  suggestions: string[];
}

export interface GrammarError {
  message: string;
  position: number;
  suggestion: string;
}

export interface HashtagSuggestion {
  hashtag: string;
  relevance: number; // 0-100
  trending: boolean;
  category: string;
}

export interface CTASuggestion {
  original: string;
  improved: string;
  reason: string;
  engagementScore: number; // 0-100
}

export interface ReadabilityMetrics {
  flesch_kincaid_grade: number;
  average_sentence_length: number;
  average_word_length: number;
  readability_score: number; // 0-100
  recommendation: string;
}

export interface ToneAnalysis {
  detected_tone: string;
  confidence: number;
  consistency_score: number; // 0-100
  suggestions: string[];
}

/**
 * Analyze content and provide enhancement suggestions
 */
export async function analyzeContent(
  content: string,
  platform: "linkedin" | "twitter" | "instagram" | "facebook",
  language: "en" | "ar" = "en"
): Promise<ContentAnalysisResult> {
  try {
    // Get AI-powered suggestions
    const aiSuggestions = await getAISuggestions(content, platform, language);

    // Calculate readability metrics
    const readability = calculateReadability(content);

    // Analyze tone consistency
    const tone = await analyzeTone(content, language);

    // Extract and optimize hashtags
    const hashtags = await optimizeHashtags(content, platform, language);

    // Analyze and improve CTAs
    const ctas = await analyzeCTAs(content, platform, language);

    // Calculate overall score
    const score = calculateContentScore(
      readability,
      tone,
      hashtags,
      ctas,
      aiSuggestions.suggestions.length
    );

    return {
      score,
      suggestions: aiSuggestions.suggestions,
      spellErrors: aiSuggestions.spellErrors,
      grammarErrors: aiSuggestions.grammarErrors,
      hashtags,
      ctas,
      readability,
      tone,
    };
  } catch (error) {
    console.error("Error analyzing content:", error);
    throw error;
  }
}

/**
 * Get AI-powered writing suggestions
 */
async function getAISuggestions(
  content: string,
  platform: string,
  language: string
) {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a professional content editor. Analyze the following ${language === "ar" ? "Arabic" : "English"} content for a ${platform} post. 
        
        Provide:
        1. Writing improvement suggestions (max 5)
        2. Spell errors with corrections
        3. Grammar errors with corrections
        
        Format your response as JSON with keys: suggestions (array), spellErrors (array), grammarErrors (array).
        Each error should have: word/message, position, and suggestions/suggestion.`,
      },
      {
        role: "user",
        content: `Please analyze this content:\n\n"${content}"`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "content_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: { type: "string" },
              description: "Writing improvement suggestions",
            },
            spellErrors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  word: { type: "string" },
                  position: { type: "number" },
                  suggestions: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: ["word", "position", "suggestions"],
              },
            },
            grammarErrors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  message: { type: "string" },
                  position: { type: "number" },
                  suggestion: { type: "string" },
                },
                required: ["message", "position", "suggestion"],
              },
            },
          },
          required: ["suggestions", "spellErrors", "grammarErrors"],
          additionalProperties: false,
        },
      },
    },
  });

  try {
    const content = response.choices[0].message.content;
    const jsonContent = typeof content === 'string' ? content : JSON.stringify(content);
    const result = JSON.parse(jsonContent);
    return result;
  } catch {
    return {
      suggestions: [],
      spellErrors: [],
      grammarErrors: [],
    };
  }
}

/**
 * Calculate readability metrics
 */
function calculateReadability(content: string): ReadabilityMetrics {
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = content.split(/\s+/).filter((w) => w.length > 0);
  const characters = content.replace(/\s/g, "").length;

  const avgSentenceLength = words.length / sentences.length;
  const avgWordLength = characters / words.length;

  // Flesch-Kincaid Grade Level
  const flesch_kincaid_grade =
    0.39 * avgSentenceLength +
    11.8 * (characters / words.length) -
    15.59;

  // Readability score (0-100)
  const readability_score = Math.max(
    0,
    Math.min(100, 206.835 - 1.015 * avgSentenceLength - 84.6 * (characters / words.length))
  );

  let recommendation = "Excellent";
  if (readability_score < 30) recommendation = "Very Difficult";
  else if (readability_score < 50) recommendation = "Difficult";
  else if (readability_score < 60) recommendation = "Standard";
  else if (readability_score < 70) recommendation = "Fairly Easy";
  else if (readability_score < 80) recommendation = "Easy";
  else if (readability_score < 90) recommendation = "Very Easy";

  return {
    flesch_kincaid_grade: Math.round(flesch_kincaid_grade * 10) / 10,
    average_sentence_length: Math.round(avgSentenceLength * 10) / 10,
    average_word_length: Math.round(avgWordLength * 10) / 10,
    readability_score: Math.round(readability_score),
    recommendation,
  };
}

/**
 * Analyze tone consistency
 */
async function analyzeTone(
  content: string,
  language: string
): Promise<ToneAnalysis> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `Analyze the tone of this ${language === "ar" ? "Arabic" : "English"} content. 
        Respond with JSON containing: detected_tone (string), confidence (0-100), consistency_score (0-100), suggestions (array).`,
      },
      {
        role: "user",
        content: `Analyze the tone of: "${content}"`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "tone_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            detected_tone: { type: "string" },
            confidence: { type: "number" },
            consistency_score: { type: "number" },
            suggestions: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["detected_tone", "confidence", "consistency_score", "suggestions"],
          additionalProperties: false,
        },
      },
    },
  });

  try {
    const content = response.choices[0].message.content;
    const jsonContent = typeof content === 'string' ? content : JSON.stringify(content);
    const result = JSON.parse(jsonContent);
    return result;
  } catch {
    return {
      detected_tone: "neutral",
      confidence: 0,
      consistency_score: 0,
      suggestions: [],
    };
  }
}

/**
 * Optimize hashtags
 */
async function optimizeHashtags(
  content: string,
  platform: string,
  language: string
): Promise<HashtagSuggestion[]> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `Generate optimized hashtags for a ${platform} post in ${language === "ar" ? "Arabic" : "English"}.
        Respond with JSON array of hashtags with: hashtag (string), relevance (0-100), trending (boolean), category (string).
        Generate 5-8 hashtags.`,
      },
      {
        role: "user",
        content: `Content: "${content}"\n\nGenerate optimized hashtags.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "hashtag_suggestions",
        strict: true,
        schema: {
          type: "object",
          properties: {
            hashtags: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  hashtag: { type: "string" },
                  relevance: { type: "number" },
                  trending: { type: "boolean" },
                  category: { type: "string" },
                },
                required: ["hashtag", "relevance", "trending", "category"],
              },
            },
          },
          required: ["hashtags"],
          additionalProperties: false,
        },
      },
    },
  });

  try {
    const content = response.choices[0].message.content;
    const jsonContent = typeof content === 'string' ? content : JSON.stringify(content);
    const result = JSON.parse(jsonContent);
    return result.hashtags || [];
  } catch {
    return [];
  }
}

/**
 * Analyze and improve CTAs
 */
async function analyzeCTAs(
  content: string,
  platform: string,
  language: string
): Promise<CTASuggestion[]> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `Analyze CTAs (Call-to-Action) in this ${language === "ar" ? "Arabic" : "English"} ${platform} content.
        Suggest improvements for each CTA found.
        Respond with JSON array of CTAs with: original (string), improved (string), reason (string), engagementScore (0-100).
        If no CTAs found, suggest 1-2 new ones.`,
      },
      {
        role: "user",
        content: `Content: "${content}"\n\nAnalyze and improve CTAs.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "cta_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            ctas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  original: { type: "string" },
                  improved: { type: "string" },
                  reason: { type: "string" },
                  engagementScore: { type: "number" },
                },
                required: ["original", "improved", "reason", "engagementScore"],
              },
            },
          },
          required: ["ctas"],
          additionalProperties: false,
        },
      },
    },
  });

  try {
    const content = response.choices[0].message.content;
    const jsonContent = typeof content === 'string' ? content : JSON.stringify(content);
    const result = JSON.parse(jsonContent);
    return result.ctas || [];
  } catch {
    return [];
  }
}

/**
 * Calculate overall content score
 */
function calculateContentScore(
  readability: ReadabilityMetrics,
  tone: ToneAnalysis,
  hashtags: HashtagSuggestion[],
  ctas: CTASuggestion[],
  suggestionCount: number
): number {
  let score = 0;

  // Readability score (30%)
  score += readability.readability_score * 0.3;

  // Tone consistency (20%)
  score += tone.consistency_score * 0.2;

  // Hashtag quality (20%)
  const avgHashtagRelevance =
    hashtags.length > 0
      ? hashtags.reduce((sum, h) => sum + h.relevance, 0) / hashtags.length
      : 0;
  score += avgHashtagRelevance * 0.2;

  // CTA quality (20%)
  const avgCTAScore =
    ctas.length > 0
      ? ctas.reduce((sum, c) => sum + c.engagementScore, 0) / ctas.length
      : 0;
  score += avgCTAScore * 0.2;

  // Deduct for issues (10%)
  const issueDeduction = Math.min(10, suggestionCount * 2);
  score -= issueDeduction;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Get enhancement suggestions for a specific aspect
 */
export async function getEnhancementSuggestions(
  content: string,
  aspect: "writing" | "hashtags" | "ctas" | "tone",
  platform: "linkedin" | "twitter" | "instagram" | "facebook",
  language: "en" | "ar" = "en"
) {
  const analysis = await analyzeContent(content, platform, language);

  switch (aspect) {
    case "writing":
      return {
        suggestions: analysis.suggestions,
        spellErrors: analysis.spellErrors,
        grammarErrors: analysis.grammarErrors,
      };
    case "hashtags":
      return { hashtags: analysis.hashtags };
    case "ctas":
      return { ctas: analysis.ctas };
    case "tone":
      return { tone: analysis.tone };
    default:
      return analysis;
  }
}

/**
 * Apply suggestions to content
 */
export async function applySuggestions(
  content: string,
  suggestions: {
    spellCorrections?: Array<{ from: string; to: string }>;
    grammarCorrections?: Array<{ from: string; to: string }>;
    addHashtags?: string[];
    replaceCTAs?: Array<{ from: string; to: string }>;
  }
): Promise<string> {
  let updatedContent = content;

  // Apply spell corrections
  if (suggestions.spellCorrections) {
    for (const correction of suggestions.spellCorrections) {
      updatedContent = updatedContent.replace(
        new RegExp(`\\b${correction.from}\\b`, "gi"),
        correction.to
      );
    }
  }

  // Apply grammar corrections
  if (suggestions.grammarCorrections) {
    for (const correction of suggestions.grammarCorrections) {
      updatedContent = updatedContent.replace(
        correction.from,
        correction.to
      );
    }
  }

  // Replace CTAs
  if (suggestions.replaceCTAs) {
    for (const replacement of suggestions.replaceCTAs) {
      updatedContent = updatedContent.replace(
        replacement.from,
        replacement.to
      );
    }
  }

  // Add hashtags
  if (suggestions.addHashtags && suggestions.addHashtags.length > 0) {
    const hashtags = suggestions.addHashtags.join(" ");
    updatedContent = `${updatedContent}\n\n${hashtags}`;
  }

  return updatedContent;
}

/**
 * Compare two versions of content
 */
export async function compareVersions(
  originalContent: string,
  improvedContent: string,
  platform: "linkedin" | "twitter" | "instagram" | "facebook"
) {
  const original = await analyzeContent(originalContent, platform);
  const improved = await analyzeContent(improvedContent, platform);

  return {
    original: {
      score: original.score,
      readability: original.readability,
      tone: original.tone,
    },
    improved: {
      score: improved.score,
      readability: improved.readability,
      tone: improved.tone,
    },
    improvement: {
      scoreGain: improved.score - original.score,
      readabilityGain: improved.readability.readability_score - original.readability.readability_score,
      toneConsistencyGain: improved.tone.consistency_score - original.tone.consistency_score,
    },
  };
}