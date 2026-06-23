/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

/**
 * Extract the FIRST balanced JSON value (array `[]` or object `{}`) from an LLM
 * response. LLMs routinely wrap output in ```json fences and/or append prose, so a
 * greedy /\[[\s\S]*\]/ spans to the last bracket and JSON.parse throws
 * "Unexpected non-whitespace character after JSON". This scans bracket depth while
 * respecting string literals/escapes, parses only that slice, and degrades to a
 * fallback (never throws) if nothing valid is found.
 */
function extractFirstJson<T>(text: string, open: "[" | "{", fallback: T): T {
  if (!text) return fallback;
  const close = open === "[" ? "]" : "}";
  const start = text.indexOf(open);
  if (start === -1) return fallback;

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1)) as T;
        } catch {
          return fallback;
        }
      }
    }
  }
  return fallback;
}

const extractFirstJsonArray = (text: string): Array<Record<string, unknown>> =>
  extractFirstJson<Array<Record<string, unknown>>>(text, "[", []);

const extractFirstJsonObject = (text: string): Record<string, unknown> =>
  extractFirstJson<Record<string, unknown>>(text, "{", {});

/**
 * Turn a language code into an explicit, unambiguous directive for the prompt.
 * Passing the bare code "no" is risky — a model can read it as the English word
 * "no" rather than Norwegian, which degrades or breaks Norwegian output.
 */
export function languageLabel(code: string): string {
  switch ((code || "").toLowerCase()) {
    case "no":
    case "nb":
      return "Norwegian (Bokmål) — write the ENTIRE output in natural, idiomatic Norwegian; never translate word-for-word, use æ/ø/å correctly, and avoid unnecessary anglicisms";
    case "ar":
      return "Arabic — write the ENTIRE output in clear, natural Modern Standard Arabic";
    case "en":
    default:
      return "English — write the ENTIRE output in clear, natural English";
  }
}

/**
 * LangChain Service for Innlegg
 * Provides AI-powered content generation, analysis, and coaching
 */

export class LangChainService {
  private llm: ChatOpenAI;

  constructor() {
    // Initialize OpenAI LLM
    const forgeApiUrl = process.env.BUILT_IN_FORGE_API_URL || "https://api.openai.com";
    const forgeApiKey = process.env.BUILT_IN_FORGE_API_KEY || process.env.OPENAI_API_KEY || "";
    
    this.llm = new ChatOpenAI({
      openAIApiKey: forgeApiKey,
      temperature: 0.7,
      model: process.env.LLM_MODEL || "gpt-4o-mini",
      configuration: {
        baseURL: `${forgeApiUrl.replace(/\/$/, "")}/v1`,
      }
    });
  }

  /**
   * Generate content using LangChain with user's voice profile
   */
  async generateContentWithVoice(input: {
    platform: string;
    topic: string;
    tone: string;
    length: string;
    keywords: string;
    language: string;
    vocabularyLevel?: string;
    sentenceLength?: string;
    emojiUsage?: string;
    hashtagStyle?: string;
  }): Promise<string> {
    try {
      const prompt = PromptTemplate.fromTemplate(`You are an expert social media content creator specializing in {platform} content.

User's Writing Style Profile:
- Tone: {tone}
- Vocabulary Level: {vocabularyLevel}
- Average Sentence Length: {sentenceLength}
- Emoji Usage: {emojiUsage}
- Hashtag Style: {hashtagStyle}

Content Requirements:
- Platform: {platform}
- Topic: {topic}
- Length: {length} words
- Keywords: {keywords}
- Language: {language}

Create engaging, platform-optimized content that matches the user's writing style. 
Ensure the content is authentic, engaging, and optimized for the platform's algorithm.
Include relevant hashtags and emojis where appropriate.

Generated Content:`);

      const chain = RunnableSequence.from([
        prompt,
        this.llm,
        new StringOutputParser()
      ]);

      const result = await chain.invoke({
        platform: input.platform,
        topic: input.topic,
        tone: input.tone,
        length: input.length,
        keywords: input.keywords,
        language: languageLabel(input.language),
        vocabularyLevel: input.vocabularyLevel || "medium",
        sentenceLength: input.sentenceLength || "medium",
        emojiUsage: input.emojiUsage || "moderate",
        hashtagStyle: input.hashtagStyle || "balanced"
      });

      return result;
    } catch (error) {
      console.error("Error generating content with voice:", error);
      throw new Error("Failed to generate content with voice profile");
    }
  }

  /**
   * Analyze content and provide detailed insights
   */
  async analyzeContent(input: {
    content: string;
    platform: string;
    language: string;
  }): Promise<Record<string, unknown>> {
    try {
      const prompt = PromptTemplate.fromTemplate(`Analyze the following social media content and provide detailed insights:

Content:
{content}

Platform: {platform}
Language: {language}

Please analyze and provide:
1. Engagement Potential (1-10 score)
2. Clarity and Message (1-10 score)
3. Call-to-Action Strength (1-10 score)
4. Hashtag Effectiveness (1-10 score)
5. Emoji Usage Appropriateness (1-10 score)
6. Overall Quality Score (1-10)

Format your response as JSON.

Analysis:`);

      const chain = RunnableSequence.from([
        prompt,
        this.llm,
        new StringOutputParser()
      ]);

      const result = await chain.invoke({
        content: input.content,
        platform: input.platform,
        language: languageLabel(input.language)
      });

      // Extract the first balanced JSON object; tolerate ```json fences / trailing prose.
      const parsed = extractFirstJsonObject(result);
      if (Object.keys(parsed).length > 0) {
        return parsed;
      }

      return { rawAnalysis: result };
    } catch (error) {
      console.error("Error analyzing content:", error);
      throw new Error("Failed to analyze content");
    }
  }

  /**
   * AI Coach conversation
   */
  async coachConversation(input: {
    userMessage: string;
    conversationHistory?: Array<{ role: string; content: string }>;
  }): Promise<string> {
    try {
      const systemPrompt = `You are Nexify AI Coach, an expert social media strategist and content creation mentor.

Your role is to:
1. Help users improve their content strategy
2. Provide personalized recommendations based on their writing style
3. Suggest trending topics and content ideas
4. Analyze their content performance
5. Guide them through best practices for each platform
6. Offer encouragement and motivation

Be conversational, friendly, and supportive. Use the user's name when available.
Provide specific, actionable advice. Ask clarifying questions when needed.`;

      const prompt = PromptTemplate.fromTemplate(`${systemPrompt}

User: {userMessage}

Based on the user's message and any previous context, provide helpful guidance.
If the user is asking about content, consider their writing style and platform preferences.
Provide specific, actionable advice.

Response:`);

      const chain = RunnableSequence.from([
        prompt,
        this.llm,
        new StringOutputParser()
      ]);

      const result = await chain.invoke({
        userMessage: input.userMessage
      });

      return result;
    } catch (error) {
      console.error("Error in coach conversation:", error);
      throw new Error("Failed to process coach conversation");
    }
  }

  /**
   * Analyze trends and suggest content ideas
   */
  async analyzeTrends(input: {
    trends: string;
    platform: string;
    expertise: string;
    targetAudience: string;
    contentStyle: string;
    language: string;
  }): Promise<Array<Record<string, unknown>>> {
    try {
      const prompt = PromptTemplate.fromTemplate(`Analyze the following trending topics and suggest content ideas for {platform}:

Trending Topics:
{trends}

User's Expertise: {expertise}
Target Audience: {targetAudience}
Content Style: {contentStyle}
Language: {language}

For each trending topic, provide content ideas as a JSON array.

Content Ideas:`);

      const chain = RunnableSequence.from([
        prompt,
        this.llm,
        new StringOutputParser()
      ]);

      const result = await chain.invoke({
        trends: input.trends,
        platform: input.platform,
        expertise: input.expertise,
        targetAudience: input.targetAudience,
        contentStyle: input.contentStyle,
        language: languageLabel(input.language)
      });

      // Parse JSON response
      // Extract only the first balanced JSON array; tolerate fences/trailing prose.
      return extractFirstJsonArray(result);
    } catch (error) {
      console.error("Error analyzing trends:", error);
      throw new Error("Failed to analyze trends");
    }
  }

  /**
   * Improve existing content
   */
  async improveContent(input: {
    originalContent: string;
    platform: string;
    tone: string;
    length: string;
    language: string;
    keywords: string;
    addEmojis: boolean;
    addHashtags: boolean;
  }): Promise<string> {
    try {
      const prompt = PromptTemplate.fromTemplate(`You are a content improvement specialist. Rewrite the following content to be more engaging and effective for {platform}:

Original Content:
{originalContent}

Target Improvements:
- Tone: {tone}
- Length: {length} words
- Language: {language}
- Include Keywords: {keywords}
- Add Emojis: {addEmojis}
- Add Hashtags: {addHashtags}

Rewrite the content to be:
1. More engaging and compelling
2. Better optimized for {platform}
3. More likely to generate engagement
4. Aligned with the user's writing style

Improved Content:`);

      const chain = RunnableSequence.from([
        prompt,
        this.llm,
        new StringOutputParser()
      ]);

      const result = await chain.invoke({
        originalContent: input.originalContent,
        platform: input.platform,
        tone: input.tone,
        length: input.length,
        language: languageLabel(input.language),
        keywords: input.keywords,
        addEmojis: input.addEmojis ? "yes" : "no",
        addHashtags: input.addHashtags ? "yes" : "no"
      });

      return result;
    } catch (error) {
      console.error("Error improving content:", error);
      throw new Error("Failed to improve content");
    }
  }

  /**
   * Generate relevant hashtags
   */
  async generateHashtags(input: {
    content: string;
    platform: string;
    language: string;
    numberOfHashtags: number;
    includeTrending: boolean;
  }): Promise<Array<Record<string, unknown>>> {
    try {
      const prompt = PromptTemplate.fromTemplate(`Generate {numberOfHashtags} relevant and trending hashtags for the following content:

Content:
{content}

Platform: {platform}
Language: {language}
Include Trending: {includeTrending}

Generate hashtags as a JSON array with tag, relevance score, and trending status.

Hashtags:`);

      const chain = RunnableSequence.from([
        prompt,
        this.llm,
        new StringOutputParser()
      ]);

      const result = await chain.invoke({
        content: input.content,
        platform: input.platform,
        language: languageLabel(input.language),
        numberOfHashtags: input.numberOfHashtags.toString(),
        includeTrending: input.includeTrending ? "yes" : "no"
      });

      // Parse JSON response
      // Extract only the first balanced JSON array; tolerate fences/trailing prose.
      return extractFirstJsonArray(result);
    } catch (error) {
      console.error("Error generating hashtags:", error);
      throw new Error("Failed to generate hashtags");
    }
  }

  /**
   * Create a series of related content pieces
   */
  async createContentSeries(input: {
    topic: string;
    numberOfPosts: number;
    platform: string;
    tone: string;
    language: string;
  }): Promise<Array<Record<string, unknown>>> {
    try {
      const prompt = PromptTemplate.fromTemplate(`Create a series of {numberOfPosts} related content pieces for {platform}:

Main Topic: {topic}
Platform: {platform}
Tone: {tone}
Language: {language}

Create a content series as a JSON array where each post stands alone but connects to the overall theme.

Content Series:`);

      const chain = RunnableSequence.from([
        prompt,
        this.llm,
        new StringOutputParser()
      ]);

      const result = await chain.invoke({
        topic: input.topic,
        numberOfPosts: input.numberOfPosts.toString(),
        platform: input.platform,
        tone: input.tone,
        language: languageLabel(input.language)
      });

      // Parse JSON response
      // Extract only the first balanced JSON array; tolerate fences/trailing prose.
      return extractFirstJsonArray(result);
    } catch (error) {
      console.error("Error creating content series:", error);
      throw new Error("Failed to create content series");
    }
  }
}

// Export singleton instance
export const langchainService = new LangChainService();