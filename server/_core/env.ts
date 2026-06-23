/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "https://api.openai.com",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? process.env.OPENAI_API_KEY ?? "",
  huggingfaceApiKey: process.env.HUGGINGFACE_API_KEY ?? "",

  // ── Text models (two-tier; both default to the cheap mini model) ──
  // Quality tier: main post generation + "enhance idea". Set CONTENT_MODEL=gpt-4o
  // (or a strong Gemini/Claude model via an OpenAI-compatible BUILT_IN_FORGE_API_URL)
  // for higher Norwegian quality.
  contentModel: process.env.CONTENT_MODEL ?? "gpt-4o-mini",
  // Light tier: auxiliary tasks (hashtags, trend analysis, quick improve, voice summary).
  llmModel: process.env.LLM_MODEL ?? "gpt-4o-mini",

  // ── Image generation ──
  // "openai" (DALL·E / gpt-image) or "fal" (fal.ai — FLUX). Defaults to openai so
  // nothing changes until you opt in. For best quality-per-cost set:
  //   IMAGE_PROVIDER=fal  IMAGE_MODEL=fal-ai/flux/dev  FAL_API_KEY=...
  imageProvider: (process.env.IMAGE_PROVIDER ?? "openai") as "openai" | "fal",
  imageModel: process.env.IMAGE_MODEL ?? "", // empty → per-provider default
  falApiKey: process.env.FAL_API_KEY ?? "",
};