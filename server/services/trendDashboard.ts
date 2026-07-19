/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 *
 * Source dashboard for the Trends page: per-source top lists (not the merged
 * feed) with a Norway/global toggle. Reuses the parametrized fetchers from
 * trendSources.ts — all free, no API keys. Fails soft per source and caches
 * per geo for 30 minutes. "Ny" badges compare against the previous snapshot
 * held in memory (first fetch after boot shows none — honest, not noisy).
 */
import { getTrendingKeywords } from "./googleTrends";
import {
  AggregatedTrend,
  fetchMastodon,
  fetchRedditTop,
  fetchRssFeed,
  fetchWikipediaTop,
} from "./trendSources";

export type DashboardGeo = "no" | "global";

export interface TrendDashboardItem {
  rank: number;
  title: string;
  url?: string;
  metric?: string;
  isNew: boolean;
}

export interface TrendDashboardSection {
  id: string;
  label: string;
  items: TrendDashboardItem[];
  failed?: boolean;
}

export interface TrendDashboard {
  geo: DashboardGeo;
  sections: TrendDashboardSection[];
  updatedAt: string;
}

const CACHE_MS = 30 * 60 * 1000;
const cache = new Map<DashboardGeo, { at: number; data: TrendDashboard }>();
/** `${geo}:${sectionId}` -> lowercased titles from the PREVIOUS snapshot. */
const prevTitles = new Map<string, Set<string>>();

interface RawItem {
  title: string;
  url?: string;
  metric?: string;
}

const fromAggregated = (items: AggregatedTrend[]): RawItem[] =>
  items.map((t) => ({ title: t.keyword, url: t.sourceUrl, metric: t.traffic }));

async function googleSection(geo: DashboardGeo): Promise<RawItem[]> {
  const region = geo === "no" ? "NO" : "US";
  const trends = await getTrendingKeywords(region);
  return (trends || [])
    .map((t: any) => ({
      title: String(t.title || t.keyword || "").trim(),
      url: `https://trends.google.com/trends/explore?geo=${region}&q=${encodeURIComponent(t.title || t.keyword || "")}`,
      metric: typeof t.trendScore === "number" ? `Score ${t.trendScore}` : undefined,
    }))
    .filter((t) => t.title);
}

interface SectionDef {
  id: string;
  label: string;
  fetch: () => Promise<RawItem[]>;
}

function sectionDefs(geo: DashboardGeo): SectionDef[] {
  if (geo === "no") {
    return [
      { id: "google", label: "Google Trends (Norge)", fetch: () => googleSection("no") },
      { id: "wikipedia", label: "Wikipedia (norsk)", fetch: async () => fromAggregated(await fetchWikipediaTop("no.wikipedia", 8)) },
      { id: "news", label: "NRK toppsaker", fetch: async () => fromAggregated(await fetchRssFeed("https://www.nrk.no/toppsaker.rss", "NRK", "nyheter", 8)) },
      { id: "reddit", label: "Reddit r/norge", fetch: async () => fromAggregated(await fetchRedditTop("norge", "Reddit r/norge", 8)) },
      { id: "mastodon", label: "Mastodon-emneknagger", fetch: async () => fromAggregated(await fetchMastodon()) },
      { id: "smt", label: "Sosiale medier-nyheter", fetch: async () => fromAggregated(await fetchRssFeed("https://www.socialmediatoday.com/feeds/news/", "Social Media Today", "sosiale medier", 8)) },
    ];
  }
  return [
    { id: "google", label: "Google Trends (USA)", fetch: () => googleSection("global") },
    { id: "wikipedia", label: "Wikipedia (engelsk)", fetch: async () => fromAggregated(await fetchWikipediaTop("en.wikipedia", 8)) },
    { id: "news", label: "BBC World News", fetch: async () => fromAggregated(await fetchRssFeed("https://feeds.bbci.co.uk/news/world/rss.xml", "BBC", "nyheter", 8)) },
    { id: "reddit", label: "Reddit r/popular", fetch: async () => fromAggregated(await fetchRedditTop("popular", "Reddit r/popular", 8)) },
    { id: "mastodon", label: "Mastodon-emneknagger", fetch: async () => fromAggregated(await fetchMastodon()) },
    { id: "smt", label: "Sosiale medier-nyheter", fetch: async () => fromAggregated(await fetchRssFeed("https://www.socialmediatoday.com/feeds/news/", "Social Media Today", "sosiale medier", 8)) },
  ];
}

function toSection(def: SectionDef, geo: DashboardGeo, result: PromiseSettledResult<RawItem[]>): TrendDashboardSection {
  if (result.status === "rejected") {
    console.warn(`[trendDashboard] ${geo}/${def.id} failed:`, result.reason?.message || result.reason);
    return { id: def.id, label: def.label, items: [], failed: true };
  }
  const key = `${geo}:${def.id}`;
  const prev = prevTitles.get(key);
  const list = result.value.slice(0, 8);
  const items = list.map((x, i) => ({
    rank: i + 1,
    title: x.title,
    url: x.url,
    metric: x.metric,
    isNew: prev ? !prev.has(x.title.toLowerCase()) : false,
  }));
  prevTitles.set(key, new Set(list.map((x) => x.title.toLowerCase())));
  return { id: def.id, label: def.label, items };
}

export async function getTrendDashboard(geo: DashboardGeo, force = false): Promise<TrendDashboard> {
  const hit = cache.get(geo);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const defs = sectionDefs(geo);
  const results = await Promise.allSettled(defs.map((d) => d.fetch()));
  const sections = defs.map((d, i) => toSection(d, geo, results[i]));

  const data: TrendDashboard = { geo, sections, updatedAt: new Date().toISOString() };
  cache.set(geo, { at: Date.now(), data });
  return data;
}
