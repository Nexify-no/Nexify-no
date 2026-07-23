/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// First-run wizard ("Kom i gang", client/src/pages/Onboarding.tsx):
//   analyzeWebsite  — reads the user's own website and extracts a brand profile
//   confirmProfile  — persists the confirmed profile (user_interests + default preset)
//   refinePost      — rewrites a draft post from a free-text instruction
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

const TONE_KEYS = ["professional", "casual", "friendly", "formal", "humorous"] as const;
type ToneKey = (typeof TONE_KEYS)[number];

const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 600_000;
const MAX_PROMPT_CHARS = 7_000;
const MAX_REDIRECTS = 4;
const UA =
  "Mozilla/5.0 (compatible; PennaBot/1.0; +https://penna.no) AppleWebKit/537.36";

/**
 * SSRF guard for user-supplied URLs: reject loopback/link-local/private hosts by
 * name and by IP literal. Hostname-level only (no DNS resolution) — same risk
 * level the Competitor Radar already accepts, but stricter than it.
 */
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan")) return true;
  // IPv6 literals (URL hostname keeps brackets off in Node's URL#hostname)
  if (h.includes(":")) return true; // block all IPv6 literals outright
  // IPv4 literal?
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }
  return false;
}

/** Very small HTML→text: keep <title>, meta description and visible copy. */
function htmlToText(html: string): { title: string; description: string; text: string } {
  const pick = (re: RegExp) => {
    const m = html.match(re);
    return m ? m[1].trim() : "";
  };
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const description =
    pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
    pick(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i) ||
    pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i);
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return { title, description, text: stripped };
}

/** Extract the first balanced {...} JSON object from LLM output (fenced or not). */
function extractJsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(raw.slice(start, i + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/**
 * Fetch a public page with a timeout, re-checking the host on EVERY redirect
 * hop (automatic `redirect: "follow"` would let a public host 302 straight to
 * a private address past the SSRF guard), and reading at most MAX_HTML_BYTES
 * off the wire instead of buffering an unbounded body into memory.
 */
async function fetchPublicHtml(initial: URL): Promise<string> {
  let current = initial;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (isBlockedHost(current.hostname)) throw new Error("blocked host");
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(current.toString(), {
        signal: ctrl.signal,
        redirect: "manual",
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) throw new Error("redirect without location");
        current = new URL(loc, current);
        if (current.protocol !== "http:" && current.protocol !== "https:") {
          throw new Error("non-http redirect");
        }
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!res.body) return (await res.text()).slice(0, MAX_HTML_BYTES);
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8", { fatal: false });
      let out = "";
      while (out.length < MAX_HTML_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        out += decoder.decode(value, { stream: true });
      }
      void reader.cancel().catch(() => undefined);
      return out.slice(0, MAX_HTML_BYTES);
    } finally {
      clearTimeout(t);
    }
  }
  throw new Error("too many redirects");
}

// Runs BEFORE the user has necessarily verified their e-mail (it is the second
// screen of the first-run wizard, right after signup), so it can't use
// aiProcedure's verified-email gate without dead-ending every fresh e-mail
// signup. It keeps aiProcedure's cost backstop (per-user AI rate limit) and is
// a single low-max_tokens text call over a size-capped page.
const onboardingAiProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const { enforceAiRateLimit } = await import("../_core/aiRateLimit");
  await enforceAiRateLimit(ctx.user.id);
  return next();
});

export const onboardingRouter = router({
  /**
   * Screen 2 ("Vi gjør jobben"): fetch the user's website and extract a brand
   * profile suggestion. Pure suggestion — nothing is persisted until the user
   * confirms on screen 3 (confirmProfile).
   */
  analyzeWebsite: onboardingAiProcedure
    .input(z.object({ url: z.string().min(3).max(500) }))
    .mutation(async ({ input }) => {
      const { normalizeUrl } = await import("../services/radarService");
      const normalized = normalizeUrl(input.url);
      if (!normalized) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Det ligner ikke på en nettadresse. Prøv f.eks. dinbedrift.no",
        });
      }
      const target = new URL(normalized);
      if (isBlockedHost(target.hostname)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Denne adressen kan ikke leses. Prøv den offentlige nettsiden din, f.eks. dinbedrift.no",
        });
      }

      let html = "";
      try {
        html = await fetchPublicHtml(target);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Vi fikk ikke lest nettsiden akkurat nå. Sjekk at adressen stemmer, eller hopp over og fyll inn selv.",
        });
      }

      const page = htmlToText(html);
      const corpus = [
        `URL: ${target.hostname}`,
        page.title && `Tittel: ${page.title}`,
        page.description && `Beskrivelse: ${page.description}`,
        `Innhold: ${page.text}`,
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, MAX_PROMPT_CHARS);

      if (page.text.length < 40) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Nettsiden hadde for lite tekst til å lese noe ut av. Hopp over og fyll inn selv — det tar under ett minutt.",
        });
      }

      const { invokeLLM } = await import("../_core/llm");
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "Du analyserer nettsiden til en liten bedrift og lager en merkevareprofil for sosiale medier. " +
              "Svar KUN med ett JSON-objekt med feltene: " +
              '"companyName" (bedriftens navn, kort), ' +
              '"industry" (bransje i 2–5 ord på norsk), ' +
              '"toneKey" (nøyaktig én av: professional, casual, friendly, formal, humorous), ' +
              '"toneLabel" (tonefallet beskrevet i 2–4 hverdagslige norske ord, f.eks. "Vennlig og jordnær"), ' +
              '"audience" (målgruppen i én kort norsk setning, maks 20 ord), ' +
              '"topics" (3–5 konkrete temaer bedriften bør poste om, hver på 2–6 ord, norsk), ' +
              '"language" ("no" eller "en" — språket på nettsiden). ' +
              "Skriv enkelt og menneskelig, uten faguttrykk.",
          },
          { role: "user", content: corpus },
        ],
        maxTokens: 700,
        responseFormat: { type: "json_object" },
      });

      const rawContent = result.choices[0]?.message?.content;
      const text =
        typeof rawContent === "string"
          ? rawContent
          : (rawContent ?? [])
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("");
      const parsed = extractJsonObject(text);
      if (!parsed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Analysen stoppet opp. Prøv igjen — det tar bare noen sekunder.",
        });
      }

      const toneKeyRaw = str(parsed.toneKey, 20).toLowerCase();
      const toneKey: ToneKey = (TONE_KEYS as readonly string[]).includes(toneKeyRaw)
        ? (toneKeyRaw as ToneKey)
        : "friendly";
      const topics = Array.isArray(parsed.topics)
        ? parsed.topics
            .filter((v): v is string => typeof v === "string")
            .map((v) => v.trim().slice(0, 60))
            .filter(Boolean)
            .slice(0, 6)
        : [];
      const language = parsed.language === "en" ? ("en" as const) : ("no" as const);

      return {
        companyName: str(parsed.companyName, 100) || target.hostname.replace(/^www\./, ""),
        industry: str(parsed.industry, 100),
        toneKey,
        toneLabel: str(parsed.toneLabel, 60) || "Vennlig og profesjonell",
        audience: str(parsed.audience, 280),
        topics,
        language,
        sourceUrl: target.toString(),
      };
    }),

  /**
   * Screen 3 ("Stemmer dette?"): persist the confirmed profile.
   * - user_interests: industry + topics (read by hashtag suggestions today)
   * - generation_presets: a default "Merkevareprofil" preset, so Generate
   *   pre-fills tone/audience/language from the wizard from day one.
   */
  confirmProfile: protectedProcedure
    .input(
      z.object({
        companyName: z.string().max(100).optional(),
        industry: z.string().min(1).max(100),
        toneKey: z.enum(TONE_KEYS),
        toneLabel: z.string().max(60).optional(),
        audience: z.string().min(1).max(280),
        topics: z.array(z.string().min(1).max(60)).max(10).default([]),
        language: z.enum(["no", "en"]).default("no"),
        websiteUrl: z.string().trim().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { createOrUpdateUserInterests, createPreset, getUserPresets, deletePreset } =
        await import("../db");

      await createOrUpdateUserInterests(ctx.user.id, {
        industry: input.industry,
        topics: JSON.stringify(input.topics),
        platforms: JSON.stringify(["linkedin"]),
      });

      // Re-running the wizard must not stack duplicate presets: replace by name.
      // createPreset clears any previous default when isDefault is set.
      const PRESET_NAME = "Merkevareprofil";
      const existing = await getUserPresets(ctx.user.id);
      for (const p of existing.filter((p) => p.name === PRESET_NAME)) {
        await deletePreset(p.id, ctx.user.id);
      }
      await createPreset({
        userId: ctx.user.id,
        name: PRESET_NAME,
        platform: "linkedin",
        tone: input.toneKey,
        length: "medium",
        keywords: input.topics.slice(0, 20),
        targetAudience: input.audience,
        goal: "engagement",
        emojiUsage: "minimal",
        hashtagCount: 3,
        useBullets: false,
        closingQuestion: true,
        language: input.language,
        isDefault: true,
      });

      // M5: seed the permanent Merkehjerne so it's reused across all AI tools
      // from day one. Never overwrites an existing profile.
      if (input.websiteUrl) {
        const { seedBrandProfileFromOnboarding } = await import("../db");
        await seedBrandProfileFromOnboarding(ctx.user.id, {
          websiteUrl: input.websiteUrl,
          companyName: input.companyName,
          industry: input.industry,
          audience: input.audience,
          toneLabel: input.toneLabel,
          topics: input.topics,
        });
      }

      return { success: true };
    }),

  /**
   * Screen 5 ("Finjuster"): rewrite a draft post from a plain-language
   * instruction ("kortere", "nevn sommertilbudet", ...). Owner-scoped in-query.
   * Uses onboardingAiProcedure (not aiProcedure) for the same reason as
   * analyzeWebsite: the wizard runs right after signup, before e-mail
   * verification — the rate-limit backstop still applies.
   */
  refinePost: onboardingAiProcedure
    .input(
      z.object({
        postId: z.number().int().positive(),
        instruction: z.string().min(2).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { posts } = await import("../../drizzle/schema");
      const { and, eq } = await import("drizzle-orm");

      const rows = await db
        .select()
        .from(posts)
        .where(and(eq(posts.id, input.postId), eq(posts.userId, ctx.user.id)))
        .limit(1);
      const post = rows[0];
      if (!post) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke innlegget. Prøv igjen." });
      }

      const { invokeLLM } = await import("../_core/llm");
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              `Du forbedrer et utkast til et ${post.platform}-innlegg for en liten bedrift. ` +
              "Følg brukerens instruks nøyaktig, behold språket og omtrent samme lengde med mindre instruksen sier noe annet, " +
              "og behold det som fungerer. Svar KUN med den nye innleggsteksten — ingen forklaring, ingen anførselstegn rundt.",
          },
          {
            role: "user",
            content: `Utkast:\n${post.generatedContent}\n\nInstruks: ${input.instruction}`,
          },
        ],
        maxTokens: 900,
      });

      const rawContent = result.choices[0]?.message?.content;
      const rewritten = (
        typeof rawContent === "string"
          ? rawContent
          : (rawContent ?? [])
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("")
      ).trim();
      if (!rewritten) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Omskrivingen stoppet opp. Prøv igjen, eller formuler endringen litt annerledes.",
        });
      }

      await db
        .update(posts)
        .set({ generatedContent: rewritten })
        .where(and(eq(posts.id, input.postId), eq(posts.userId, ctx.user.id)));

      return { content: rewritten };
    }),
});
