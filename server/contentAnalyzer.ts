/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Content Analyzer - AI Content Coach Engine
 * Analyzes generated content and provides scoring and feedback
 */

interface AnalysisResult {
  // Metrics
  wordCount: number;
  sentenceCount: number;
  questionCount: number;
  emojiCount: number;
  hashtagCount: number;
  hasNumbers: boolean;
  hasCallToAction: boolean;
  
  // Scores (0-100)
  lengthScore: number;
  engagementScore: number;
  readabilityScore: number;
  overallScore: number;
  
  // Feedback
  strengths: string[];
  improvements: string[];
  tips: string[];
}

interface PlatformGuidelines {
  idealWordRange: [number, number];
  idealHashtagRange: [number, number];
  idealEmojiRange: [number, number];
  recommendQuestions: boolean;
  recommendNumbers: boolean;
  recommendCTA: boolean;
}

const platformGuidelines: Record<string, PlatformGuidelines> = {
  linkedin: {
    idealWordRange: [150, 300],
    idealHashtagRange: [3, 5],
    idealEmojiRange: [1, 3],
    recommendQuestions: true,
    recommendNumbers: true,
    recommendCTA: true,
  },
  twitter: {
    idealWordRange: [50, 100],
    idealHashtagRange: [1, 3],
    idealEmojiRange: [1, 2],
    recommendQuestions: true,
    recommendNumbers: true,
    recommendCTA: false,
  },
  instagram: {
    idealWordRange: [100, 200],
    idealHashtagRange: [5, 10],
    idealEmojiRange: [3, 6],
    recommendQuestions: true,
    recommendNumbers: false,
    recommendCTA: true,
  },
  facebook: {
    idealWordRange: [100, 250],
    idealHashtagRange: [2, 5],
    idealEmojiRange: [2, 4],
    recommendQuestions: true,
    recommendNumbers: true,
    recommendCTA: true,
  },
};

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Count sentences in text
 */
function countSentences(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  return sentences.length;
}

/**
 * Count questions in text
 */
function countQuestions(text: string): number {
  return (text.match(/\?/g) || []).length;
}

/**
 * Count emojis in text
 */
function countEmojis(text: string): number {
  // Count emojis by checking for common emoji patterns
  let count = 0;
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code && ((code >= 0x1F300 && code <= 0x1F9FF) || (code >= 0x2600 && code <= 0x27BF))) {
      count++;
    }
  }
  return count;
}

/**
 * Count hashtags in text
 */
function countHashtags(text: string): number {
  return (text.match(/#\w+/g) || []).length;
}

/**
 * Check if text contains numbers
 */
function hasNumbers(text: string): boolean {
  return /\d+/.test(text);
}

/**
 * Check if text has call-to-action phrases
 */
function hasCallToAction(text: string): boolean {
  const ctaPhrases = [
    'click', 'learn more', 'sign up', 'join', 'download', 'get started',
    'contact', 'visit', 'check out', 'discover', 'explore', 'try',
    'klikk', 'lær mer', 'meld deg på', 'bli med', 'last ned', 'kom i gang',
    'kontakt', 'besøk', 'sjekk ut', 'oppdag', 'utforsk', 'prøv'
  ];
  const lowerText = text.toLowerCase();
  return ctaPhrases.some(phrase => lowerText.includes(phrase));
}

/**
 * Calculate length score based on platform guidelines
 */
function calculateLengthScore(wordCount: number, platform: string): number {
  const guidelines = platformGuidelines[platform] || platformGuidelines.linkedin;
  const [min, max] = guidelines.idealWordRange;
  
  if (wordCount >= min && wordCount <= max) {
    return 100;
  } else if (wordCount < min) {
    const ratio = wordCount / min;
    return Math.max(50, ratio * 100);
  } else {
    const excess = wordCount - max;
    const penalty = Math.min(50, (excess / max) * 100);
    return Math.max(50, 100 - penalty);
  }
}

/**
 * Calculate engagement score based on interactive elements
 */
function calculateEngagementScore(
  questionCount: number,
  emojiCount: number,
  hashtagCount: number,
  hasNumbers: boolean,
  hasCTA: boolean,
  platform: string
): number {
  const guidelines = platformGuidelines[platform] || platformGuidelines.linkedin;
  let score = 0;
  
  // Questions (0-25 points)
  if (guidelines.recommendQuestions && questionCount > 0) {
    score += Math.min(25, questionCount * 12.5);
  }
  
  // Emojis (0-25 points)
  const [minEmoji, maxEmoji] = guidelines.idealEmojiRange;
  if (emojiCount >= minEmoji && emojiCount <= maxEmoji) {
    score += 25;
  } else if (emojiCount > 0) {
    score += 15;
  }
  
  // Hashtags (0-25 points)
  const [minHashtag, maxHashtag] = guidelines.idealHashtagRange;
  if (hashtagCount >= minHashtag && hashtagCount <= maxHashtag) {
    score += 25;
  } else if (hashtagCount > 0) {
    score += 15;
  }
  
  // Numbers (0-15 points)
  if (guidelines.recommendNumbers && hasNumbers) {
    score += 15;
  }
  
  // CTA (0-10 points)
  if (guidelines.recommendCTA && hasCTA) {
    score += 10;
  }
  
  return Math.min(100, score);
}

/**
 * Calculate readability score
 */
function calculateReadabilityScore(
  wordCount: number,
  sentenceCount: number
): number {
  if (sentenceCount === 0) return 50;
  
  const avgWordsPerSentence = wordCount / sentenceCount;
  
  // Ideal: 15-20 words per sentence
  if (avgWordsPerSentence >= 15 && avgWordsPerSentence <= 20) {
    return 100;
  } else if (avgWordsPerSentence < 15) {
    // Too short sentences
    const ratio = avgWordsPerSentence / 15;
    return Math.max(70, ratio * 100);
  } else {
    // Too long sentences
    const excess = avgWordsPerSentence - 20;
    const penalty = Math.min(30, (excess / 20) * 100);
    return Math.max(60, 100 - penalty);
  }
}

/**
 * Generate strengths feedback
 */
function generateStrengths(
  metrics: any,
  platform: string,
  language: 'no' | 'en'
): string[] {
  const strengths: string[] = [];
  const guidelines = platformGuidelines[platform] || platformGuidelines.linkedin;
  
  const messages = {
    no: {
      idealLength: 'Perfekt lengde for plattformen',
      hasNumbers: 'Bruker konkrete tall (øker troverdighet)',
      goodEmojis: 'Balansert bruk av emojier',
      hasQuestions: 'Inkluderer engasjerende spørsmål',
      goodHashtags: 'Optimal bruk av hashtags',
      hasCTA: 'Tydelig oppfordring til handling',
      goodReadability: 'Lett å lese og forstå',
    },
    en: {
      idealLength: 'Perfect length for the platform',
      hasNumbers: 'Uses specific numbers (increases credibility)',
      goodEmojis: 'Balanced use of emojis',
      hasQuestions: 'Includes engaging questions',
      goodHashtags: 'Optimal use of hashtags',
      hasCTA: 'Clear call-to-action',
      goodReadability: 'Easy to read and understand',
    },
  };
  
  const msg = messages[language];
  
  // Check length
  const [minWords, maxWords] = guidelines.idealWordRange;
  if (metrics.wordCount >= minWords && metrics.wordCount <= maxWords) {
    strengths.push(msg.idealLength);
  }
  
  // Check numbers
  if (metrics.hasNumbers && guidelines.recommendNumbers) {
    strengths.push(msg.hasNumbers);
  }
  
  // Check emojis
  const [minEmoji, maxEmoji] = guidelines.idealEmojiRange;
  if (metrics.emojiCount >= minEmoji && metrics.emojiCount <= maxEmoji) {
    strengths.push(msg.goodEmojis);
  }
  
  // Check questions
  if (metrics.questionCount > 0 && guidelines.recommendQuestions) {
    strengths.push(msg.hasQuestions);
  }
  
  // Check hashtags
  const [minHashtag, maxHashtag] = guidelines.idealHashtagRange;
  if (metrics.hashtagCount >= minHashtag && metrics.hashtagCount <= maxHashtag) {
    strengths.push(msg.goodHashtags);
  }
  
  // Check CTA
  if (metrics.hasCallToAction && guidelines.recommendCTA) {
    strengths.push(msg.hasCTA);
  }
  
  // Check readability
  if (metrics.readabilityScore >= 80) {
    strengths.push(msg.goodReadability);
  }
  
  return strengths;
}

/**
 * Generate improvement suggestions
 */
function generateImprovements(
  metrics: any,
  platform: string,
  language: 'no' | 'en'
): string[] {
  const improvements: string[] = [];
  const guidelines = platformGuidelines[platform] || platformGuidelines.linkedin;
  
  const messages = {
    no: {
      tooShort: `Litt for kort - prøv ${guidelines.idealWordRange[0]}-${guidelines.idealWordRange[1]} ord`,
      tooLong: `Litt for langt - prøv ${guidelines.idealWordRange[0]}-${guidelines.idealWordRange[1]} ord`,
      needsNumbers: 'Legg til konkrete tall eller statistikk',
      needsEmojis: `Legg til ${guidelines.idealEmojiRange[0]}-${guidelines.idealEmojiRange[1]} emojier for mer engasjement`,
      tooManyEmojis: `Reduser emojier til ${guidelines.idealEmojiRange[0]}-${guidelines.idealEmojiRange[1]}`,
      needsQuestions: 'Legg til et spørsmål for å øke interaksjon',
      needsHashtags: `Legg til ${guidelines.idealHashtagRange[0]}-${guidelines.idealHashtagRange[1]} hashtags`,
      tooManyHashtags: `Reduser hashtags til ${guidelines.idealHashtagRange[0]}-${guidelines.idealHashtagRange[1]}`,
      needsCTA: 'Legg til en oppfordring til handling',
      longSentences: 'Noen setninger er for lange - del dem opp',
    },
    en: {
      tooShort: `A bit too short - try ${guidelines.idealWordRange[0]}-${guidelines.idealWordRange[1]} words`,
      tooLong: `A bit too long - try ${guidelines.idealWordRange[0]}-${guidelines.idealWordRange[1]} words`,
      needsNumbers: 'Add specific numbers or statistics',
      needsEmojis: `Add ${guidelines.idealEmojiRange[0]}-${guidelines.idealEmojiRange[1]} emojis for more engagement`,
      tooManyEmojis: `Reduce emojis to ${guidelines.idealEmojiRange[0]}-${guidelines.idealEmojiRange[1]}`,
      needsQuestions: 'Add a question to increase interaction',
      needsHashtags: `Add ${guidelines.idealHashtagRange[0]}-${guidelines.idealHashtagRange[1]} hashtags`,
      tooManyHashtags: `Reduce hashtags to ${guidelines.idealHashtagRange[0]}-${guidelines.idealHashtagRange[1]}`,
      needsCTA: 'Add a call-to-action',
      longSentences: 'Some sentences are too long - break them up',
    },
  };
  
  const msg = messages[language];
  
  // Check length
  const [minWords, maxWords] = guidelines.idealWordRange;
  if (metrics.wordCount < minWords) {
    improvements.push(msg.tooShort);
  } else if (metrics.wordCount > maxWords) {
    improvements.push(msg.tooLong);
  }
  
  // Check numbers
  if (!metrics.hasNumbers && guidelines.recommendNumbers) {
    improvements.push(msg.needsNumbers);
  }
  
  // Check emojis
  const [minEmoji, maxEmoji] = guidelines.idealEmojiRange;
  if (metrics.emojiCount < minEmoji) {
    improvements.push(msg.needsEmojis);
  } else if (metrics.emojiCount > maxEmoji) {
    improvements.push(msg.tooManyEmojis);
  }
  
  // Check questions
  if (metrics.questionCount === 0 && guidelines.recommendQuestions) {
    improvements.push(msg.needsQuestions);
  }
  
  // Check hashtags
  const [minHashtag, maxHashtag] = guidelines.idealHashtagRange;
  if (metrics.hashtagCount < minHashtag) {
    improvements.push(msg.needsHashtags);
  } else if (metrics.hashtagCount > maxHashtag) {
    improvements.push(msg.tooManyHashtags);
  }
  
  // Check CTA
  if (!metrics.hasCallToAction && guidelines.recommendCTA) {
    improvements.push(msg.needsCTA);
  }
  
  // Check readability
  if (metrics.readabilityScore < 70) {
    improvements.push(msg.longSentences);
  }
  
  return improvements;
}

/**
 * Generate tips
 */
function generateTips(
  metrics: any,
  platform: string,
  language: 'no' | 'en'
): string[] {
  const allTips = {
    no: [
      'Bruk storytelling for å skape emosjonell forbindelse',
      'Start med en sterk åpning som fanger oppmerksomhet',
      'Inkluder en personlig erfaring eller eksempel',
      'Bruk linjeskift for bedre lesbarhet',
      'Post på beste tidspunkt (8-10 AM eller 5-7 PM)',
      'Svar på kommentarer innen første time',
      'Test forskjellige formater og se hva som fungerer',
    ],
    en: [
      'Use storytelling to create emotional connection',
      'Start with a strong hook that captures attention',
      'Include a personal experience or example',
      'Use line breaks for better readability',
      'Post at optimal times (8-10 AM or 5-7 PM)',
      'Reply to comments within the first hour',
      'Test different formats and see what works',
    ],
  };
  
  // Return 2-3 random tips
  const tipPool = allTips[language];
  const selectedTips: string[] = [];
  const usedIndices = new Set<number>();
  
  while (selectedTips.length < 3 && usedIndices.size < tipPool.length) {
    const randomIndex = Math.floor(Math.random() * tipPool.length);
    if (!usedIndices.has(randomIndex)) {
      selectedTips.push(tipPool[randomIndex]);
      usedIndices.add(randomIndex);
    }
  }
  
  return selectedTips;
}

/**
 * Main analysis function
 */
export function analyzeContent(
  content: string,
  platform: string,
  language: 'no' | 'en' = 'no'
): AnalysisResult {
  // Calculate metrics
  const wordCount = countWords(content);
  const sentenceCount = countSentences(content);
  const questionCount = countQuestions(content);
  const emojiCount = countEmojis(content);
  const hashtagCount = countHashtags(content);
  const hasNumbersFlag = hasNumbers(content);
  const hasCTAFlag = hasCallToAction(content);
  
  // Calculate scores
  const lengthScore = calculateLengthScore(wordCount, platform);
  const readabilityScore = calculateReadabilityScore(wordCount, sentenceCount);
  const engagementScore = calculateEngagementScore(
    questionCount,
    emojiCount,
    hashtagCount,
    hasNumbersFlag,
    hasCTAFlag,
    platform
  );
  
  // Calculate overall score (weighted average)
  const overallScore = Math.round(
    lengthScore * 0.3 +
    engagementScore * 0.4 +
    readabilityScore * 0.3
  );
  
  const metrics = {
    wordCount,
    sentenceCount,
    questionCount,
    emojiCount,
    hashtagCount,
    hasNumbers: hasNumbersFlag,
    hasCallToAction: hasCTAFlag,
    lengthScore,
    engagementScore,
    readabilityScore,
    overallScore,
  };
  
  // Generate feedback
  const strengths = generateStrengths(metrics, platform, language);
  const improvements = generateImprovements(metrics, platform, language);
  const tips = generateTips(metrics, platform, language);
  
  return {
    ...metrics,
    strengths,
    improvements,
    tips,
  };
}