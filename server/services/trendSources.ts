/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 *
 * Aggregates trending topics from MULTIPLE trusted sources, each item carrying
 * its source and a real date. Sources (all free, no API key):
 *   - Google Trends (Norway)        — existing service
 *   - NRK (Norwegian public broadcaster) top stories RSS
 *   - Wikipedia (Norwegian) most-read articles (Wikimedia pageviews API)
 * Fails soft per-source (Promise.allSettled) and caches for 1 hour.
 */
import { getTrendingKeywords } from "./googleTrends";

export interface AggregatedTrend {
  keyword: string;
  source: string;        // human label, e.g. "NRK", "Wikipedia", "Google Trends"
  sourceUrl?: string;
  date: string;          // ISO timestamp of the item (or fetch time)
  traffic?: string;      // optional volume/score
  category?: string;
}

const UA = "Mozilla/5.0 (compatible; PennaAI/1.0; +https://penna.no)";
const CACHE_MS = 60 * 60 * 1000; // 1 hour
let cache: { at: number; data: AggregatedTrend[] } | null = null;

async function withTimeout(url: string, opts: any = {}, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, headers: { "User-Agent": UA, ...(opts.headers || {}) } });
  } finally {
    clearTimeout(t);
  }
}

/** Generic lightweight RSS parser (title/link/pubDate). */
function parseRss(xml: string, source: string, category: string, limit = 8): AggregatedTrend[] {
  const items: AggregatedTrend[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) && items.length < limit) {
    const block = m[1];
    const title = (block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim();
    const link = (block.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/) || [])[1]?.trim();
    const pub = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]?.trim();
    if (title) {
      items.push({
        keyword: title,
        source,
        sourceUrl: link,
        date: pub ? new Date(pub).toISOString() : new Date().toISOString(),
        category,
      });
    }
  }
  return items;
}

/** NRK top stories RSS — trusted Norwegian news. Lightweight regex parse. */
async function fetchNRK(): Promise<AggregatedTrend[]> {
  const res = await withTimeout("https://www.nrk.no/toppsaker.rss");
  if (!res.ok) throw new Error(`NRK ${res.status}`);
  const xml = await res.text();
  return parseRss(xml, "NRK", "nyheter", 8);
}

/** Wikipedia (Norwegian) most-read articles for yesterday — Wikimedia pageviews API. */
async function fetchWikipedia(): Promise<AggregatedTrend[]> {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday (today not finalized)
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/no.wikipedia/all-access/${y}/${mo}/${da}`;
  const res = await withTimeout(url);
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  const json: any = await res.json();
  const articles: any[] = json?.items?.[0]?.articles || [];
  const dateIso = new Date(Date.UTC(y, d.getUTCMonth(), d.getUTCDate())).toISOString();
  return articles
    .filter((a) => a.article && !["Hovedside", "Spesial:Søk", "Special:Search"].includes(a.article) && !a.article.startsWith("Spesial:") && !a.article.startsWith("Wikipedia:"))
    .slice(0, 8)
    .map((a) => ({
      keyword: String(a.article).replace(/_/g, " "),
      source: "Wikipedia",
      sourceUrl: `https://no.wikipedia.org/wiki/${encodeURIComponent(a.article)}`,
      date: dateIso,
      traffic: `${Number(a.views).toLocaleString("no-NO")} visninger`,
      category: "kunnskap",
    }));
}

/** Reddit r/norge — top posts of the day (social/community trends). */
async function fetchReddit(): Promise<AggregatedTrend[]> {
  // JSON first; Reddit sometimes blocks datacenter IPs — fall back to RSS.
  try {
    const res = await withTimeout("https://www.reddit.com/r/norge/top.json?t=day&limit=8");
    if (res.ok) {
      const json: any = await res.json();
      const posts: any[] = json?.data?.children || [];
      const items = posts
        .map((p) => p.data)
        .filter((d) => d && d.title && !d.stickied)
        .slice(0, 6)
        .map((d) => ({
          keyword: d.title as string,
          source: "Reddit r/norge",
          sourceUrl: `https://www.reddit.com${d.permalink}`,
          date: new Date((d.created_utc || Date.now() / 1000) * 1000).toISOString(),
          traffic: `${Number(d.score || 0).toLocaleString("no-NO")} stemmer`,
          category: "sosiale medier",
        }));
      if (items.length) return items;
    }
  } catch {
    /* fall through to RSS */
  }
  const rss = await withTimeout("https://www.reddit.com/r/norge/top/.rss?t=day");
  if (!rss.ok) throw new Error(`Reddit ${rss.status}`);
  const xml = await rss.text();
  // Atom feed uses <entry> not <item>; normalize minimally.
  const entries: AggregatedTrend[] = [];
  const re = /<entry>([\s\S]*?)<\/entry>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && entries.length < 6) {
    const b = m[1];
    const title = (b.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim();
    const link = (b.match(/<link[^>]*href="([^"]+)"/) || [])[1];
    const upd = (b.match(/<updated>([\s\S]*?)<\/updated>/) || [])[1];
    if (title) entries.push({ keyword: title, source: "Reddit r/norge", sourceUrl: link, date: upd ? new Date(upd).toISOString() : new Date().toISOString(), category: "sosiale medier" });
  }
  return entries;
}

/** Mastodon trending hashtags — public, reliable social-network trends (no auth). */
async function fetchMastodon(): Promise<AggregatedTrend[]> {
  const res = await withTimeout("https://mastodon.social/api/v1/trends/tags?limit=8");
  if (!res.ok) throw new Error(`Mastodon ${res.status}`);
  const tags: any[] = await res.json();
  const now = new Date().toISOString();
  return (tags || []).slice(0, 8).map((t: any) => {
    const uses = Array.isArray(t.history) ? t.history.reduce((a: number, h: any) => a + Number(h.uses || 0), 0) : 0;
    return {
      keyword: `#${t.name}`,
      source: "Mastodon",
      sourceUrl: t.url,
      date: now,
      traffic: uses ? `${uses.toLocaleString("no-NO")} innlegg` : undefined,
      category: "sosiale medier",
    } as AggregatedTrend;
  });
}

/** Social Media Today — continuous news about social media platforms (RSS). */
async function fetchSocialMediaNews(): Promise<AggregatedTrend[]> {
  const res = await withTimeout("https://www.socialmediatoday.com/feeds/news/");
  if (!res.ok) throw new Error(`SocialMediaToday ${res.status}`);
  const xml = await res.text();
  return parseRss(xml, "Social Media Today", "sosiale medier", 8);
}

/** Google Trends (existing service), normalized. */
async function fetchGoogle(): Promise<AggregatedTrend[]> {
  const trends = await getTrendingKeywords("NO");
  const now = new Date().toISOString();
  return (trends || []).slice(0, 10).map((t: any) => ({
    keyword: t.title || t.keyword || "",
    source: "Google Trends",
    sourceUrl: `https://trends.google.com/trends/explore?geo=NO&q=${encodeURIComponent(t.title || t.keyword || "")}`,
    date: now,
    traffic: typeof t.trendScore === "number" ? `Score ${t.trendScore}` : undefined,
    category: t.category || "trending",
  })).filter((t) => t.keyword);
}

export async function getAggregatedTrends(force = false): Promise<{ trends: AggregatedTrend[]; sources: string[]; updatedAt: string }> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) {
    return { trends: cache.data, sources: uniqueSources(cache.data), updatedAt: new Date(cache.at).toISOString() };
  }
  const results = await Promise.allSettled([fetchGoogle(), fetchNRK(), fetchWikipedia(), fetchReddit(), fetchMastodon(), fetchSocialMediaNews()]);
  const merged: AggregatedTrend[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") merged.push(...r.value);
    else console.warn("[trends] source failed:", r.reason?.message || r.reason);
  }
  // De-duplicate by lowercased keyword, keep first (source priority by fetch order).
  const seen = new Set<string>();
  const deduped = merged.filter((t) => {
    const k = t.keyword.toLowerCase().trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  cache = { at: Date.now(), data: deduped };
  return { trends: deduped, sources: uniqueSources(deduped), updatedAt: new Date(cache.at).toISOString() };
}

function uniqueSources(items: AggregatedTrend[]): string[] {
  return Array.from(new Set(items.map((i) => i.source)));
}
