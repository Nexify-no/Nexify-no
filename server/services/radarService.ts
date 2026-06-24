/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Competitor Radar service — monitors competitors via PUBLIC sources ONLY:
 *   - Website RSS / Atom feeds (auto-detected from <link rel="alternate"> + common paths)
 *   - YouTube channel RSS (derived from a channel id)
 *   - Google News RSS search for the competitor name
 *
 * NEVER scrapes LinkedIn / personal / private data. Runtime fetching happens on
 * Render (outbound allowed). Each external call has an AbortController timeout and
 * a browser-like User-Agent. Per-source failures are isolated with Promise.allSettled.
 */
import { createHash } from "crypto";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 8000;

export type SourceType = "rss" | "atom" | "youtube" | "google_news";

export interface DetectedSource {
  type: SourceType;
  url: string;
}

export interface ParsedFeedItem {
  title: string;
  link?: string;
  publishedAt?: Date;
  summary?: string;
}

export interface SummaryStats {
  itemCount: number;
  lastPublishedAt: Date | null;
  postsPerWeek: number;
}

/** fetch with timeout + browser-like UA. Returns the Response (caller checks ok). */
async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  ms = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
        ...(opts.headers || {}),
      },
      redirect: "follow",
    });
  } finally {
    clearTimeout(t);
  }
}

/** Normalize a user-supplied website value into a valid absolute URL (https default). */
export function normalizeUrl(input: string): string | null {
  if (!input) return null;
  let raw = input.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function looksLikeXml(text: string, contentType: string | null): boolean {
  if (contentType && /(xml|rss|atom)/i.test(contentType)) return true;
  const head = text.slice(0, 600).toLowerCase();
  return head.includes("<rss") || head.includes("<feed") || head.includes("<?xml");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => {
      try { return String.fromCodePoint(parseInt(h, 16)); } catch { return _m; }
    })
    .replace(/&#(\d+);/g, (_m, d) => {
      try { return String.fromCodePoint(parseInt(d, 10)); } catch { return _m; }
    });
}

function stripHtml(s: string): string {
  // Decode entities FIRST so entity-encoded markup (e.g. Google News descriptions
  // like &lt;a href=...&gt;) becomes real tags, THEN strip tags, then decode again.
  const decoded = decodeEntities(s || "");
  const noTags = decoded.replace(/<[^>]+>/g, " ");
  return decodeEntities(noTags).replace(/\s+/g, " ").trim();
}

function firstMatch(block: string, re: RegExp): string | undefined {
  const m = block.match(re);
  return m ? m[1] : undefined;
}

/**
 * Parse BOTH RSS <item> and Atom <entry>. Extracts title, link, published date and
 * a short summary. Mirrors the lightweight regex approach used in trendSources.ts.
 */
export function parseFeed(xml: string, limit = 40): ParsedFeedItem[] {
  const items: ParsedFeedItem[] = [];
  if (!xml) return items;

  const titleRe = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i;
  const descRe = /<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i;
  const summaryRe = /<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i;
  const contentRe = /<content[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content>/i;
  const pubDateRe = /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i;
  const updatedRe = /<updated[^>]*>([\s\S]*?)<\/updated>/i;
  const publishedRe = /<published[^>]*>([\s\S]*?)<\/published>/i;
  const dcDateRe = /<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i;
  // RSS: <link>URL</link>. Atom: <link href="URL" .../> (prefer rel="alternate").
  const rssLinkRe = /<link[^>]*>(?:<!\[CDATA\[)?\s*(https?:\/\/[\s\S]*?)\s*(?:\]\]>)?<\/link>/i;
  const atomAltLinkRe = /<link[^>]*\brel=["']alternate["'][^>]*\bhref=["']([^"']+)["']/i;
  const atomAnyLinkRe = /<link[^>]*\bhref=["']([^"']+)["']/i;

  const blockRe = /<(item|entry)\b[\s\S]*?<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(xml)) && items.length < limit) {
    const block = m[0];
    const rawTitle = firstMatch(block, titleRe);
    if (!rawTitle) continue;
    const title = stripHtml(rawTitle).slice(0, 480);
    if (!title) continue;

    let link =
      firstMatch(block, atomAltLinkRe) ||
      firstMatch(block, rssLinkRe) ||
      firstMatch(block, atomAnyLinkRe);
    if (link) link = decodeEntities(link.trim());

    const dateStr =
      firstMatch(block, pubDateRe) ||
      firstMatch(block, publishedRe) ||
      firstMatch(block, updatedRe) ||
      firstMatch(block, dcDateRe);
    let publishedAt: Date | undefined;
    if (dateStr) {
      const d = new Date(dateStr.trim());
      if (!isNaN(d.getTime())) publishedAt = d;
    }

    const rawSummary =
      firstMatch(block, descRe) ||
      firstMatch(block, summaryRe) ||
      firstMatch(block, contentRe);
    const summary = rawSummary ? stripHtml(rawSummary).slice(0, 800) : undefined;

    items.push({ title, link, publishedAt, summary });
  }
  return items;
}

/** Extract a YouTube channel id from a URL/HTML, if the website points at YouTube. */
async function deriveYoutubeRss(websiteUrl: string): Promise<string | null> {
  let host = "";
  try {
    host = new URL(websiteUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!/(^|\.)youtube\.com$/.test(host) && host !== "youtu.be") return null;

  // Direct channel id form: /channel/UCxxxx
  const direct = websiteUrl.match(/\/channel\/(UC[\w-]{20,})/);
  if (direct) return `https://www.youtube.com/feeds/videos.xml?channel_id=${direct[1]}`;

  // Otherwise fetch the page and look for the canonical channel id.
  try {
    const res = await fetchWithTimeout(websiteUrl);
    if (!res.ok) return null;
    const html = await res.text();
    const byMeta =
      html.match(/"channelId":"(UC[\w-]{20,})"/) ||
      html.match(/channel_id=(UC[\w-]{20,})/) ||
      html.match(/\/channel\/(UC[\w-]{20,})/);
    if (byMeta) return `https://www.youtube.com/feeds/videos.xml?channel_id=${byMeta[1]}`;
  } catch {
    /* ignore */
  }
  return null;
}

/** Resolve a possibly-relative feed href against the page URL. */
function absolutize(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

/**
 * Detect public sources for a competitor.
 *  - Parse homepage <link rel="alternate" type="application/(rss|atom)+xml"> tags.
 *  - Probe common feed paths (/feed, /rss, /feed.xml, /atom.xml, /rss.xml).
 *  - If the site is a YouTube channel, derive the channel RSS feed.
 *  - ALWAYS add a Google News RSS source for the competitor name.
 * De-duplicates URLs. Each step is best-effort and never throws.
 */
export async function detectSources(website: string | null | undefined, name: string): Promise<DetectedSource[]> {
  const sources: DetectedSource[] = [];
  const seen = new Set<string>();
  const push = (type: SourceType, url: string) => {
    const key = url.trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    sources.push({ type, url: key });
  };

  const normalized = website ? normalizeUrl(website) : null;

  if (normalized) {
    // YouTube channel feed (if applicable).
    try {
      const yt = await deriveYoutubeRss(normalized);
      if (yt) push("youtube", yt);
    } catch { /* ignore */ }

    // Homepage <link rel="alternate"> discovery.
    let homepageHtml = "";
    try {
      const res = await fetchWithTimeout(normalized);
      if (res.ok) homepageHtml = await res.text();
    } catch { /* ignore */ }

    if (homepageHtml) {
      const linkTagRe = /<link\b[^>]*>/gi;
      let lm: RegExpExecArray | null;
      while ((lm = linkTagRe.exec(homepageHtml))) {
        const tag = lm[0];
        if (!/rel=["']alternate["']/i.test(tag)) continue;
        const typeM = tag.match(/type=["']application\/(rss|atom)\+xml["']/i);
        if (!typeM) continue;
        const hrefM = tag.match(/href=["']([^"']+)["']/i);
        if (!hrefM) continue;
        const abs = absolutize(decodeEntities(hrefM[1]), normalized);
        if (abs) push(typeM[1].toLowerCase() === "atom" ? "atom" : "rss", abs);
      }
    }

    // Probe common feed paths only when nothing was discovered from the page.
    const hasFeed = sources.some((s) => s.type === "rss" || s.type === "atom");
    if (!hasFeed) {
      const paths = [
        "/feed", "/feed/", "/rss", "/rss/", "/feed.xml", "/atom.xml", "/rss.xml",
        "/index.xml", "/blog/feed", "/blog/feed/", "/blog/rss", "/news/feed",
        "/blogs/news.atom", "/blog.atom", "/blogs/nyheter.atom", "/blog?format=rss",
      ];
      const probes = await Promise.allSettled(
        paths.map(async (p) => {
          const probeUrl = absolutize(p, normalized);
          if (!probeUrl) return null;
          const res = await fetchWithTimeout(probeUrl);
          if (!res.ok) return null;
          const ct = res.headers.get("content-type");
          const text = await res.text();
          if (looksLikeXml(text, ct)) {
            const isAtom = text.slice(0, 600).toLowerCase().includes("<feed");
            return { type: (isAtom ? "atom" : "rss") as SourceType, url: probeUrl };
          }
          return null;
        }),
      );
      for (const r of probes) {
        if (r.status === "fulfilled" && r.value) push(r.value.type, r.value.url);
      }
    }
  }

  // ALWAYS add Google News RSS for the competitor name (Norwegian locale).
  const gnews = `https://news.google.com/rss/search?q=${encodeURIComponent(name)}&hl=no&gl=NO&ceid=NO:no`;
  push("google_news", gnews);

  return sources;
}

/** sha256(url || title) — stable dedupe key for a content item. */
export function contentHash(url: string | undefined, title: string): string {
  return createHash("sha256").update(`${url || ""}||${title}`).digest("hex");
}

function isDuplicateError(err: unknown): boolean {
  const msg = (err as { message?: string })?.message || String(err);
  const code = (err as { code?: string })?.code || "";
  return /duplicate|ER_DUP_ENTRY|uq_cc|content_hash/i.test(msg) || code === "ER_DUP_ENTRY";
}

/**
 * Sync one competitor: load its sources, fetch+parse each (allSettled), and insert
 * new content items (deduped by content_hash via try-insert/catch-duplicate).
 * Updates each source's last_fetch. All writes are awaited.
 */
export async function syncCompetitor(competitorId: number): Promise<{ inserted: number; sources: number }> {
  const { getDb } = await import("../db");
  const { competitorSources, competitorContent } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const srcs = await db
    .select()
    .from(competitorSources)
    .where(eq(competitorSources.competitorId, competitorId));

  if (srcs.length === 0) return { inserted: 0, sources: 0 };

  const results = await Promise.allSettled(
    srcs.map(async (src) => {
      const res = await fetchWithTimeout(src.url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${src.url}`);
      const xml = await res.text();
      const items = parseFeed(xml);
      return { src, items };
    }),
  );

  let inserted = 0;
  for (const r of results) {
    if (r.status !== "fulfilled") {
      console.warn("[radar] source fetch failed:", (r.reason as Error)?.message || r.reason);
      continue;
    }
    const { src, items } = r.value;
    for (const item of items) {
      const hash = contentHash(item.link, item.title);
      try {
        await db.insert(competitorContent).values({
          competitorId,
          sourceId: src.id,
          title: item.title.slice(0, 480),
          url: item.link ? item.link.slice(0, 990) : null,
          publishedAt: item.publishedAt ?? null,
          summary: item.summary ?? null,
          contentHash: hash,
        });
        inserted++;
      } catch (err) {
        if (!isDuplicateError(err)) {
          console.warn("[radar] insert content failed:", (err as Error)?.message || err);
        }
      }
    }
    try {
      await db
        .update(competitorSources)
        .set({ lastFetch: new Date() })
        .where(eq(competitorSources.id, src.id));
    } catch (err) {
      console.warn("[radar] update last_fetch failed:", (err as Error)?.message || err);
    }
  }

  return { inserted, sources: srcs.length };
}

const STOPWORDS = new Set<string>([
  // English
  "the", "and", "for", "are", "was", "with", "from", "this", "that", "have", "has",
  "you", "your", "our", "their", "they", "them", "but", "not", "can", "will", "what",
  "how", "why", "who", "when", "where", "all", "out", "new", "now", "get", "got",
  "one", "two", "more", "most", "some", "any", "his", "her", "its", "his", "she", "him",
  "about", "into", "over", "after", "before", "than", "then", "there", "here", "been",
  "being", "were", "would", "could", "should", "which", "while", "also", "just", "like",
  "make", "made", "best", "top", "via", "per", "use", "used", "way", "day", "week",
  // Norwegian
  "og", "i", "jeg", "det", "at", "en", "et", "den", "til", "er", "som", "på", "de",
  "med", "han", "av", "ikke", "der", "så", "var", "meg", "seg", "men", "ett", "har",
  "om", "vi", "min", "mitt", "ha", "hadde", "hun", "nå", "over", "da", "ved", "fra",
  "du", "ut", "sin", "dem", "oss", "opp", "man", "kan", "hans", "hvor", "eller", "hva",
  "skal", "selv", "her", "alle", "vil", "ble", "deg", "no", "noe", "noen", "være",
  "etter", "mot", "uten", "kun", "for", "denne", "dette", "disse", "hvordan", "hvorfor",
  "mer", "mest", "ny", "nye", "slik", "blir", "bli", "andre", "andre", "samt", "enn",
]);
["font","href","target","class","div","span","style","nbsp","amp","quot","apos","http","https","www","html","head","body","src","alt","img","rel","nofollow","blank","color","ul","li","br","strong","table","t_blank","news","google","com","net","org"].forEach((w) => STOPWORDS.add(w));

function tokenize(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-zà-öø-ÿæøå0-9\s-]/gi, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, ""))
    .filter((w) => w.length >= 3 && w.length <= 40 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

/**
 * Analyze a competitor's recent content into topics, and compute content GAPS by
 * comparing competitor topics against the user's OWN recent posts' topics.
 * Clears old topics/gaps for the competitor before re-inserting.
 */
export async function analyzeCompetitor(competitorId: number): Promise<{ topics: number; gaps: number }> {
  const { getDb } = await import("../db");
  const { competitorContent, competitorTopics, competitorGaps, competitors, posts } =
    await import("../../drizzle/schema");
  const { eq, gte, and, desc } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const content = await db
    .select()
    .from(competitorContent)
    .where(eq(competitorContent.competitorId, competitorId))
    .orderBy(desc(competitorContent.createdAt))
    .limit(200);

  // Term frequency across titles + summaries, weighted by recency.
  const now = Date.now();
  const freq = new Map<string, number>();
  for (const c of content) {
    const ageDays = c.publishedAt ? (now - new Date(c.publishedAt).getTime()) / 86400000 : 60;
    const recencyWeight = Math.max(0.3, 1 - ageDays / 120);
    const tokens = [...tokenize(c.title), ...tokenize(c.summary || "")];
    for (const tok of tokens) {
      freq.set(tok, (freq.get(tok) || 0) + recencyWeight);
    }
  }

  const ranked = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]);
  const freqTopics = ranked
    .slice(0, 12)
    .map(([topic, score]) => ({ topic, score: Math.round(score * 100) / 100 }));

  // Owning user + their own topic tokens (for gap detection).
  const [comp] = await db
    .select()
    .from(competitors)
    .where(eq(competitors.id, competitorId))
    .limit(1);

  const userTopics = new Set<string>();
  if (comp) {
    const userContentSince = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const userPosts = await db
      .select()
      .from(posts)
      .where(and(eq(posts.userId, comp.userId), gte(posts.createdAt, userContentSince)))
      .limit(300);
    for (const p of userPosts) {
      for (const tok of [...tokenize(p.rawInput || ""), ...tokenize(p.generatedContent || "")]) {
        userTopics.add(tok);
      }
    }
  }

  // Real AI analysis from clean article titles (falls back to word frequency).
  const titles = content.map((c) => c.title).filter(Boolean).slice(0, 40);
  let finalTopics: Array<{ topic: string; score: number }> = freqTopics;
  let aiRecommendations = "";
  if (titles.length > 0) {
    try {
      const { invokeLLM } = await import("../_core/llm");
      const prompt =
        `Her er artikkeltitler fra en konkurrent:\n` +
        titles.map((t) => `- ${t}`).join("\n") +
        `\n\nReturner KUN gyldig JSON (ingen markdown, ingen forklaring): ` +
        `{"topics":["6-8 korte konkrete temaer (1-3 ord) pa norsk"],` +
        `"recommendations":["3-4 konkrete innholdsforslag til brukeren, hver som en kort setning pa norsk"]}`;
      const r: any = await invokeLLM({
        messages: [
          { role: "system", content: "Du er en innholdsstrateg. Svar kun med gyldig JSON." },
          { role: "user", content: prompt },
        ],
      });
      const raw = String(r?.choices?.[0]?.message?.content || "").replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.topics) && parsed.topics.length) {
        finalTopics = parsed.topics
          .filter((x: any) => typeof x === "string" && x.trim())
          .slice(0, 12)
          .map((t: string, i: number) => ({ topic: t.trim(), score: Math.round((12 - i) * 10) / 10 }));
      }
      if (Array.isArray(parsed.recommendations)) {
        aiRecommendations = parsed.recommendations.filter((x: any) => typeof x === "string").join("\n");
      } else if (typeof parsed.recommendations === "string") {
        aiRecommendations = parsed.recommendations;
      }
    } catch (e) {
      console.warn("[radar] AI analysis failed, using frequency topics:", (e as Error)?.message || e);
    }
  }

  // Re-write topics (clear then insert).
  await db.delete(competitorTopics).where(eq(competitorTopics.competitorId, competitorId));
  for (const t of finalTopics) {
    await db.insert(competitorTopics).values({
      competitorId,
      topic: t.topic.slice(0, 118),
      score: t.score,
    });
  }

  // Store the AI recommendations summary on the competitor (best-effort).
  try {
    await db
      .update(competitors)
      .set({ aiSummary: aiRecommendations || null })
      .where(eq(competitors.id, competitorId));
  } catch (e) {
    console.warn("[radar] could not store ai_summary:", (e as Error)?.message || e);
  }

  // Gaps: topics whose tokens don't overlap with the user's own topics.
  const gaps = finalTopics.filter((t) => {
    const toks = tokenize(t.topic);
    return toks.length > 0 && !toks.some((tk) => userTopics.has(tk));
  });

  await db.delete(competitorGaps).where(eq(competitorGaps.competitorId, competitorId));
  for (const g of gaps) {
    await db.insert(competitorGaps).values({
      competitorId,
      topic: g.topic.slice(0, 118),
      opportunityScore: g.score,
    });
  }

  return { topics: finalTopics.length, gaps: gaps.length };
}

/** Quick activity stats for a competitor over the last 30 days. */
export async function summaryStats(competitorId: number): Promise<SummaryStats> {
  const { getDb } = await import("../db");
  const { competitorContent } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select()
    .from(competitorContent)
    .where(eq(competitorContent.competitorId, competitorId));

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let itemCount = 0;
  let lastPublishedAt: Date | null = null;
  for (const r of rows) {
    const when = r.publishedAt ? new Date(r.publishedAt) : r.createdAt ? new Date(r.createdAt) : null;
    if (when) {
      if (when.getTime() >= thirtyDaysAgo) itemCount++;
      if (!lastPublishedAt || when.getTime() > lastPublishedAt.getTime()) lastPublishedAt = when;
    }
  }
  const postsPerWeek = Math.round((itemCount / 30) * 7 * 10) / 10;
  return { itemCount, lastPublishedAt, postsPerWeek };
}
