/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Prompt Builder — the layer that turns a user's plain idea + chosen options
 * into a professional, structured prompt for the content model.
 *
 * Two entry points:
 *  - buildContentPrompt(): deterministic. Assembles a rich system/user prompt
 *    from every option. No extra API call. Used on every generation.
 *  - enhanceIdea(): an optional LLM "polish" pass that rewrites the user's raw
 *    topic into a sharper, more detailed content brief BEFORE generation.
 *
 * Keep all option vocabularies here so the server is the single source of truth;
 * the client mirrors the labels only.
 */

export type Platform = "linkedin" | "twitter" | "instagram" | "facebook";
export type ContentTone = "professional" | "casual" | "friendly" | "formal" | "humorous";
export type ContentLength = "short" | "medium" | "long";
export type Goal = "awareness" | "engagement" | "sales" | "leads" | "traffic" | "community";
export type Angle =
  | "personal_story"
  | "actionable_tips"
  | "contrarian_opinion"
  | "case_study"
  | "shocking_stat"
  | "how_to"
  | "listicle"
  | "question";
export type EmojiUsage = "none" | "minimal" | "moderate" | "heavy";
export type Language = "no" | "en" | "ar";

/** A cleaned-up view of the user's trained voice profile (see voice_profiles). */
export interface VoiceProfileHints {
  profileSummary?: string | null;
  vocabularyLevel?: string | null;
  sentenceStyle?: string | null;
  favoriteWords?: string[];
  signaturePhrases?: string[];
}

/** Every "property" a user can set. The optional ones are the new expanded set. */
export interface ContentOptions {
  topic: string;
  platform: Platform;
  tone?: ContentTone;
  length?: ContentLength;
  keywords?: string[];

  // Expanded properties
  targetAudience?: string;
  goal?: Goal;
  cta?: string;
  angle?: Angle;

  // Formatting details
  emojiUsage?: EmojiUsage;
  hashtagCount?: number;
  useBullets?: boolean;
  closingQuestion?: boolean;
  language?: Language;

  // Personalization: the user's trained writing voice (when they opt in).
  voiceProfile?: VoiceProfileHints;
}

const PLATFORM_GUIDELINES: Record<Platform, { maxLength: number; style: string; format: string }> = {
  linkedin: {
    maxLength: 3000,
    style: "Professional networking content with genuine insight and value. Use line breaks for readability.",
    format: "Open with a scroll-stopping hook, deliver value in short paragraphs, close with a clear takeaway.",
  },
  twitter: {
    maxLength: 280,
    style: "Concise, punchy, one sharp idea. Every word earns its place.",
    format: "Hook + payoff in under 280 characters.",
  },
  instagram: {
    maxLength: 2200,
    style: "Warm, visual, story-driven caption that complements an image.",
    format: "Relatable opening line, short readable blocks, emotional or aspirational close.",
  },
  facebook: {
    maxLength: 63206,
    style: "Conversational and community-focused; invite discussion.",
    format: "Attention-grabbing opener, a short story or point, a prompt that sparks comments.",
  },
};

const TONE_INSTRUCTIONS: Record<ContentTone, string> = {
  professional: "Authoritative and credible. Use precise, industry-appropriate language without jargon for its own sake.",
  casual: "Relaxed and conversational, like talking to a peer.",
  friendly: "Warm, approachable and encouraging.",
  formal: "Polished and reserved; complete sentences, no slang.",
  humorous: "Light and witty, but never at the expense of the core message.",
};

const LENGTH_GUIDELINES: Record<ContentLength, string> = {
  short: "Keep it brief and high-impact — a few tight sentences.",
  medium: "Provide solid detail and value — a few short paragraphs.",
  long: "Go in-depth and comprehensive while staying scannable.",
};

const GOAL_INSTRUCTIONS: Record<Goal, string> = {
  awareness: "Goal: build awareness. Lead with a memorable idea worth sharing; prioritise reach over a hard sell.",
  engagement: "Goal: drive engagement. Provoke replies, saves and shares; spark a conversation.",
  sales: "Goal: drive sales. Make the value and the offer clear and desirable, then ask for the action confidently.",
  leads: "Goal: generate leads. Tease real value and guide the reader to take the next step (sign up, DM, download).",
  traffic: "Goal: drive traffic. Build curiosity that makes clicking through the obvious next move.",
  community: "Goal: build community. Speak to shared identity and belonging; invite the reader in.",
};

const ANGLE_INSTRUCTIONS: Record<Angle, string> = {
  personal_story: "Frame it as a first-person story with a concrete moment, a turn, and a lesson.",
  actionable_tips: "Deliver specific, immediately usable tips — no fluff, no obvious advice.",
  contrarian_opinion: "Take a clear contrarian stance and defend it with reasoning; challenge a common assumption.",
  case_study: "Walk through a real (or realistic) example: situation, action, measurable result.",
  shocking_stat: "Open on a surprising statistic or fact, then unpack why it matters.",
  how_to: "Structure as a clear step-by-step guide to achieving one outcome.",
  listicle: "Structure as a tight, numbered list of distinct points.",
  question: "Build the piece around a compelling question and explore the answer.",
};

const EMOJI_INSTRUCTIONS: Record<EmojiUsage, string> = {
  none: "Do not use any emojis.",
  minimal: "Use at most 1–2 emojis, only where they add clarity.",
  moderate: "Use a few emojis to add warmth and break up text, without clutter.",
  heavy: "Use emojis liberally and expressively, in keeping with the platform.",
};

const LANGUAGE_NAMES: Record<Language, string> = {
  no: "Norwegian (Bokmål)",
  en: "English",
  ar: "Arabic",
};

const LANGUAGE_INSTRUCTIONS: Record<Language, string> = {
  no: [
    "Write the entire post in Norwegian (Bokmål) — natural, idiomatic and fluent, the way a native Norwegian writes on social media.",
    "Do NOT translate from English word-for-word and do NOT produce stiff, machine-translated phrasing.",
    "Use correct Norwegian spelling and the letters æ, ø, å. Avoid unnecessary anglicisms — prefer established Norwegian words (e.g. «innlegg», «målgruppe», «engasjement»), keeping only widely-used English terms where Norwegians naturally do.",
    "Any hashtags and the call-to-action must also be in Norwegian.",
  ].join(" "),
  en: "Write the entire post in clear, natural English.",
  ar: "Write the entire post in clear, modern standard Arabic with natural, idiomatic phrasing.",
};

/** A short, hard final directive re-asserting the output language. */
function languageHardRule(language: Language): string {
  return `Write the ENTIRE post in ${LANGUAGE_NAMES[language]}. Do not switch to any other language at any point (proper nouns and established brand names may stay as-is).`;
}

/**
 * Deterministically assemble a professional system + user prompt from the
 * options. This is the "ordinary writing → professional prompt" layer.
 */
export function buildContentPrompt(options: ContentOptions): { system: string; user: string; maxLength: number } {
  const {
    topic,
    platform,
    tone = "professional",
    length = "medium",
    keywords = [],
    targetAudience,
    goal,
    cta,
    angle,
    emojiUsage = "minimal",
    hashtagCount,
    useBullets = false,
    closingQuestion = true,
    language = "no",
    voiceProfile,
  } = options;

  const platformInfo = PLATFORM_GUIDELINES[platform];
  const effectiveHashtags =
    typeof hashtagCount === "number" ? Math.max(0, Math.min(30, Math.round(hashtagCount))) : null;

  const lines: string[] = [];
  lines.push(`You are an expert social-media content strategist and copywriter specialising in ${platform}.`);
  lines.push("");
  lines.push(`## Output language — ${LANGUAGE_NAMES[language]} (highest priority)`);
  lines.push(LANGUAGE_INSTRUCTIONS[language]);
  lines.push("");
  lines.push("## Platform");
  lines.push(`- Style: ${platformInfo.style}`);
  lines.push(`- Structure: ${platformInfo.format}`);
  lines.push(`- Hard max length: ${platformInfo.maxLength} characters.`);
  lines.push("");
  lines.push("## Voice & framing");
  lines.push(`- Tone: ${TONE_INSTRUCTIONS[tone]}`);
  lines.push(`- Length: ${LENGTH_GUIDELINES[length]}`);
  if (targetAudience) lines.push(`- Audience: write directly for ${targetAudience}. Match their language and concerns.`);
  if (goal) lines.push(`- ${GOAL_INSTRUCTIONS[goal]}`);
  if (angle) lines.push(`- Angle: ${ANGLE_INSTRUCTIONS[angle]}`);
  lines.push("");
  lines.push("## Formatting");
  lines.push(`- Emojis: ${EMOJI_INSTRUCTIONS[emojiUsage]}`);
  if (effectiveHashtags !== null) {
    lines.push(
      effectiveHashtags === 0
        ? "- Do not include any hashtags."
        : `- End with exactly ${effectiveHashtags} relevant, specific hashtags.`,
    );
  }
  if (useBullets) lines.push("- Use bullet points or short list items where it improves scannability.");
  lines.push(
    closingQuestion
      ? "- End with one engaging question that invites replies."
      : "- Do not end with a question; close with a statement or takeaway.",
  );
  if (cta) lines.push(`- Call to action: weave in this CTA naturally near the end: "${cta}".`);
  if (keywords.length > 0) lines.push(`- Naturally incorporate these keywords: ${keywords.join(", ")}.`);

  // Personal voice (only when the user opted in and has a trained profile).
  if (voiceProfile) {
    const voiceLines: string[] = [];
    if (voiceProfile.profileSummary) voiceLines.push(`- Writing style: ${voiceProfile.profileSummary}`);
    if (voiceProfile.vocabularyLevel) voiceLines.push(`- Vocabulary level: ${voiceProfile.vocabularyLevel}.`);
    if (voiceProfile.sentenceStyle) voiceLines.push(`- Sentence style: ${voiceProfile.sentenceStyle}.`);
    if (voiceProfile.signaturePhrases?.length) {
      voiceLines.push(`- Occasionally use the author's signature phrases where natural: ${voiceProfile.signaturePhrases.slice(0, 8).join("; ")}.`);
    }
    if (voiceProfile.favoriteWords?.length) {
      voiceLines.push(`- Favor the author's common vocabulary, e.g.: ${voiceProfile.favoriteWords.slice(0, 12).join(", ")}.`);
    }
    if (voiceLines.length > 0) {
      lines.push("");
      lines.push("## Personal voice (match this author's style closely)");
      lines.push(...voiceLines);
    }
  }

  lines.push("");
  lines.push("## Rules");
  lines.push("- Output ONLY the final post text — no preamble, no meta-commentary, no quotation marks around it.");
  lines.push("- Never write phrases like \"Here's a post\" or \"Sure\". Start directly with the content.");
  lines.push("- Make it authentic, specific and genuinely valuable — avoid generic filler.");
  lines.push(`- ${languageHardRule(language)}`);

  const system = lines.join("\n");
  // Anchor the language on the user turn too — even if the idea is written in
  // another language, the post must come back in the target language.
  const user = `Create a ${platform} post about the following idea, written entirely in ${LANGUAGE_NAMES[language]}:\n\n${topic}`;

  return { system, user, maxLength: platformInfo.maxLength };
}

/**
 * Optional LLM polish pass: rewrite the user's raw idea into a sharper, more
 * detailed content brief, taking the chosen options into account. Returns a
 * string the caller can show the user (and feed back in as the topic).
 */
export async function enhanceIdea(options: ContentOptions): Promise<string> {
  const { invokeLLM } = await import("./_core/llm");

  const { platform, tone = "professional", targetAudience, goal, angle, language = "no" } = options;

  const context: string[] = [`Platform: ${platform}`, `Tone: ${tone}`];
  if (targetAudience) context.push(`Audience: ${targetAudience}`);
  if (goal) context.push(`Goal: ${goal}`);
  if (angle) context.push(`Angle: ${angle}`);

  const system = [
    "You are a content strategist who turns a rough, plain idea into a clear, specific content brief.",
    LANGUAGE_INSTRUCTIONS[language],
    "",
    "Rewrite the user's raw idea into a single, richer paragraph (2–4 sentences) that:",
    "- sharpens the core message and adds a concrete angle or example to explore,",
    "- stays faithful to the user's intent (do not invent unrelated topics),",
    "- is written as a brief/description of what to cover, NOT as the finished post.",
    "",
    "Output ONLY the rewritten brief — no headings, no bullet points, no meta-commentary.",
    "",
    "Context:",
    ...context.map((c) => `- ${c}`),
  ].join("\n");

  const { ENV } = await import("./_core/env");
  const response = await invokeLLM({
    model: ENV.contentModel, // quality tier — enhancing the idea is quality-critical
    messages: [
      { role: "system", content: system },
      { role: "user", content: options.topic },
    ],
    maxTokens: 400,
  });

  const choice = response.choices[0]?.message?.content;
  const enhanced = typeof choice === "string" ? choice.trim() : "";
  // Fall back to the original idea if the model returns nothing usable.
  return enhanced || options.topic;
}