import { z } from "zod";

export const crawledPageSchema = z.object({
  url: z.string().url().max(1_000),
  title: z.string().max(500),
  description: z.string().max(1_000),
  text: z.string().min(1).max(30_000),
  contentType: z.string().max(120),
  status: z.number().int().min(100).max(599),
  suspiciousPromptText: z.boolean(),
}).strict();

export const crawlResponseSchema = z.object({
  rootUrl: z.string().url().max(1_000),
  pages: z.array(crawledPageSchema).min(1).max(8),
  colors: z.array(z.string().regex(/^#[0-9A-F]{6}$/)).max(8),
  fonts: z.array(z.string().min(1).max(100)).max(6),
  logoUrl: z.string().url().max(1_000).nullable(),
  warnings: z.array(z.string().min(1).max(200)).max(30),
  fetchedAt: z.string().datetime({ offset: true }),
}).strict();

export type CrawlResponse = z.infer<typeof crawlResponseSchema>;

const asArray = (value: unknown): unknown =>
  Array.isArray(value) ? value : typeof value === "string" && value.trim() ? [value] : [];

const textList = (maxItems = 40, maxLength = 300) =>
  z.preprocess(asArray, z.array(z.string().trim().min(1).max(maxLength)).max(maxItems).default([]));

const platformField = z.preprocess((value) => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "x" || normalized === "twitter/x") return "twitter";
  return ["linkedin", "instagram", "facebook", "twitter"].includes(normalized)
    ? normalized
    : undefined;
}, z.enum(["linkedin", "instagram", "facebook", "twitter"]).optional());

export const brandAnalysisDraftSchema = z.object({
  companyName: z.string().trim().min(1).max(255),
  industry: z.string().trim().max(255).default(""),
  summary: z.string().trim().max(2_000).default(""),
  offers: textList(),
  audiences: textList(),
  customerProblems: textList(),
  differentiators: textList(),
  tonePersonality: textList(),
  writingStyle: z.string().trim().max(1_500).default(""),
  preferredWords: textList(),
  avoidWords: textList(),
  callsToAction: textList(),
  contentPillars: textList(12, 200),
  contentIdeas: z.preprocess(asArray, z.array(z.object({
    title: z.string().trim().min(1).max(220),
    angle: z.string().trim().max(500).default(""),
    pillar: z.string().trim().max(200).default(""),
    platform: platformField,
  }).strict()).min(1).max(40).default([])),
  facts: z.preprocess(asArray, z.array(z.object({
    statement: z.string().trim().min(1).max(500),
    sourceId: z.string().regex(/^S[1-8]$/),
    evidenceQuote: z.string().trim().min(20).max(500),
  }).strict()).max(40).default([])),
}).strict();

export type BrandAnalysisDraft = z.infer<typeof brandAnalysisDraftSchema>;
