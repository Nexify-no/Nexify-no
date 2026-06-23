/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { PromptTemplate } from "@langchain/core/prompts";

/**
 * LangChain Prompt Templates for Innlegg
 * These templates are used for content generation, analysis, and AI Coach interactions
 */

// ============================================
// Content Generation Prompts
// ============================================

export const contentGenerationPrompt = new PromptTemplate({
  template: `You are an expert social media content creator specializing in {platform} content.

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

Generated Content:`,
  inputVariables: [
    "platform",
    "tone",
    "vocabularyLevel",
    "sentenceLength",
    "emojiUsage",
    "hashtagStyle",
    "topic",
    "length",
    "keywords",
    "language"
  ]
});

// ============================================
// Content Analysis Prompts
// ============================================

export const contentAnalysisPrompt = new PromptTemplate({
  template: `Analyze the following social media content and provide detailed insights:

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

For each score, provide:
- A brief explanation
- Specific suggestions for improvement
- Examples of how to enhance the content

Format your response as JSON with the following structure:
{
  "engagementPotential": { "score": 0, "explanation": "", "suggestions": [] },
  "clarity": { "score": 0, "explanation": "", "suggestions": [] },
  "callToAction": { "score": 0, "explanation": "", "suggestions": [] },
  "hashtags": { "score": 0, "explanation": "", "suggestions": [] },
  "emojis": { "score": 0, "explanation": "", "suggestions": [] },
  "overallScore": 0,
  "topImprovements": []
}

Analysis:`,
  inputVariables: ["content", "platform", "language"]
});

// ============================================
// AI Coach Prompts
// ============================================

export const aiCoachSystemPrompt = `You are Nexify AI Coach, an expert social media strategist and content creation mentor.

Your role is to:
1. Help users improve their content strategy
2. Provide personalized recommendations based on their writing style
3. Suggest trending topics and content ideas
4. Analyze their content performance
5. Guide them through best practices for each platform
6. Offer encouragement and motivation

Be conversational, friendly, and supportive. Use the user's name when available.
Provide specific, actionable advice. Ask clarifying questions when needed.
Remember the context of previous messages in the conversation.

Always consider the user's:
- Current skill level
- Target audience
- Platform preferences
- Content goals
- Writing style and tone`;

export const aiCoachPrompt = new PromptTemplate({
  template: `{systemPrompt}

User: {userMessage}

Based on the user's message and any previous context, provide helpful guidance.
If the user is asking about content, consider their writing style and platform preferences.
Provide specific, actionable advice.

Response:`,
  inputVariables: ["systemPrompt", "userMessage"]
});

// ============================================
// Trend Analysis Prompts
// ============================================

export const trendAnalysisPrompt = new PromptTemplate({
  template: `Analyze the following trending topics and suggest content ideas for {platform}:

Trending Topics:
{trends}

User's Expertise: {expertise}
Target Audience: {targetAudience}
Content Style: {contentStyle}
Language: {language}

For each trending topic, provide:
1. Content idea title
2. Why it's trending
3. How to approach it for {platform}
4. Suggested tone and style
5. Potential hashtags
6. Estimated engagement potential (1-10)

Format as JSON array of content ideas.

Content Ideas:`,
  inputVariables: [
    "trends",
    "platform",
    "expertise",
    "targetAudience",
    "contentStyle",
    "language"
  ]
});

// ============================================
// Content Improvement Prompts
// ============================================

export const contentImprovementPrompt = new PromptTemplate({
  template: `You are a content improvement specialist. Rewrite the following content to be more engaging and effective for {platform}:

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

Improved Content:`,
  inputVariables: [
    "originalContent",
    "platform",
    "tone",
    "length",
    "language",
    "keywords",
    "addEmojis",
    "addHashtags"
  ]
});

// ============================================
// Hashtag Generation Prompts
// ============================================

export const hashtagGenerationPrompt = new PromptTemplate({
  template: `Generate relevant and trending hashtags for the following content:

Content:
{content}

Platform: {platform}
Language: {language}
Number of Hashtags: {numberOfHashtags}
Include Trending: {includeTrending}

Generate hashtags that:
1. Are relevant to the content topic
2. Have good search volume on {platform}
3. Match the content's tone and style
4. Include a mix of popular and niche hashtags
5. Are trending (if requested)

Return as a JSON array of hashtag objects with:
- "tag": the hashtag (without #)
- "relevance": 1-10 score
- "searchVolume": estimated search volume
- "trending": boolean

Hashtags:`,
  inputVariables: [
    "content",
    "platform",
    "language",
    "numberOfHashtags",
    "includeTrending"
  ]
});

// ============================================
// Content Series/Chain Prompts
// ============================================

export const contentSeriesPrompt = new PromptTemplate({
  template: `Create a series of related content pieces for {platform}:

Main Topic: {topic}
Series Length: {numberOfPosts} posts
Platform: {platform}
Tone: {tone}
Language: {language}

Create a content series where:
1. Each post stands alone but connects to the overall theme
2. Posts build on each other to create a narrative
3. Each post is optimized for {platform}
4. The series maintains consistent tone and style
5. Each post includes relevant hashtags and CTAs

For each post, provide:
- Post number
- Title/Hook
- Content (optimized for {platform})
- Hashtags
- Suggested posting time (if applicable)
- Call-to-Action

Format as JSON array of posts.

Content Series:`,
  inputVariables: [
    "topic",
    "numberOfPosts",
    "platform",
    "tone",
    "language"
  ]
});