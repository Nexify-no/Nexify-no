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

const UA = "NexifyAI/1.0 (+https://nexify-ai.onrender.com; trends aggregator)";
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

/** NRK top stories RSS — trusted Norwegian news. Lightweight regex parse. */
async function fetchNRK(): Promise<AggregatedTrend[]> {
  const res = await withTimeout("https://www.nrk.no/toppsaker.rss");
  if (!res.ok) throw new Error(`NRK ${res.status}`);
  const xml = await res.text();
  const items: AggregatedTrend[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) && items.length < 8) {
    const block = m[1];
    const title = (block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim();
    const link = (block.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/) || [])[1]?.trim();
    const pub = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]?.trim();
    if (title) {
      items.push({
        keyword: title,
        source: "NRK",
        sourceUrl: link,
        date: pub ? new Date(pub).toISOString() : new Date().toISOString(),
        category: "nyheter",
      });
    }
  }
  return items;
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
  const results = await Promise.allSettled([fetchGoogle(), fetchNRK(), fetchWikipedia()]);
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
