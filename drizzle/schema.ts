/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, tinyint, date, boolean, json, decimal, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  avatarUrl: text("avatarUrl"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Posts table - stores generated social media content
 */
export const posts = mysqlTable("posts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  platform: mysqlEnum("platform", ["linkedin", "twitter", "instagram", "facebook"]).notNull(),
  tone: varchar("tone", { length: 50 }).notNull(), // professional, friendly, motivational, educational
  rawInput: text("raw_input").notNull(),
  generatedContent: text("generated_content").notNull(),
  tags: json("tags").$type<string[]>(),
  status: mysqlEnum("status", ["draft", "scheduled", "published", "failed"]).default("draft").notNull(),
  scheduledFor: timestamp("scheduled_for"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;

/**
 * Voice samples table - stores user's writing examples for tone training
 */
export const voiceSamples = mysqlTable("voice_samples", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  sampleText: text("sample_text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type VoiceSample = typeof voiceSamples.$inferSelect;
export type InsertVoiceSample = typeof voiceSamples.$inferInsert;

/**
 * Subscriptions table - tracks user subscription status
 */
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(),
  // References subscription_plans.id (null while on trial / no plan selected)
  planId: int("plan_id"),
  status: mysqlEnum("status", ["trial", "active", "cancelled", "expired"]).default("trial").notNull(),
  postsGenerated: int("posts_generated").default(0).notNull(),
  trialPostsLimit: int("trial_posts_limit").default(2).notNull(),
  // Stripe integration fields
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  // Legacy Vipps field (kept for backwards compatibility)
  vippsOrderId: varchar("vipps_order_id", { length: 255 }),
  subscriptionStartDate: timestamp("subscription_start_date"),
  subscriptionEndDate: timestamp("subscription_end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/**
 * Processed webhook events — idempotency guard so a replayed/re-delivered
 * payment webhook (Stripe/Vipps) is only acted on once.
 */
export const processedWebhookEvents = mysqlTable("processed_webhook_events", {
  eventId: varchar("event_id", { length: 255 }).primaryKey(),
  source: varchar("source", { length: 32 }).notNull(),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
});

/**
 * Payment orders — created server-side at checkout initiation and bound to the
 * authenticated user + plan + expected amount. The payment webhook validates the
 * captured amount against this record instead of trusting a client-supplied
 * orderId, so a forged webhook with no matching order cannot activate a plan.
 */
export const paymentOrders = mysqlTable("payment_orders", {
  id: int("id").autoincrement().primaryKey(),
  orderId: varchar("order_id", { length: 255 }).notNull().unique(),
  userId: int("user_id").notNull(),
  planId: int("plan_id"),
  expectedAmount: int("expected_amount").notNull(), // in øre
  currency: varchar("currency", { length: 3 }).default("NOK").notNull(),
  status: mysqlEnum("status", ["pending", "captured", "failed", "cancelled"]).default("pending").notNull(),
  provider: varchar("provider", { length: 16 }).default("vipps").notNull(),
  transactionId: varchar("transaction_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type PaymentOrder = typeof paymentOrders.$inferSelect;
export type InsertPaymentOrder = typeof paymentOrders.$inferInsert;

/**
 * User preferences table - stores language and other settings
 */
export const userPreferences = mysqlTable("user_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(),
  language: mysqlEnum("language", ["no", "en"]).default("no").notNull(),
  openaiConsent: int("openai_consent").default(0).notNull(), // boolean as int: 0 = not asked, 1 = accepted, 2 = declined
  consentDate: timestamp("consent_date"),
  usagePreferences: text("usage_preferences"), // User's custom description of how they want to use the platform
  ayrshareApiKey: varchar("ayrshare_api_key", { length: 255 }), // Ayrshare API key for auto-publishing to social media
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = typeof userPreferences.$inferInsert;

/**
 * LinkedIn app credentials table - stores app-level LinkedIn API credentials
 * Only one row should exist (owner's credentials)
 */
export const linkedinAppCredentials = mysqlTable("linkedin_app_credentials", {
  id: int("id").autoincrement().primaryKey(),
  clientId: varchar("client_id", { length: 255 }).notNull(),
  clientSecret: varchar("client_secret", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type LinkedInAppCredential = typeof linkedinAppCredentials.$inferSelect;
export type InsertLinkedInAppCredential = typeof linkedinAppCredentials.$inferInsert;

/**
 * LinkedIn connections table - stores user-level LinkedIn OAuth tokens
 */
export const linkedinConnections = mysqlTable("linkedin_connections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(),
  accessToken: text("access_token").notNull(),
  personUrn: varchar("person_urn", { length: 255 }).notNull(), // urn:li:person:xxx
  profileName: varchar("profile_name", { length: 255 }),
  profileEmail: varchar("profile_email", { length: 320 }),
  expiresAt: timestamp("expires_at").notNull(), // Access token expiration (60 days)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type LinkedInConnection = typeof linkedinConnections.$inferSelect;
export type InsertLinkedInConnection = typeof linkedinConnections.$inferInsert;

/**
 * Content Analysis table - AI Content Coach feature
 * Stores analysis and scoring for each generated post
 */
export const contentAnalysis = mysqlTable("content_analysis", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("post_id").notNull(),
  userId: int("user_id").notNull(),
  
  // Analysis metrics
  wordCount: int("word_count").notNull(),
  sentenceCount: int("sentence_count").notNull(),
  questionCount: int("question_count").notNull(),
  emojiCount: int("emoji_count").notNull(),
  hashtagCount: int("hashtag_count").notNull(),
  hasNumbers: int("has_numbers").notNull().default(0), // boolean as int
  hasCallToAction: int("has_call_to_action").notNull().default(0),
  
  // Scores (0-100 for precision)
  lengthScore: int("length_score").notNull(),
  engagementScore: int("engagement_score").notNull(),
  readabilityScore: int("readability_score").notNull(),
  overallScore: int("overall_score").notNull(),
  
  // Feedback (JSON strings)
  strengths: text("strengths"), // JSON array of strength points
  improvements: text("improvements"), // JSON array of improvement suggestions
  tips: text("tips"), // JSON array of tips
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ContentAnalysis = typeof contentAnalysis.$inferSelect;
export type InsertContentAnalysis = typeof contentAnalysis.$inferInsert;

/**
 * Saved Examples table - User's favorite posts saved as templates
 * Allows users to reuse successful content patterns
 */
export const savedExamples = mysqlTable("saved_examples", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  postId: int("post_id").notNull(), // Reference to original post
  
  title: varchar("title", { length: 200 }).notNull(),
  platform: mysqlEnum("platform", ["linkedin", "twitter", "instagram", "facebook"]).notNull(),
  tone: varchar("tone", { length: 50 }).notNull(),
  rawInput: text("raw_input").notNull(),
  generatedContent: text("generated_content").notNull(),
  
  usageCount: int("usage_count").notNull().default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SavedExample = typeof savedExamples.$inferSelect;
export type InsertSavedExample = typeof savedExamples.$inferInsert;
/**
 * Blog Posts table - stores blog articles for content marketing and SEO
 */
export const blogPosts = mysqlTable("blog_posts", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  coverImage: varchar("cover_image", { length: 500 }),
  category: mysqlEnum("category", ["tips", "guides", "news", "case-studies"]).notNull(),
  tags: text("tags"), // JSON array of tags
  authorName: varchar("author_name", { length: 100 }).notNull(),
  authorRole: varchar("author_role", { length: 100 }),
  readingTime: int("reading_time").notNull(), // in minutes
  published: int("published").notNull().default(1), // boolean as int
  viewCount: int("view_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = typeof blogPosts.$inferInsert;

/**
 * Invoices table - stores billing history and payment records
 */
export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  amount: int("amount").notNull(), // Amount in øre (NOK cents) - 19900 = 199.00 NOK
  currency: varchar("currency", { length: 3 }).notNull().default("NOK"),
  status: mysqlEnum("status", ["pending", "paid", "failed", "refunded"]).notNull().default("pending"),
  description: text("description"),
  vippsOrderId: varchar("vipps_order_id", { length: 255 }),
  invoiceDate: timestamp("invoice_date").defaultNow().notNull(),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;


/**
 * User Interests table - stores user's industry and content interests
 * Used to personalize trending topics suggestions
 */
export const userInterests = mysqlTable("user_interests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(),
  industry: varchar("industry", { length: 100 }), // e.g., "tech", "marketing", "finance"
  topics: text("topics"), // JSON array of interested topics
  platforms: text("platforms"), // JSON array of preferred platforms
  contentTypes: text("content_types"), // JSON array: "tips", "news", "thought-leadership", etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type UserInterest = typeof userInterests.$inferSelect;
export type InsertUserInterest = typeof userInterests.$inferInsert;

/**
 * Trending Topics table - stores curated trending topics
 * Populated by admin or automated aggregation
 */
export const trendingTopics = mysqlTable("trending_topics", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).notNull(), // "tech", "marketing", "business", etc.
  source: varchar("source", { length: 100 }), // "google_trends", "reddit", "linkedin", "manual"
  sourceUrl: varchar("source_url", { length: 500 }),
  trendScore: int("trend_score").default(50).notNull(), // 0-100 popularity score
  region: varchar("region", { length: 10 }).default("NO").notNull(), // Country code
  suggestedPlatforms: text("suggested_platforms"), // JSON array of best platforms for this topic
  expiresAt: timestamp("expires_at"), // When this trend becomes stale
  active: int("active").default(1).notNull(), // boolean as int
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type TrendingTopic = typeof trendingTopics.$inferSelect;
export type InsertTrendingTopic = typeof trendingTopics.$inferInsert;

/**
 * Voice Profiles table - stores analyzed writing style for each user
 * AI extracts patterns from user's writing samples
 */
export const voiceProfiles = mysqlTable("voice_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(),
  
  // Writing style characteristics (JSON)
  toneProfile: text("tone_profile"), // {"formal": 0.7, "friendly": 0.3, ...}
  vocabularyLevel: varchar("vocabulary_level", { length: 50 }), // "simple", "professional", "technical"
  sentenceStyle: varchar("sentence_style", { length: 50 }), // "short", "medium", "long", "varied"
  
  // Common patterns
  favoriteWords: text("favorite_words"), // JSON array of frequently used words
  avoidWords: text("avoid_words"), // JSON array of words user never uses
  signaturePhrases: text("signature_phrases"), // JSON array of user's unique expressions
  
  // Formatting preferences
  usesEmojis: int("uses_emojis").default(0).notNull(), // boolean as int
  usesHashtags: int("uses_hashtags").default(0).notNull(),
  usesQuestions: int("uses_questions").default(0).notNull(),
  usesBulletPoints: int("uses_bullet_points").default(0).notNull(),
  
  // Training status
  samplesCount: int("samples_count").default(0).notNull(),
  trainingStatus: mysqlEnum("training_status", ["not_started", "in_progress", "trained", "needs_update"]).default("not_started").notNull(),
  lastTrainedAt: timestamp("last_trained_at"),
  
  // Full profile summary (AI-generated description)
  profileSummary: text("profile_summary"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type VoiceProfile = typeof voiceProfiles.$inferSelect;
export type InsertVoiceProfile = typeof voiceProfiles.$inferInsert;

/**
 * Generation presets - a named bundle of content-generation options the user
 * can save once and reuse. Mirrors the fields exposed on the Generate page so a
 * preset can fully restore the form. Scoped per user; one row may be the default.
 */
export const generationPresets = mysqlTable("generation_presets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 100 }).notNull(),

  // Core options (mirror content.generate input)
  platform: mysqlEnum("platform", ["linkedin", "twitter", "instagram", "facebook"]).notNull(),
  tone: varchar("tone", { length: 50 }).notNull(),
  length: mysqlEnum("length", ["short", "medium", "long"]).default("medium").notNull(),
  keywords: json("keywords").$type<string[]>(),

  // Expanded "properties"
  targetAudience: varchar("target_audience", { length: 280 }),
  goal: mysqlEnum("goal", ["awareness", "engagement", "sales", "leads", "traffic", "community"]),
  cta: varchar("cta", { length: 280 }),
  angle: mysqlEnum("angle", [
    "personal_story", "actionable_tips", "contrarian_opinion", "case_study",
    "shocking_stat", "how_to", "listicle", "question",
  ]),

  // Formatting details
  emojiUsage: mysqlEnum("emoji_usage", ["none", "minimal", "moderate", "heavy"]).default("minimal").notNull(),
  hashtagCount: int("hashtag_count").default(3).notNull(),
  useBullets: boolean("use_bullets").default(false).notNull(),
  closingQuestion: boolean("closing_question").default(true).notNull(),
  language: mysqlEnum("language", ["no", "en", "ar"]).default("no").notNull(),

  isDefault: boolean("is_default").default(false).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_preset_user_id").on(table.userId),
}));

export type GenerationPreset = typeof generationPresets.$inferSelect;
export type InsertGenerationPreset = typeof generationPresets.$inferInsert;


/**
 * Content Calendar Events - Norwegian + global events for content planning
 */
export const calendarEvents = mysqlTable("calendar_events", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  eventDate: date("event_date").notNull(),
  category: mysqlEnum("category", ["norwegian", "global", "business", "tech", "seasonal"]).notNull(),
  isRecurring: tinyint("is_recurring").default(0).notNull(), // 0 = no, 1 = yes
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = typeof calendarEvents.$inferInsert;

/**
 * User Content Schedule - planned posts
 */
export const contentSchedule = mysqlTable("content_schedule", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  postId: int("post_id"), // nullable - can be planned without post yet
  scheduledDate: timestamp("scheduled_date").notNull(),
  platform: mysqlEnum("platform", ["linkedin", "twitter", "instagram", "facebook"]).notNull(),
  status: mysqlEnum("status", ["planned", "published", "cancelled"]).default("planned").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ContentSchedule = typeof contentSchedule.$inferSelect;
export type InsertContentSchedule = typeof contentSchedule.$inferInsert;

/**
 * Best Time Analytics - track when posts perform best
 */
export const postAnalytics = mysqlTable("post_analytics", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  postId: int("post_id").notNull(),
  platform: mysqlEnum("platform", ["linkedin", "twitter", "instagram", "facebook"]).notNull(),
  publishedAt: timestamp("published_at").notNull(),
  dayOfWeek: int("day_of_week").notNull(), // 0-6 (Sunday-Saturday)
  hourOfDay: int("hour_of_day").notNull(), // 0-23
  engagement: int("engagement").default(0).notNull(), // likes + comments + shares
  impressions: int("impressions").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PostAnalytics = typeof postAnalytics.$inferSelect;
export type InsertPostAnalytics = typeof postAnalytics.$inferInsert;

/**
 * Content Repurposing - track repurposed content
 */
export const repurposedContent = mysqlTable("repurposed_content", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  originalPostId: int("original_post_id").notNull(),
  newPostId: int("new_post_id").notNull(),
  repurposeType: mysqlEnum("repurpose_type", ["platform_adapt", "format_change", "audience_shift", "update"]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type RepurposedContent = typeof repurposedContent.$inferSelect;
export type InsertRepurposedContent = typeof repurposedContent.$inferInsert;

/**
 * Competitor Tracking
 */
export const competitors = mysqlTable("competitors", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  platform: mysqlEnum("platform", ["linkedin", "twitter", "instagram", "facebook"]).notNull(),
  profileUrl: varchar("profile_url", { length: 500 }).notNull(),
  isActive: tinyint("is_active").default(1).notNull(),
  lastChecked: timestamp("last_checked"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Competitor = typeof competitors.$inferSelect;
export type InsertCompetitor = typeof competitors.$inferInsert;

/**
 * Competitor Posts - track competitor content
 */
export const competitorPosts = mysqlTable("competitor_posts", {
  id: int("id").autoincrement().primaryKey(),
  competitorId: int("competitor_id").notNull(),
  content: text("content").notNull(),
  engagement: int("engagement").default(0).notNull(),
  publishedAt: timestamp("published_at").notNull(),
  postUrl: varchar("post_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CompetitorPost = typeof competitorPosts.$inferSelect;
export type InsertCompetitorPost = typeof competitorPosts.$inferInsert;

/**
 * Content Series - multi-part content planning
 */
export const contentSeries = mysqlTable("content_series", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  totalParts: int("total_parts").notNull(),
  status: mysqlEnum("status", ["planning", "in_progress", "completed"]).default("planning").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ContentSeries = typeof contentSeries.$inferSelect;
export type InsertContentSeries = typeof contentSeries.$inferInsert;

/**
 * Series Posts - individual posts in a series
 */
export const seriesPosts = mysqlTable("series_posts", {
  id: int("id").autoincrement().primaryKey(),
  seriesId: int("series_id").notNull(),
  postId: int("post_id"),
  partNumber: int("part_number").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SeriesPost = typeof seriesPosts.$inferSelect;
export type InsertSeriesPost = typeof seriesPosts.$inferInsert;

/**
 * A/B Testing - test different versions of content
 */
export const abTests = mysqlTable("ab_tests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  platform: mysqlEnum("platform", ["linkedin", "twitter", "instagram", "facebook"]).notNull(),
  variantA: text("variant_a").notNull(),
  variantB: text("variant_b").notNull(),
  engagementA: int("engagement_a").default(0).notNull(),
  engagementB: int("engagement_b").default(0).notNull(),
  winner: mysqlEnum("winner", ["a", "b", "tie", "pending"]).default("pending"),
  status: mysqlEnum("status", ["active", "completed"]).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export type AbTest = typeof abTests.$inferSelect;
export type InsertAbTest = typeof abTests.$inferInsert;

/**
 * Weekly Reports - automated performance reports
 */
export const weeklyReports = mysqlTable("weekly_reports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  weekStartDate: date("week_start_date").notNull(),
  weekEndDate: date("week_end_date").notNull(),
  totalPosts: int("total_posts").default(0).notNull(),
  totalEngagement: int("total_engagement").default(0).notNull(),
  topPerformingPostId: int("top_performing_post_id"),
  insights: text("insights"), // JSON string with detailed insights
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type WeeklyReport = typeof weeklyReports.$inferSelect;
export type InsertWeeklyReport = typeof weeklyReports.$inferInsert;

/**
 * Weekly Report Settings - user preferences for automated reports
 */
export const weeklyReportSettings = mysqlTable("weekly_report_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  enabled: tinyint("enabled").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type WeeklyReportSettings = typeof weeklyReportSettings.$inferSelect;
export type InsertWeeklyReportSettings = typeof weeklyReportSettings.$inferInsert;

/**
 * Onboarding Status - track user onboarding tour completion
 */
export const onboardingStatus = mysqlTable("onboarding_status", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(),
  completed: tinyint("completed").default(0).notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OnboardingStatus = typeof onboardingStatus.$inferSelect;
export type InsertOnboardingStatus = typeof onboardingStatus.$inferInsert;


/**
 * Ideas table - Idé-Bank for quick idea capture
 * Users can save ideas and convert them to posts later
 */
export const ideas = mysqlTable("ideas", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  ideaText: text("idea_text").notNull(),
  source: mysqlEnum("source", ["manual", "voice", "trend", "competitor"]).default("manual").notNull(),
  tags: text("tags"), // JSON array of tags
  status: mysqlEnum("status", ["new", "in_progress", "used", "archived"]).default("new").notNull(),
  platform: mysqlEnum("platform", ["linkedin", "twitter", "instagram", "facebook"]),
  convertedPostId: int("converted_post_id"), // Reference to post if converted
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Idea = typeof ideas.$inferSelect;
export type InsertIdea = typeof ideas.$inferInsert;


/**
 * Drafts table - Auto-save user work in progress
 * Saves form state automatically so users never lose their work
 */
export const drafts = mysqlTable("drafts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  /** Which page/form this draft is for */
  pageType: mysqlEnum("page_type", ["generate", "repurpose", "series", "ab_test", "engagement"]).notNull(),
  /** JSON string containing all form field values */
  formData: text("form_data").notNull(),
  /** Optional title/preview for the draft */
  title: varchar("title", { length: 200 }),
  /** Last auto-save timestamp */
  lastSavedAt: timestamp("last_saved_at").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Draft = typeof drafts.$inferSelect;
export type InsertDraft = typeof drafts.$inferInsert;


/**
 * Telegram Links table - Connect Telegram users to Innlegg accounts
 * SaaS-level bot: one bot serves all users
 */
export const telegramLinks = mysqlTable("telegram_links", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(), // One Telegram per user
  telegramUserId: varchar("telegram_user_id", { length: 64 }).notNull().unique(),
  telegramUsername: varchar("telegram_username", { length: 64 }),
  telegramFirstName: varchar("telegram_first_name", { length: 100 }),
  linkCode: varchar("link_code", { length: 32 }).unique(), // Temporary code for linking
  linkCodeExpiry: timestamp("link_code_expiry"),
  isActive: boolean("is_active").default(true).notNull(),
  linkedAt: timestamp("linked_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at").defaultNow().onUpdateNow().notNull(),
});

export type TelegramLink = typeof telegramLinks.$inferSelect;
export type InsertTelegramLink = typeof telegramLinks.$inferInsert;

/**
 * Vipps API credentials table - stores app-level Vipps Recurring API credentials
 * Only one row should exist (owner's credentials)
 * Used for subscription payments in the Norwegian market
 */
export const vippsCredentials = mysqlTable("vipps_credentials", {
  id: int("id").autoincrement().primaryKey(),
  clientId: varchar("client_id", { length: 255 }).notNull(),
  clientSecret: varchar("client_secret", { length: 500 }).notNull(), // Encrypted in production
  subscriptionKey: varchar("subscription_key", { length: 255 }).notNull(), // Ocp-Apim-Subscription-Key
  merchantSerialNumber: varchar("merchant_serial_number", { length: 50 }).notNull(),
  testMode: int("test_mode").default(1).notNull(), // 1 = test environment, 0 = production
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type VippsCredential = typeof vippsCredentials.$inferSelect;
export type InsertVippsCredential = typeof vippsCredentials.$inferInsert;

/**
 * Subscription Plans - defines available subscription tiers
 * Managed by admin, used for pricing and feature limits
 */
export const subscriptionPlans = mysqlTable("subscription_plans", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // "Free", "Pro", "Business"
  description: text("description"),
  priceMonthly: int("price_monthly"), // Price in øre (NOK cents) - null for free tier
  priceYearly: int("price_yearly"), // Price in øre (NOK cents) - null for free tier
  currency: varchar("currency", { length: 3 }).default("NOK").notNull(),
  
  // Feature limits
  postsPerMonth: int("posts_per_month"), // null = unlimited
  imagesPerMonth: int("images_per_month"), // null = unlimited
  canUseDALLE: int("can_use_dalle").default(0).notNull(), // boolean as int
  canUseVoiceTraining: int("can_use_voice_training").default(0).notNull(),
  canUseContentCalendar: int("can_use_content_calendar").default(0).notNull(),
  canUseCompetitorRadar: int("can_use_competitor_radar").default(0).notNull(),
  canUseWeeklyReports: int("can_use_weekly_reports").default(0).notNull(),
  
  // Stripe integration
  stripePriceIdMonthly: varchar("stripe_price_id_monthly", { length: 255 }),
  stripePriceIdYearly: varchar("stripe_price_id_yearly", { length: 255 }),
  stripeProductId: varchar("stripe_product_id", { length: 255 }),
  
  // Vipps integration
  vippsPriceIdMonthly: varchar("vipps_price_id_monthly", { length: 255 }),
  vippsPriceIdYearly: varchar("vipps_price_id_yearly", { length: 255 }),
  
  isActive: int("is_active").default(1).notNull(),
  displayOrder: int("display_order").default(0).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

/**
 * Stripe Payment Intents - track payment attempts
 * Helps with reconciliation and error handling
 */
export const stripePaymentIntents = mysqlTable("stripe_payment_intents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }).notNull().unique(),
  amount: int("amount").notNull(), // Amount in øre (NOK cents)
  currency: varchar("currency", { length: 3 }).default("NOK").notNull(),
  status: mysqlEnum("status", ["requires_payment_method", "requires_confirmation", "requires_action", "processing", "requires_capture", "canceled", "succeeded"]).notNull(),
  planId: int("plan_id"),
  subscriptionId: int("subscription_id"),
  metadata: text("metadata"), // JSON string with additional data
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type StripePaymentIntent = typeof stripePaymentIntents.$inferSelect;
export type InsertStripePaymentIntent = typeof stripePaymentIntents.$inferInsert;

/**
 * Subscription History - audit trail of subscription changes
 * Tracks upgrades, downgrades, cancellations, and renewals
 */
export const subscriptionHistory = mysqlTable("subscription_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  subscriptionId: int("subscription_id"),
  planId: int("plan_id").notNull(),
  action: mysqlEnum("action", ["created", "upgraded", "downgraded", "renewed", "cancelled", "resumed"]).notNull(),
  previousPlanId: int("previous_plan_id"),
  reason: text("reason"), // Why the change happened
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SubscriptionHistoryRecord = typeof subscriptionHistory.$inferSelect;
export type InsertSubscriptionHistoryRecord = typeof subscriptionHistory.$inferInsert;


/**
 * Admin Settings - Global configuration for AI services and integrations
 * Only accessible by admin users, but settings apply to all users
 */
export const adminSettings = mysqlTable("admin_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("setting_key", { length: 100 }).notNull().unique(),
  settingValue: text("setting_value").notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }).notNull(), // 'chatgpt', 'nanoBanana', 'general'
  isEncrypted: boolean("is_encrypted").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastUpdatedBy: int("last_updated_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type AdminSetting = typeof adminSettings.$inferSelect;
export type InsertAdminSetting = typeof adminSettings.$inferInsert;



/**
 * Scheduling Preferences - user's preferred posting times
 */
export const schedulingPreferences = mysqlTable("scheduling_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(),
  
  // Timezone
  timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(), // e.g., "Europe/Oslo"
  
  // LinkedIn optimal times (day of week: 0-6, hour: 0-23)
  linkedinBestDays: json("linkedin_best_days").$type<number[]>().default([1, 2, 3, 4, 5]), // Mon-Fri
  linkedinBestHours: json("linkedin_best_hours").$type<number[]>().default([8, 9, 12, 17, 18]), // 8am, 9am, 12pm, 5pm, 6pm
  
  // Twitter optimal times
  twitterBestDays: json("twitter_best_days").$type<number[]>().default([1, 2, 3, 4, 5]),
  twitterBestHours: json("twitter_best_hours").$type<number[]>().default([9, 12, 17, 20]),
  
  // Instagram optimal times
  instagramBestDays: json("instagram_best_days").$type<number[]>().default([0, 1, 2, 3, 4, 5, 6]),
  instagramBestHours: json("instagram_best_hours").$type<number[]>().default([8, 12, 18, 20, 21]),
  
  // Facebook optimal times
  facebookBestDays: json("facebook_best_days").$type<number[]>().default([1, 2, 3, 4, 5]),
  facebookBestHours: json("facebook_best_hours").$type<number[]>().default([12, 13, 19, 20]),
  
  // General preferences
  enableAutoScheduling: boolean("enable_auto_scheduling").default(true).notNull(),
  enableNotifications: boolean("enable_notifications").default(true).notNull(),
  notificationMinutesBefore: int("notification_minutes_before").default(15).notNull(), // Notify 15 minutes before
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SchedulingPreference = typeof schedulingPreferences.$inferSelect;
export type InsertSchedulingPreference = typeof schedulingPreferences.$inferInsert;

/**
 * Scheduled Posts - tracks scheduled posts and their execution
 */
export const scheduledPosts = mysqlTable("scheduled_posts", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("post_id").notNull(),
  userId: int("user_id").notNull(),
  platform: mysqlEnum("platform", ["linkedin", "twitter", "instagram", "facebook"]).notNull(),
  
  // Scheduling details
  scheduledFor: timestamp("scheduled_for").notNull(),
  timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),
  
  // Execution tracking
  status: mysqlEnum("status", ["scheduled", "publishing", "published", "failed", "cancelled"]).default("scheduled").notNull(),
  publishedAt: timestamp("published_at"),
  failureReason: text("failure_reason"),
  
  // Metadata
  engagementScore: decimal("engagement_score", { precision: 5, scale: 2 }).default("0"), // AI prediction
  optimalityScore: decimal("optimality_score", { precision: 5, scale: 2 }).default("0"), // How optimal is this time
  
  // Notification tracking
  notificationSent: boolean("notification_sent").default(false).notNull(),
  notificationSentAt: timestamp("notification_sent_at"),
  
  // Retry information
  retryCount: int("retry_count").default(0).notNull(),
  lastRetryAt: timestamp("last_retry_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ScheduledPost = typeof scheduledPosts.$inferSelect;
export type InsertScheduledPost = typeof scheduledPosts.$inferInsert;

/**
 * Posting Times Analytics - tracks when posts perform best
 */
export const postingTimesAnalytics = mysqlTable("posting_times_analytics", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  platform: mysqlEnum("platform", ["linkedin", "twitter", "instagram", "facebook"]).notNull(),
  
  // Time information
  dayOfWeek: int("day_of_week").notNull(), // 0-6 (Sunday-Saturday)
  hourOfDay: int("hour_of_day").notNull(), // 0-23
  
  // Performance metrics
  totalPosts: int("total_posts").default(0).notNull(),
  avgEngagement: decimal("avg_engagement", { precision: 10, scale: 2 }).default("0").notNull(),
  avgReach: int("avg_reach").default(0).notNull(),
  avgImpressions: int("avg_impressions").default(0).notNull(),
  avgEngagementRate: decimal("avg_engagement_rate", { precision: 5, scale: 2 }).default("0").notNull(),
  
  // Ranking (1-10 scale)
  performanceRank: int("performance_rank").default(5).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type PostingTimesAnalytic = typeof postingTimesAnalytics.$inferSelect;
export type InsertPostingTimesAnalytic = typeof postingTimesAnalytics.$inferInsert;

/**
 * Scheduling Queue - for processing scheduled posts
 */
export const schedulingQueue = mysqlTable("scheduling_queue", {
  id: int("id").autoincrement().primaryKey(),
  scheduledPostId: int("scheduled_post_id").notNull(),
  userId: int("user_id").notNull(),
  postId: int("post_id").notNull(),
  platform: mysqlEnum("platform", ["linkedin", "twitter", "instagram", "facebook"]).notNull(),
  
  // Queue information
  scheduledFor: timestamp("scheduled_for").notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  
  // Processing details
  processedAt: timestamp("processed_at"),
  processingStartedAt: timestamp("processing_started_at"),
  errorMessage: text("error_message"),
  
  // Retry logic
  attemptCount: int("attempt_count").default(0).notNull(),
  maxAttempts: int("max_attempts").default(3).notNull(),
  nextRetryAt: timestamp("next_retry_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SchedulingQueueItem = typeof schedulingQueue.$inferSelect;
export type InsertSchedulingQueueItem = typeof schedulingQueue.$inferInsert;


/**
 * Post Versions - tracks all versions of a post for edit history
 */
export const postVersions = mysqlTable("post_versions", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("post_id").notNull(),
  userId: int("user_id").notNull(),
  
  // Version content
  generatedContent: text("generated_content").notNull(),
  tone: varchar("tone", { length: 50 }).notNull(),
  tags: json("tags").$type<string[]>(),
  
  // Version metadata
  versionNumber: int("version_number").notNull(),
  changeDescription: text("change_description"), // What changed in this version
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PostVersion = typeof postVersions.$inferSelect;
export type InsertPostVersion = typeof postVersions.$inferInsert;

/**
 * Post Backups - automatic backups of posts before deletion
 */
export const postBackups = mysqlTable("post_backups", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("post_id").notNull(),
  userId: int("user_id").notNull(),
  
  // Backup content
  platform: mysqlEnum("platform", ["linkedin", "twitter", "instagram", "facebook"]).notNull(),
  tone: varchar("tone", { length: 50 }).notNull(),
  rawInput: text("raw_input").notNull(),
  generatedContent: text("generated_content").notNull(),
  tags: json("tags").$type<string[]>(),
  
  // Backup metadata
  status: mysqlEnum("status", ["draft", "scheduled", "published", "failed"]).notNull(),
  scheduledFor: timestamp("scheduled_for"),
  publishedAt: timestamp("published_at"),
  
  // Backup reason
  backupReason: mysqlEnum("backup_reason", ["pre_deletion", "pre_edit", "scheduled", "manual"]).default("manual").notNull(),
  
  // Can be restored?
  isRestorable: boolean("is_restorable").default(true).notNull(),
  
  // Timestamps
  backedUpAt: timestamp("backed_up_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"), // When this backup will be deleted (e.g., 90 days)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PostBackup = typeof postBackups.$inferSelect;
export type InsertPostBackup = typeof postBackups.$inferInsert;

/**
 * Deleted Posts - soft delete tracking
 */
export const deletedPosts = mysqlTable("deleted_posts", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("post_id").notNull(),
  userId: int("user_id").notNull(),
  
  // Original post data
  platform: mysqlEnum("platform", ["linkedin", "twitter", "instagram", "facebook"]).notNull(),
  generatedContent: text("generated_content").notNull(),
  
  // Deletion metadata
  deletionReason: text("deletion_reason"),
  permanentlyDeleted: boolean("permanently_deleted").default(false).notNull(),
  
  // Timestamps
  deletedAt: timestamp("deleted_at").defaultNow().notNull(),
  permanentlyDeletedAt: timestamp("permanently_deleted_at"),
  canRestoreUntil: timestamp("can_restore_until"), // When post can no longer be restored
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DeletedPost = typeof deletedPosts.$inferSelect;
export type InsertDeletedPost = typeof deletedPosts.$inferInsert;

/**
 * Post Audit Log - tracks all changes to posts
 */
export const postAuditLog = mysqlTable("post_audit_log", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("post_id").notNull(),
  userId: int("user_id").notNull(),
  
  // Action details
  action: mysqlEnum("action", ["created", "edited", "deleted", "published", "scheduled", "restored", "backed_up"]).notNull(),
  actionDetails: json("action_details").$type<Record<string, any>>(), // Flexible field for action-specific data
  
  // Change tracking
  oldValue: text("old_value"), // Previous value (for edits)
  newValue: text("new_value"), // New value (for edits)
  
  // Metadata
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PostAuditLog = typeof postAuditLog.$inferSelect;
export type InsertPostAuditLog = typeof postAuditLog.$inferInsert;

/**
 * Backup Schedule - configuration for automatic backups
 */
export const backupSchedule = mysqlTable("backup_schedule", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(),
  
  // Backup settings
  enableAutoBackup: boolean("enable_auto_backup").default(true).notNull(),
  backupFrequency: mysqlEnum("backup_frequency", ["daily", "weekly", "monthly"]).default("daily").notNull(),
  
  // Retention settings
  retentionDays: int("retention_days").default(90).notNull(), // Keep backups for 90 days
  maxBackupsPerPost: int("max_backups_per_post").default(10).notNull(), // Keep max 10 backups per post
  
  // Last backup
  lastBackupAt: timestamp("last_backup_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type BackupSchedule = typeof backupSchedule.$inferSelect;
export type InsertBackupSchedule = typeof backupSchedule.$inferInsert;


/**
 * User Settings - personal account preferences
 */
export const userAccountSettings = mysqlTable("user_account_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(),
  
  // Account info
  displayName: varchar("display_name", { length: 255 }),
  bio: text("bio"),
  profileImage: varchar("profile_image", { length: 500 }),
  
  // Preferences
  language: varchar("language", { length: 10 }).default("no").notNull(), // Norwegian default
  timezone: varchar("timezone", { length: 50 }).default("Europe/Oslo").notNull(),
  theme: varchar("theme", { length: 20 }).default("light").notNull(), // light or dark
  
  // Account security
  twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
  lastPasswordChange: timestamp("last_password_change"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type UserAccountSetting = typeof userAccountSettings.$inferSelect;
export type InsertUserAccountSetting = typeof userAccountSettings.$inferInsert;

/**
 * Notification Preferences - notification settings
 */
export const notificationSettings = mysqlTable("notification_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(),
  
  // Email notifications
  emailNotifications: boolean("email_notifications").default(true).notNull(),
  emailFrequency: varchar("email_frequency", { length: 20 }).default("daily").notNull(), // immediate, daily, weekly, never
  
  // Push notifications
  pushNotifications: boolean("push_notifications").default(true).notNull(),
  pushFrequency: varchar("push_frequency", { length: 20 }).default("immediate").notNull(),
  
  // Notification types
  notifyOnNewTrends: boolean("notify_on_new_trends").default(true).notNull(),
  notifyOnScheduledPosts: boolean("notify_on_scheduled_posts").default(true).notNull(),
  notifyOnPublishedPosts: boolean("notify_on_published_posts").default(true).notNull(),
  notifyOnEngagementMilestones: boolean("notify_on_engagement_milestones").default(true).notNull(),
  notifyOnFailedPosts: boolean("notify_on_failed_posts").default(true).notNull(),
  notifyOnAnalyticsUpdates: boolean("notify_on_analytics_updates").default(true).notNull(),
  
  // Reports
  weeklyReportEnabled: boolean("weekly_report_enabled").default(true).notNull(),
  monthlyReportEnabled: boolean("monthly_report_enabled").default(true).notNull(),
  
  // Quiet hours
  quietHoursEnabled: boolean("quiet_hours_enabled").default(false).notNull(),
  quietHoursStart: varchar("quiet_hours_start", { length: 5 }).default("22:00").notNull(), // HH:mm
  quietHoursEnd: varchar("quiet_hours_end", { length: 5 }).default("08:00").notNull(),
  
  // Engagement threshold
  engagementThreshold: int("engagement_threshold").default(10).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type NotificationSetting = typeof notificationSettings.$inferSelect;
export type InsertNotificationSetting = typeof notificationSettings.$inferInsert;

/**
 * Platform Integrations - social media account connections
 */
export const platformIntegrationSettings = mysqlTable("platform_integration_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  
  // Platform info
  platform: varchar("platform", { length: 50 }).notNull(), // linkedin, twitter, instagram, facebook
  isConnected: boolean("is_connected").default(false).notNull(),
  
  // OAuth tokens (encrypted)
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  
  // Account info
  accountName: varchar("account_name", { length: 255 }),
  accountId: varchar("account_id", { length: 255 }),
  accountEmail: varchar("account_email", { length: 320 }),
  
  // Posting settings
  autoPost: boolean("auto_post").default(false).notNull(),
  autoSchedule: boolean("auto_schedule").default(false).notNull(),
  postingHours: text("posting_hours"), // JSON array of preferred hours
  
  // Sync info
  lastSyncedAt: timestamp("last_synced_at"),
  lastErrorMessage: text("last_error_message"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type PlatformIntegrationSetting = typeof platformIntegrationSettings.$inferSelect;
export type InsertPlatformIntegrationSetting = typeof platformIntegrationSettings.$inferInsert;

/**
 * User Content Preferences - content generation settings
 */
export const userContentPreferences = mysqlTable("user_content_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(),
  
  // Default settings
  defaultTone: varchar("default_tone", { length: 50 }).default("professional").notNull(),
  defaultPlatform: varchar("default_platform", { length: 50 }).default("linkedin").notNull(),
  
  // Content preferences
  contentLength: varchar("content_length", { length: 20 }).default("medium").notNull(), // short, medium, long
  hashtagStyle: varchar("hashtag_style", { length: 20 }).default("moderate").notNull(), // minimal, moderate, aggressive
  ctaStyle: varchar("cta_style", { length: 20 }).default("professional").notNull(), // casual, professional, urgent
  emojiUsage: varchar("emoji_usage", { length: 20 }).default("moderate").notNull(), // none, minimal, moderate, heavy
  
  // Auto-save
  autoSaveDrafts: boolean("auto_save_drafts").default(true).notNull(),
  
  // Analytics view preference
  analyticsView: varchar("analytics_view", { length: 20 }).default("overview").notNull(), // overview, detailed, minimal
  
  // Show onboarding
  showOnboarding: boolean("show_onboarding").default(true).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type UserContentPreference = typeof userContentPreferences.$inferSelect;
export type InsertUserContentPreference = typeof userContentPreferences.$inferInsert;

/**
 * Platform Integrations - stores OAuth tokens for social platforms
 */
export const platformIntegrations = mysqlTable("platform_integrations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  platform: mysqlEnum("platform", ["linkedin", "twitter", "instagram", "facebook"]).notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  scope: text("scope"),
  accountId: varchar("account_id", { length: 255 }),
  accountName: varchar("account_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type PlatformIntegration = typeof platformIntegrations.$inferSelect;
export type InsertPlatformIntegration = typeof platformIntegrations.$inferInsert;

/**
 * FAQ - Frequently Asked Questions
 */
export const faqs = mysqlTable("faqs", {
  id: int("id").autoincrement().primaryKey(),
  category: varchar("category", { length: 100 }).notNull(), // e.g., "Getting Started", "Payment", "Features", "Technical", "Account", "Privacy"
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  language: varchar("language", { length: 10 }).default("no").notNull(), // "no" for Norwegian, "en" for English
  order: int("order").default(0), // For ordering within category
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type FAQ = typeof faqs.$inferSelect;
export type InsertFAQ = typeof faqs.$inferInsert;


/**
 * Hashtag Suggestions - AI-generated hashtag recommendations
 * Stores hashtag suggestions for content to improve discoverability
 */
export const hashtagSuggestions = mysqlTable("hashtag_suggestions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  postId: int("post_id"),
  contentTitle: varchar("content_title", { length: 500 }).notNull(),
  contentExcerpt: text("content_excerpt").notNull(),
  platform: mysqlEnum("platform", ["linkedin", "twitter", "instagram", "facebook"]).notNull(),
  hashtags: text("hashtags").notNull(), // JSON array of suggested hashtags with scores
  trendingHashtags: text("trending_hashtags"), // JSON array of currently trending hashtags
  niche: varchar("niche", { length: 100 }), // User's industry/niche
  relevanceScore: int("relevance_score").default(0).notNull(), // 0-100 relevance score
  usageCount: int("usage_count").default(0).notNull(), // How many times these hashtags were used
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type HashtagSuggestion = typeof hashtagSuggestions.$inferSelect;
export type InsertHashtagSuggestion = typeof hashtagSuggestions.$inferInsert;

/**
 * Hashtag Performance - tracks how well hashtags perform
 * Used to improve future suggestions
 */
export const hashtagPerformance = mysqlTable("hashtag_performance", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  hashtag: varchar("hashtag", { length: 100 }).notNull(),
  platform: mysqlEnum("platform", ["linkedin", "twitter", "instagram", "facebook"]).notNull(),
  impressions: int("impressions").default(0).notNull(),
  clicks: int("clicks").default(0).notNull(),
  engagement: int("engagement").default(0).notNull(), // likes + comments + shares
  usageCount: int("usage_count").default(1).notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type HashtagPerformance = typeof hashtagPerformance.$inferSelect;
export type InsertHashtagPerformance = typeof hashtagPerformance.$inferInsert;

/**
 * Trending Hashtags - curated list of trending hashtags by platform
 * Updated regularly from external sources
 */
export const trendingHashtags = mysqlTable("trending_hashtags", {
  id: int("id").autoincrement().primaryKey(),
  hashtag: varchar("hashtag", { length: 100 }).notNull().unique(),
  platform: mysqlEnum("platform", ["linkedin", "twitter", "instagram", "facebook"]).notNull(),
  category: varchar("category", { length: 100 }), // "tech", "marketing", "business", etc.
  trendScore: int("trend_score").default(50).notNull(), // 0-100 popularity score
  region: varchar("region", { length: 10 }).default("NO").notNull(), // Country code
  volume: int("volume").default(0).notNull(), // Number of posts using this hashtag
  momentum: varchar("momentum", { length: 20 }).default("stable").notNull(), // "rising", "stable", "falling"
  expiresAt: timestamp("expires_at"), // When this trend becomes stale
  active: int("active").default(1).notNull(), // boolean as int
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type TrendingHashtag = typeof trendingHashtags.$inferSelect;
export type InsertTrendingHashtag = typeof trendingHashtags.$inferInsert;


/**
 * Activity Log - tracks all user actions for audit trail and security
 * Records login, logout, edits, deletions, and views
 */
export const activityLog = mysqlTable("activity_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  activityType: mysqlEnum("activity_type", ["login", "logout", "edit", "delete", "view", "download", "upload"]).notNull(),
  description: text("description"), // Human-readable description of the activity
  ipAddress: varchar("ip_address", { length: 45 }), // IPv4 or IPv6
  userAgent: text("user_agent"), // Browser/client info
  resourceType: varchar("resource_type", { length: 50 }), // "user", "post", "blog", "settings", etc.
  resourceId: int("resource_id"), // ID of the resource being acted upon
  success: int("success").default(1).notNull(), // boolean as int - was the action successful
  errorMessage: text("error_message"), // If failed, what was the error
  metadata: json("metadata").$type<Record<string, any>>(), // Additional context
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLog.$inferSelect;
export type InsertActivityLog = typeof activityLog.$inferInsert;

/**
 * Security Alerts - tracks suspicious activities and security events
 * Used to detect and alert on potential threats
 */
export const securityAlerts = mysqlTable("security_alerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  alertType: mysqlEnum("alert_type", [
    "failed_login",
    "multiple_failed_logins",
    "suspicious_location",
    "unusual_activity",
    "permission_change",
    "mass_deletion",
    "unauthorized_access",
  ]).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  description: text("description").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  failedAttempts: int("failed_attempts").default(1).notNull(), // For login failures
  timeWindow: int("time_window"), // Time window in minutes for repeated failures
  resolved: int("resolved").default(0).notNull(), // boolean as int - has admin reviewed this
  resolvedBy: int("resolved_by"), // Admin user ID who resolved it
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SecurityAlert = typeof securityAlerts.$inferSelect;
export type InsertSecurityAlert = typeof securityAlerts.$inferInsert;

/**
 * Failed Login Attempts - tracks failed login attempts for security
 * Used to detect brute force attacks
 */
export const failedLoginAttempts = mysqlTable("failed_login_attempts", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  userAgent: text("user_agent"),
  reason: varchar("reason", { length: 100 }), // "invalid_password", "user_not_found", etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Auto-cleanup: records older than 24 hours can be deleted
});

export type FailedLoginAttempt = typeof failedLoginAttempts.$inferSelect;
export type InsertFailedLoginAttempt = typeof failedLoginAttempts.$inferInsert;


/**
 * Support Tickets - customer support system
 * Allows users to submit support requests and track their status
 */
export const supportTickets = mysqlTable("support_tickets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description").notNull(),
  category: mysqlEnum("category", [
    "billing",
    "technical",
    "feature_request",
    "bug_report",
    "account",
    "other",
  ]).default("other").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  status: mysqlEnum("status", ["open", "in_progress", "waiting_customer", "resolved", "closed"]).default("open").notNull(),
  attachmentUrl: text("attachment_url"), // URL to uploaded attachment if any
  assignedTo: int("assigned_to"), // Admin user ID who is handling the ticket
  resolution: text("resolution"), // Admin's resolution notes
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = typeof supportTickets.$inferInsert;

/**
 * Support Ticket Replies - conversation history for support tickets
 */
export const supportTicketReplies = mysqlTable("support_ticket_replies", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticket_id").notNull(),
  userId: int("user_id").notNull(), // User or admin replying
  isAdminReply: tinyint("is_admin_reply").default(0).notNull(), // 0 = user, 1 = admin
  message: text("message").notNull(),
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SupportTicketReply = typeof supportTicketReplies.$inferSelect;
export type InsertSupportTicketReply = typeof supportTicketReplies.$inferInsert;


/**
 * User Usage Tracking - tracks monthly usage for each user
 * Reset monthly on subscription renewal date
 */
export const userUsageTracking = mysqlTable("user_usage_tracking", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  subscriptionId: int("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
  
  // Usage counters
  postsUsed: int("posts_used").default(0).notNull(),
  imagesUsed: int("images_used").default(0).notNull(),
  
  // Tracking period
  periodStartDate: timestamp("period_start_date").notNull(),
  periodEndDate: timestamp("period_end_date").notNull(),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  
  // Indexes for fast queries
}, (table) => ({
  userIdIdx: index("idx_user_usage_user_id").on(table.userId),
  subscriptionIdIdx: index("idx_user_usage_subscription_id").on(table.subscriptionId),
  periodIdx: index("idx_user_usage_period").on(table.periodStartDate, table.periodEndDate),
}));

export type UserUsageTracking = typeof userUsageTracking.$inferSelect;
export type InsertUserUsageTracking = typeof userUsageTracking.$inferInsert;



/**
 * Usage Overages - tracks when users exceed their plan limits
 * Used for billing additional charges
 */
export const usageOverages = mysqlTable("usage_overages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  subscriptionId: int("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
  
  // Overage details
  usageType: varchar("usage_type", { length: 50 }).notNull(), // "posts", "images", etc.
  overageAmount: int("overage_amount").notNull(), // How much over the limit
  chargePerUnit: int("charge_per_unit").notNull(), // Price per unit in øre
  totalCharge: int("total_charge").notNull(), // Total overage charge in øre
  
  // Status
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, billed, paid
  
  // Dates
  occurredAt: timestamp("occurred_at").notNull(),
  billedAt: timestamp("billed_at"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_overage_user_id").on(table.userId),
  statusIdx: index("idx_overage_status").on(table.status),
}));

export type UsageOverage = typeof usageOverages.$inferSelect;
export type InsertUsageOverage = typeof usageOverages.$inferInsert;