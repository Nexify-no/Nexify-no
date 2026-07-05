/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  Flame,
  Sparkles,
  ArrowRight,
  Search,
  RefreshCw,
  ExternalLink,
  Zap,
  Clock,
  Globe,
  TrendingUp,
  CalendarDays,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";

// Source filter chips — map a chip to a substring matcher against the real
// source names returned by getAggregatedTrends (Google Trends, NRK, Wikipedia,
// Mastodon, Reddit, Social Media Today).
const SOURCE_CHIPS: { value: string; label: string; match: (s: string) => boolean }[] = [
  { value: "all", label: "Alle", match: () => true },
  { value: "google", label: "Google", match: (s) => /google/i.test(s) },
  { value: "nrk", label: "NRK", match: (s) => /nrk/i.test(s) },
  { value: "wikipedia", label: "Wikipedia", match: (s) => /wikipedia/i.test(s) },
  { value: "mastodon", label: "Mastodon", match: (s) => /mastodon/i.test(s) },
  { value: "social", label: "Social", match: (s) => /social|reddit/i.test(s) },
];

// Bransje (industry) filters — keyword matchers against the trend's title /
// description / category, so users can see only trends relevant to their field.
const BRANSJE_FILTERS: { value: string; label: string; match: (s: string) => boolean }[] = [
  { value: "all", label: "Alle bransjer", match: () => true },
  { value: "teknologi", label: "Teknologi & IT", match: (s) => /teknolog|kunstig intelligens|\bai\b|\bdata\b|\bapp\b|digital|software|programvare|startup|cyber|robot/i.test(s) },
  { value: "handel", label: "Varehandel & e-handel", match: (s) => /handel|butikk|netthandel|e-handel|shopping|forbruker|nettbutikk|\bsalg\b/i.test(s) },
  { value: "finans", label: "Finans & økonomi", match: (s) => /finans|\bbank\b|aksje|børs|økonomi|rente|krypto|bitcoin|investor|\bskatt\b|valuta/i.test(s) },
  { value: "helse", label: "Helse & trening", match: (s) => /helse|medisin|trening|kosthold|psyk|sykehus|\blege\b|velvære|mental/i.test(s) },
  { value: "reiseliv", label: "Reiseliv & opplevelser", match: (s) => /reise|ferie|hotell|\bfly\b|turist|opplevelse/i.test(s) },
  { value: "bygg", label: "Bygg & eiendom", match: (s) => /\bbygg|eiendom|bolig|håndverk|entreprenør|arkitekt|renover|leilighet/i.test(s) },
  { value: "marked", label: "Markedsføring & media", match: (s) => /markedsf|reklame|sosiale medier|innhold|merkevare|kampanje|\bmedia\b|influenser/i.test(s) },
  { value: "utdanning", label: "Utdanning & karriere", match: (s) => /utdanning|skole|universitet|\bkurs\b|karriere|\bjobb\b|rekruttering|læring|student/i.test(s) },
  { value: "mat", label: "Mat & drikke", match: (s) => /\bmat\b|drikke|oppskrift|restaurant|kafé|matvare|\bkokk\b|servering/i.test(s) },
]

const PAGE_SIZE = 9;

function relativeTime(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "nå nettopp";
  if (min < 60) return `${min} min siden`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} t siden`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d siden`;
  return d.toLocaleDateString("no-NO", { day: "2-digit", month: "2-digit" });
}

function isToday(dateStr?: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

// Visual score buckets per spec: 90+ green, 70-89 yellow, below neutral.
function scoreClasses(score: number): string {
  if (score >= 90) return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800";
  if (score >= 70) return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800";
  return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700";
}

export default function Trends() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSource, setActiveSource] = useState("all");
  const [activeBransje, setActiveBransje] = useState("all");
  const [sortBy, setSortBy] = useState<"score" | "newest" | "source">("score");
  const [view, setView] = useState<"expanded" | "compact">("expanded");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { data: subscription } = trpc.user.getSubscription.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: trendsData, isLoading: trendsLoading, error: trendsError, refetch } =
    trpc.trends.getAggregatedTrends.useQuery({}, { enabled: isAuthenticated });

  const isPro = subscription?.status === "active";

  const trendingTopics = useMemo(() => {
    if (!trendsData) return [] as any[];
    try {
      const trends = Array.isArray(trendsData) ? trendsData : ((trendsData as any).data || []);
      return trends
        .filter((t: any) => t && (t.keyword || t.title))
        .map((trend: any, index: number) => ({
          id: index + 1,
          title: trend.keyword || trend.title || "Ukjent trend",
          description: trend.traffic || (trend.category ? `Kategori: ${trend.category}` : "Aktuelt emne"),
          source: trend.source || "Ukjent kilde",
          sourceUrl: trend.sourceUrl as string | undefined,
          date: trend.date as string | undefined,
          trendScore: Math.max(60, 96 - index * 3),
          traffic: trend.traffic || "",
          category: trend.category || "",
          suggestedPlatforms: ["linkedin", "twitter", "instagram", "facebook"],
        }));
    } catch (error) {
      console.error("Error parsing trends data:", error);
      return [] as any[];
    }
  }, [trendsData]);

  const distinctSources = useMemo(
    () => Array.from(new Set(trendingTopics.map((t: any) => t.source))).filter(Boolean),
    [trendingTopics]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const chip = SOURCE_CHIPS.find((c) => c.value === activeSource) || SOURCE_CHIPS[0];
    const bransje = BRANSJE_FILTERS.find((b) => b.value === activeBransje) || BRANSJE_FILTERS[0];
    return trendingTopics.filter((topic: any) => {
      const haystack = `${topic.title} ${topic.description}`.toLowerCase();
      const matchesSearch = q === "" || q.split(/\s+/).some((w) => w.length > 0 && haystack.includes(w));
      const matchesSource = chip.match(String(topic.source || ""));
      const matchesBransje = bransje.match(`${topic.title} ${topic.description} ${topic.category || ""}`);
      return matchesSearch && matchesSource && matchesBransje;
    });
  }, [trendingTopics, searchQuery, activeSource, activeBransje]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortBy === "score") arr.sort((a, b) => b.trendScore - a.trendScore);
    else if (sortBy === "newest") arr.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    else if (sortBy === "source") arr.sort((a, b) => String(a.source).localeCompare(String(b.source)));
    return arr;
  }, [filtered, sortBy]);

  const featured = useMemo(() => sorted.slice(0, 3), [sorted]);
  const gridAll = useMemo(() => sorted.slice(3), [sorted]);
  const gridVisible = useMemo(() => gridAll.slice(0, visibleCount), [gridAll, visibleCount]);

  const newToday = useMemo(() => trendingTopics.filter((t: any) => isToday(t.date)).length, [trendingTopics]);
  const lastUpdated = (trendsData as any)?.timestamp ? relativeTime((trendsData as any).timestamp) : "";

  if (authLoading || !isAuthenticated) {
    if (!authLoading && !isAuthenticated) {
      window.location.href = getLoginUrl();
      return null;
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-14 w-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Flame className="h-6 w-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Laster trender...</p>
        </div>
      </div>
    );
  }

  const handleUseTopic = (topic: any) => {
    if (!isPro) {
      toast.error("Trend og Inspirasjon krever Pro-abonnement");
      return;
    }
    const platform = Array.isArray(topic.suggestedPlatforms) && topic.suggestedPlatforms.length > 0 ? topic.suggestedPlatforms[0] : "linkedin";
    setLocation(`/generate?topic=${encodeURIComponent(topic.title)}&platform=${platform}`);
  };

  const handleRefresh = async () => {
    toast.success("Oppdaterer trender...");
    await refetch();
  };

  const resetPaging = () => setVisibleCount(PAGE_SIZE);

  // ---- small presentational helpers ----
  const ScoreBadge = ({ score }: { score: number }) => (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${scoreClasses(score)}`}>
      <Flame className="h-3 w-3" />
      Score {score}
    </span>
  );

  const SourceMeta = ({ topic }: { topic: any }) => (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
      <Globe className="h-3.5 w-3.5 shrink-0" />
      {topic.sourceUrl ? (
        <a href={topic.sourceUrl} target="_blank" rel="noopener noreferrer" className="truncate hover:text-primary hover:underline">{topic.source}</a>
      ) : (
        <span className="truncate">{topic.source}</span>
      )}
      {relativeTime(topic.date) && <span className="shrink-0">· {relativeTime(topic.date)}</span>}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 py-6 sm:py-8">
        {/* ===== HEADER ===== */}
        <header className="mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                <Flame className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Trend og Inspirasjon</h1>
                <p className="text-sm text-muted-foreground">Hva trender nå i Norge — klar til å bli til innhold.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  aria-label="Søk i trender"
                  placeholder="Søk i trender..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); resetPaging(); }}
                  className="pl-9 h-9"
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={trendsLoading} aria-label="Oppdater trender">
                <RefreshCw className={`h-4 w-4 ${trendsLoading ? "animate-spin" : ""}`} />
                <span className="ml-2 hidden sm:inline">Oppdater</span>
              </Button>
            </div>
          </div>
          {lastUpdated && (
            <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Sist oppdatert {lastUpdated}
            </p>
          )}
        </header>

        {!isPro && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-200 text-sm">Oppgrader til Pro for full tilgang</p>
                <p className="text-xs text-amber-700 dark:text-amber-300">Bruk trender direkte i innholdsgenerering.</p>
              </div>
            </div>
            <Button size="sm" onClick={() => (window.location.href = "/settings")} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 shrink-0">
              Oppgrader nå
            </Button>
          </div>
        )}

        {/* ===== SECTION 1 — KPI OVERVIEW ===== */}
        <section className="mb-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Flame, label: "Aktive trender", value: trendsLoading ? "—" : String(filtered.length), tint: "text-orange-500" },
            { icon: CalendarDays, label: "Nye i dag", value: trendsLoading ? "—" : String(newToday), tint: "text-blue-500" },
            { icon: Globe, label: "Kilder sporet", value: trendsLoading ? "—" : String(distinctSources.length), tint: "text-emerald-500" },
            { icon: Clock, label: "Oppdatert", value: trendsLoading ? "—" : (lastUpdated || "—"), tint: "text-purple-500" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border bg-card px-4 py-3 flex items-center gap-3">
              <kpi.icon className={`h-5 w-5 ${kpi.tint} shrink-0`} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
                <p className="text-lg font-semibold leading-tight truncate">{kpi.value}</p>
              </div>
            </div>
          ))}
        </section>

        {/* ===== Error state ===== */}
        {trendsError && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-4 py-4">
            <span className="text-red-600 text-xl">⚠️</span>
            <div>
              <p className="font-medium text-red-800 dark:text-red-300">Kunne ikke hente trender</p>
              <p className="text-sm text-red-700 dark:text-red-400">Prøv å oppdatere, eller kom tilbake senere.</p>
            </div>
          </div>
        )}

        {/* ===== Skeleton loading ===== */}
        {trendsLoading && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (<div key={i} className="h-40 rounded-2xl border bg-muted/40 animate-pulse" />))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2, 3, 4, 5].map((i) => (<div key={i} className="h-32 rounded-xl border bg-muted/40 animate-pulse" />))}
            </div>
          </div>
        )}

        {!trendsLoading && !trendsError && (
          <>
            {/* ===== SECTION 2 — FEATURED TRENDS ===== */}
            {featured.length > 0 && (
              <section className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Utvalgte trender</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {featured.map((topic: any) => (
                    <Card key={topic.id} className="group relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500 to-red-500" />
                      <CardContent className="pt-5 flex flex-col h-full gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <ScoreBadge score={topic.trendScore} />
                          {topic.sourceUrl && (
                            <a href={topic.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label="Åpne kilde" className="text-muted-foreground hover:text-primary">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                        <h3 className="text-base font-bold leading-snug line-clamp-2 group-hover:text-primary transition-colors">{topic.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-1">{topic.description}</p>
                        <div className="mt-auto pt-1 flex items-center justify-between gap-2">
                          <SourceMeta topic={topic} />
                          <Button size="sm" onClick={() => handleUseTopic(topic)} className="shrink-0">
                            Utforsk trend
                            <ArrowRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* ===== SECTION 3 — STICKY FILTER BAR ===== */}
            <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-5 bg-background/85 backdrop-blur border-b">
              <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mb-1 pb-1" role="tablist" aria-label="Filtrer etter kilde">
                  {SOURCE_CHIPS.map((chip) => {
                    const active = activeSource === chip.value;
                    return (
                      <button
                        key={chip.value}
                        role="tab"
                        aria-selected={active}
                        onClick={() => { setActiveSource(chip.value); resetPaging(); }}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
                  <Select value={activeBransje} onValueChange={(v) => { setActiveBransje(v); resetPaging(); }}>
                    <SelectTrigger className="h-9 w-[170px]">
                      <SelectValue placeholder="Bransje" />
                    </SelectTrigger>
                    <SelectContent>
                      {BRANSJE_FILTERS.map((b) => (
                        <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                    <SelectTrigger className="h-9 w-[150px]">
                      <SelectValue placeholder="Sorter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="score">Høyest score</SelectItem>
                      <SelectItem value="newest">Nyeste</SelectItem>
                      <SelectItem value="source">Kilde (A–Å)</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex rounded-lg border p-0.5" role="group" aria-label="Visning">
                    <button
                      onClick={() => setView("compact")}
                      aria-pressed={view === "compact"}
                      className={`px-2.5 py-1 text-xs rounded-md transition-colors ${view === "compact" ? "bg-muted font-medium" : "text-muted-foreground"}`}
                    >Kompakt</button>
                    <button
                      onClick={() => setView("expanded")}
                      aria-pressed={view === "expanded"}
                      className={`px-2.5 py-1 text-xs rounded-md transition-colors ${view === "expanded" ? "bg-muted font-medium" : "text-muted-foreground"}`}
                    >Utvidet</button>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== SECTION 4 — TREND GRID ===== */}
            {filtered.length === 0 ? (
              <div className="rounded-xl border bg-card py-12 px-6 text-center space-y-4">
                <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Search className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">
                  {searchQuery.trim()
                    ? `Ingen trender matchet «${searchQuery.trim()}».`
                    : "Ingen trender funnet akkurat nå."}
                </p>
                {searchQuery.trim() && (
                  <Button onClick={() => setLocation(`/generate?topic=${encodeURIComponent(searchQuery.trim())}`)}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Lag innhold om «{searchQuery.trim()}»
                  </Button>
                )}
              </div>
            ) : gridAll.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Alle aktuelle trender vises ovenfor.</p>
            ) : (
              <>
                <div className={`grid gap-4 ${view === "compact" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
                  {gridVisible.map((topic: any) => (
                    <Card key={topic.id} className="group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                      <CardContent className={view === "compact" ? "p-4" : "p-4 sm:p-5"}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">{topic.title}</h3>
                          <ScoreBadge score={topic.trendScore} />
                        </div>
                        {view === "expanded" && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{topic.description}</p>
                        )}
                        <div className="flex items-center justify-between gap-2 mt-2">
                          <SourceMeta topic={topic} />
                          <Button variant="outline" size="sm" onClick={() => handleUseTopic(topic)} className="shrink-0 group-hover:border-primary group-hover:text-primary">
                            Utforsk
                            <ArrowRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* ===== SECTION 5 — LOAD MORE ===== */}
                {visibleCount < gridAll.length && (
                  <div className="mt-6 flex justify-center">
                    <Button variant="outline" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Vis flere ({gridAll.length - visibleCount})
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
