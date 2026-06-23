/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Voice Analysis Engine - Analyzes user's writing samples to extract style characteristics
 * Uses NLP techniques to identify tone, vocabulary, patterns, and formatting preferences
 */

interface StyleAnalysis {
  toneProfile: Record<string, number>;
  vocabularyLevel: "simple" | "professional" | "technical";
  sentenceStyle: "short" | "medium" | "long" | "varied";
  favoriteWords: string[];
  avoidWords: string[];
  signaturePhrases: string[];
  usesEmojis: boolean;
  usesHashtags: boolean;
  usesQuestions: boolean;
  usesBulletPoints: boolean;
  profileSummary: string;
}

/**
 * Analyze writing samples to extract style characteristics
 */
export function analyzeWritingSamples(samples: string[]): StyleAnalysis {
  if (!samples || samples.length === 0) {
    return getDefaultAnalysis();
  }

  const combinedText = samples.join(" ");
  
  return {
    toneProfile: analyzeTone(combinedText),
    vocabularyLevel: analyzeVocabularyLevel(combinedText),
    sentenceStyle: analyzeSentenceStyle(combinedText),
    favoriteWords: extractFavoriteWords(combinedText),
    avoidWords: extractAvoidWords(combinedText),
    signaturePhrases: extractSignaturePhrases(combinedText),
    usesEmojis: containsEmojis(combinedText),
    usesHashtags: containsHashtags(combinedText),
    usesQuestions: containsQuestions(combinedText),
    usesBulletPoints: containsBulletPoints(combinedText),
    profileSummary: generateProfileSummary(combinedText),
  };
}

/**
 * Analyze tone characteristics from text
 */
function analyzeTone(text: string): Record<string, number> {
  const toneScores: Record<string, number> = {
    formal: 0,
    friendly: 0,
    professional: 0,
    casual: 0,
    motivational: 0,
    educational: 0,
    humorous: 0,
  };

  const formalWords = /\b(hereby|therefore|furthermore|moreover|consequently|accordingly)\b/gi;
  const friendlyWords = /\b(hey|awesome|cool|love|amazing|great|wonderful|fantastic)\b/gi;
  const professionalWords = /\b(strategic|implement|optimize|leverage|synergy|stakeholder)\b/gi;
  const casualWords = /\b(gonna|wanna|kinda|sorta|lol|haha|btw)\b/gi;
  const motivationalWords = /\b(inspire|empower|achieve|succeed|breakthrough|transform|potential)\b/gi;
  const educationalWords = /\b(learn|understand|explain|concept|theory|research|study)\b/gi;
  const humorousWords = /\b(hilarious|funny|ridiculous|absurd|hilarious|lol)\b/gi;

  toneScores.formal = (text.match(formalWords) || []).length;
  toneScores.friendly = (text.match(friendlyWords) || []).length;
  toneScores.professional = (text.match(professionalWords) || []).length;
  toneScores.casual = (text.match(casualWords) || []).length;
  toneScores.motivational = (text.match(motivationalWords) || []).length;
  toneScores.educational = (text.match(educationalWords) || []).length;
  toneScores.humorous = (text.match(humorousWords) || []).length;

  // Normalize scores to 0-1 range
  const totalScore = Object.values(toneScores).reduce((a, b) => a + b, 0);
  if (totalScore > 0) {
    Object.keys(toneScores).forEach((key) => {
      toneScores[key] = Math.round((toneScores[key] / totalScore) * 100) / 100;
    });
  }

  return toneScores;
}

/**
 * Analyze vocabulary level (simple, professional, technical)
 */
function analyzeVocabularyLevel(text: string): "simple" | "professional" | "technical" {
  const words = text.toLowerCase().split(/\s+/);
  const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;

  const technicalWords = /\b(algorithm|architecture|framework|implementation|optimization|deployment)\b/gi;
  const technicalCount = (text.match(technicalWords) || []).length;

  if (technicalCount > words.length * 0.05) {
    return "technical";
  } else if (avgWordLength > 6) {
    return "professional";
  } else {
    return "simple";
  }
}

/**
 * Analyze sentence style (short, medium, long, varied)
 */
function analyzeSentenceStyle(text: string): "short" | "medium" | "long" | "varied" {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) return "medium";

  const sentenceLengths = sentences.map((s) => s.split(/\s+/).length);
  const avgLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
  const variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / sentenceLengths.length;

  if (variance > 10) {
    return "varied";
  } else if (avgLength < 10) {
    return "short";
  } else if (avgLength > 20) {
    return "long";
  } else {
    return "medium";
  }
}

/**
 * Extract favorite words (most frequently used words)
 */
function extractFavoriteWords(text: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "from", "as", "is", "was", "are", "been", "be", "have", "has", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must", "can", "it", "this", "that", "these", "those", "i", "you", "he", "she", "we", "they",
  ]);

  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopWords.has(word.replace(/[^a-z0-9]/g, "")));

  const wordFreq: Record<string, number> = {};
  words.forEach((word) => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });

  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

/**
 * Extract words that are avoided (rarely or never used)
 */
function extractAvoidWords(_text: string): string[] {
  // This is a simplified approach - in reality, you'd compare against common word lists
  return [];
}

/**
 * Extract signature phrases (unique expressions)
 */
function extractSignaturePhrases(text: string): string[] {
  const phrases: Record<string, number> = {};
  const words = text.toLowerCase().split(/\s+/);

  // Extract 2-3 word phrases
  for (let i = 0; i < words.length - 2; i++) {
    const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    if (phrase.split(/\s+/).every((w) => w.length > 2)) {
      phrases[phrase] = (phrases[phrase] || 0) + 1;
    }
  }

  return Object.entries(phrases)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([phrase]) => phrase);
}

/**
 * Check if text contains emojis
 */
function containsEmojis(text: string): boolean {
  // Check for common emoji patterns using surrogate pairs
  return /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]|[\u2300-\u23FF]|[\u2000-\u206F]/g.test(text);
}

/**
 * Check if text contains hashtags
 */
function containsHashtags(text: string): boolean {
  return /#\w+/g.test(text);
}

/**
 * Check if text contains questions
 */
function containsQuestions(text: string): boolean {
  return /\?/g.test(text);
}

/**
 * Check if text contains bullet points
 */
function containsBulletPoints(text: string): boolean {
  return /^[\s]*[-•*]\s/m.test(text);
}

/**
 * Generate a human-readable profile summary
 */
function generateProfileSummary(text: string): string {
  const tone = analyzeTone(text);
  const vocab = analyzeVocabularyLevel(text);
  const style = analyzeSentenceStyle(text);
  const hasEmojis = containsEmojis(text);
  const hasHashtags = containsHashtags(text);
  const hasQuestions = containsQuestions(text);

  const dominantTone = Object.entries(tone).sort((a, b) => b[1] - a[1])[0]?.[0] || "neutral";
  
  let summary = `Your writing style is ${dominantTone} and ${vocab}. `;
  summary += `You tend to use ${style} sentences. `;
  
  if (hasEmojis) summary += "You frequently use emojis. ";
  if (hasHashtags) summary += "You use hashtags in your content. ";
  if (hasQuestions) summary += "You often pose questions to engage your audience. ";

  return summary;
}

/**
 * Get default analysis when no samples provided
 */
function getDefaultAnalysis(): StyleAnalysis {
  return {
    toneProfile: {
      formal: 0.2,
      friendly: 0.2,
      professional: 0.2,
      casual: 0.2,
      motivational: 0.1,
      educational: 0.05,
      humorous: 0.05,
    },
    vocabularyLevel: "professional",
    sentenceStyle: "varied",
    favoriteWords: [],
    avoidWords: [],
    signaturePhrases: [],
    usesEmojis: false,
    usesHashtags: false,
    usesQuestions: false,
    usesBulletPoints: false,
    profileSummary: "No writing samples analyzed yet. Add samples to build your voice profile.",
  };
}

/**
 * Generate system prompt for content generation based on voice profile
 */
export function generateVoicePrompt(analysis: StyleAnalysis): string {
  const tones = Object.entries(analysis.toneProfile)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tone, score]) => `${tone} (${Math.round(score * 100)}%)`)
    .join(", ");

  let prompt = `Write in a ${analysis.vocabularyLevel} vocabulary level with ${analysis.sentenceStyle} sentences. `;
  prompt += `The tone should be: ${tones}. `;
  
  if (analysis.usesEmojis) prompt += "Include relevant emojis. ";
  if (analysis.usesHashtags) prompt += "Include relevant hashtags. ";
  if (analysis.usesQuestions) prompt += "Pose questions to engage the audience. ";
  if (analysis.usesBulletPoints) prompt += "Use bullet points for clarity. ";

  if (analysis.favoriteWords.length > 0) {
    prompt += `Try to incorporate some of these words naturally: ${analysis.favoriteWords.slice(0, 5).join(", ")}. `;
  }

  if (analysis.signaturePhrases.length > 0) {
    prompt += `Use signature expressions like: "${analysis.signaturePhrases[0]}". `;
  }

  return prompt;
}