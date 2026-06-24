/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Target,
  Plus,
  Trash2,
  ExternalLink,
  TrendingUp,
  RefreshCw,
  ArrowLeft,
  Rss,
  Youtube,
  Newspaper,
  Lightbulb,
  CalendarClock,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { PAGE_DESCRIPTIONS } from "@/lib/pageDescriptions";
import { useLanguage } from "@/contexts/LanguageContext";

function fmtDate(value: string | Date | null | undefined, lang: "no" | "en"): string {
  if (!value) return lang === "no" ? "Ukjent" : "Unknown";
  const d = new Date(value);
  if (isNaN(d.getTime())) return lang === "no" ? "Ukjent" : "Unknown";
  return d.toLocaleDateString(lang === "no" ? "nb-NO" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function sourceMeta(type: string) {
  switch (type) {
    case "youtube":
      return { icon: Youtube, label: "YouTube", className: "text-red-600" };
    case "google_news":
      return { icon: Newspaper, label: "Google News", className: "text-blue-600" };
    case "atom":
      return { icon: Rss, label: "Atom", className: "text-orange-600" };
    default:
      return { icon: Rss, label: "RSS", className: "text-orange-600" };
  }
}

export default function CompetitorRadar() {
  const { language } = useLanguage();
  const tr = (no: string, en: string) => (language === "no" ? no : en);

  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Keep the same Pro gating as the legacy feature.
  const { data: subscription } = trpc.user.getSubscription.useQuery();
  const isPro = subscription?.status === "active";

  if (selectedId !== null) {
    return (
      <CompetitorDetail
        id={selectedId}
        onBack={() => setSelectedId(null)}
        tr={tr}
        language={language}
      />
    );
  }

  return (
    <Dashboard
      isPro={!!isPro}
      onOpen={(id) => setSelectedId(id)}
      tr={tr}
      language={language}
    />
  );
}

/* ------------------------------------------------------------------ Dashboard */

function Dashboard({
  isPro,
  onOpen,
  tr,
  language,
}: {
  isPro: boolean;
  onOpen: (id: number) => void;
  tr: (no: string, en: string) => string;
  language: "no" | "en";
}) {
  const utils = trpc.useUtils();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");

  const { data: competitors, isLoading } = trpc.radar.list.useQuery(undefined, {
    enabled: isPro,
  });

  const addMutation = trpc.radar.addCompetitor.useMutation({
    onSuccess: () => {
      toast.success(tr("Konkurrent lagt til og analysert!", "Competitor added and analyzed!"));
      setName("");
      setWebsite("");
      setDialogOpen(false);
      utils.radar.list.invalidate();
    },
    onError: (e: any) => toast.error(e.message || tr("Kunne ikke legge til", "Could not add")),
  });

  const syncMutation = trpc.radar.sync.useMutation({
    onSuccess: () => {
      toast.success(tr("Synkronisert!", "Synced!"));
      utils.radar.list.invalidate();
    },
    onError: (e: any) => toast.error(e.message || tr("Synk feilet", "Sync failed")),
  });

  const removeMutation = trpc.radar.remove.useMutation({
    onSuccess: () => {
      toast.success(tr("Konkurrent fjernet", "Competitor removed"));
      utils.radar.list.invalidate();
    },
    onError: (e: any) => toast.error(e.message || tr("Kunne ikke fjerne", "Could not remove")),
  });

  const handleAdd = () => {
    if (!name.trim() || !website.trim()) {
      toast.error(tr("Fyll inn navn og nettsted-URL", "Enter name and website URL"));
      return;
    }
    addMutation.mutate({ name: name.trim(), website: website.trim() });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <main className="container py-6 sm:py-8 max-w-6xl">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center shrink-0">
                <Target className="h-6 w-6 text-white" />
              </div>
              <div>
                <PageHeader title={tr("Konkurrent-Radar", "Competitor Radar")} description={PAGE_DESCRIPTIONS.competitorRadar} />
                <p className="text-sm text-muted-foreground">
                  {tr(
                    "Overvåk konkurrenter via offentlige kilder (RSS, YouTube, Google News).",
                    "Monitor competitors via public sources (RSS, YouTube, Google News).",
                  )}
                </p>
              </div>
            </div>
            {isPro && (
              <Button
                className="sm:ml-auto bg-gradient-to-r from-red-500 to-orange-500 hover:opacity-90"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                {tr("Legg til konkurrent", "Add competitor")}
              </Button>
            )}
          </div>

          {!isPro && (
            <Card className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 border-red-200 dark:border-red-900">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Target className="h-5 w-5 text-red-600 shrink-0" />
                    <div>
                      <p className="font-medium text-red-800 dark:text-red-300">
                        {tr("Konkurrent-Radar krever Pro-abonnement", "Competitor Radar requires Pro")}
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-400">
                        {tr("Oppgrader for å følge med på konkurrentene dine", "Upgrade to track your competitors")}
                      </p>
                    </div>
                  </div>
                  <Button className="bg-gradient-to-r from-red-500 to-orange-500 hover:opacity-90 shrink-0">
                    {tr("Oppgrader nå", "Upgrade now")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {isPro && isLoading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {isPro && !isLoading && (!competitors || competitors.length === 0) && (
          <Card>
            <CardContent className="py-12 text-center">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">
                {tr("Ingen konkurrenter lagt til ennå", "No competitors added yet")}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {tr(
                  "Legg til en konkurrent med nettstedet deres, så finner vi offentlige kilder automatisk.",
                  "Add a competitor with their website and we auto-detect public sources.",
                )}
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {tr("Legg til konkurrent", "Add competitor")}
              </Button>
            </CardContent>
          </Card>
        )}

        {isPro && !isLoading && competitors && competitors.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {competitors.map((c: any) => (
              <Card key={c.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">{c.name}</CardTitle>
                    <Badge variant="secondary" className="shrink-0">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {c.itemCount} / 30d
                    </Badge>
                  </div>
                  {c.website && (
                    <a
                      href={c.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 break-all"
                    >
                      {c.website.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  )}
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-xs text-muted-foreground">{tr("Per uke", "Per week")}</p>
                      <p className="font-semibold">{c.postsPerWeek}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-xs text-muted-foreground">{tr("Siste", "Latest")}</p>
                      <p className="font-semibold text-xs">{fmtDate(c.lastPublishedAt, language)}</p>
                    </div>
                  </div>

                  {c.topTopics && c.topTopics.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {c.topTopics.map((t: any, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {t.topic}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {tr("Ingen emner ennå — synkroniser for å analysere.", "No topics yet — sync to analyze.")}
                    </p>
                  )}

                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => syncMutation.mutate({ id: c.id })}
                      disabled={syncMutation.isPending}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                      {tr("Synkroniser", "Sync")}
                    </Button>
                    <Button size="sm" onClick={() => onOpen(c.id)}>
                      {tr("Vis detaljer", "View details")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto"
                      onClick={() => {
                        if (confirm(tr(`Fjern ${c.name}?`, `Remove ${c.name}?`))) {
                          removeMutation.mutate({ id: c.id });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Legg til konkurrent", "Add competitor")}</DialogTitle>
            <DialogDescription>
              {tr(
                "Vi oppdager offentlige kilder (RSS/YouTube/Google News) automatisk. Ingen private data hentes.",
                "We auto-detect public sources (RSS/YouTube/Google News). No private data is fetched.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{tr("Navn", "Name")}</Label>
              <Input
                placeholder={tr("Konkurrent AS", "Competitor Inc")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={addMutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("Nettsted-URL", "Website URL")}</Label>
              <Input
                placeholder="https://example.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                disabled={addMutation.isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={addMutation.isPending}>
              {tr("Avbryt", "Cancel")}
            </Button>
            <Button onClick={handleAdd} disabled={addMutation.isPending}>
              {addMutation.isPending ? tr("Legger til…", "Adding…") : tr("Legg til", "Add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* --------------------------------------------------------------------- Detail */

function CompetitorDetail({
  id,
  onBack,
  tr,
  language,
}: {
  id: number;
  onBack: () => void;
  tr: (no: string, en: string) => string;
  language: "no" | "en";
}) {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.radar.get.useQuery({ id });

  const syncMutation = trpc.radar.sync.useMutation({
    onSuccess: () => {
      toast.success(tr("Synkronisert!", "Synced!"));
      utils.radar.get.invalidate({ id });
      utils.radar.list.invalidate();
    },
    onError: (e: any) => toast.error(e.message || tr("Synk feilet", "Sync failed")),
  });

  const maxTopicScore = data?.topics?.reduce((m: number, t: any) => Math.max(m, t.score), 0) || 1;

  const aiRecs = String(data?.competitor?.aiSummary || "")
    .split(/\n+/)
    .map((l: string) => l.replace(/^[-*\u2022\d.\s]+/, "").trim())
    .filter(Boolean);
  const aiPowered = aiRecs.length > 0;
  const recommendations = aiPowered ? aiRecs : buildRecommendations(data, tr);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <main className="container py-6 sm:py-8 max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={onBack} className="self-start">
            <ArrowLeft className="h-4 w-4 mr-1" />
            {tr("Tilbake", "Back")}
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{data?.competitor?.name || tr("Konkurrent", "Competitor")}</h1>
            {data?.competitor?.website && (
              <a
                href={data.competitor.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                {data.competitor.website.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <Button
            onClick={() => syncMutation.mutate({ id })}
            disabled={syncMutation.isPending}
            className="self-start sm:self-auto"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            {tr("Synkroniser", "Sync")}
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !data ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {tr("Konkurrent ikke funnet.", "Competitor not found.")}
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="overview">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="overview">{tr("Oversikt", "Overview")}</TabsTrigger>
              <TabsTrigger value="timeline">{tr("Aktivitet", "Activity")}</TabsTrigger>
              <TabsTrigger value="topics">{tr("Emner", "Topics")}</TabsTrigger>
              <TabsTrigger value="gaps">{tr("Innholdsgap", "Content gaps")}</TabsTrigger>
              <TabsTrigger value="recommend">{tr("Anbefalinger", "Recommendations")}</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard label={tr("Innlegg (30d)", "Items (30d)")} value={String(data.stats.itemCount)} icon={TrendingUp} />
                <StatCard label={tr("Per uke", "Per week")} value={String(data.stats.postsPerWeek)} icon={CalendarClock} />
                <StatCard label={tr("Kilder", "Sources")} value={String(data.sources.length)} icon={Rss} />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{tr("Kilder", "Sources")}</CardTitle>
                  <CardDescription>{tr("Offentlige kilder vi overvåker.", "Public sources we monitor.")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.sources.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{tr("Ingen kilder oppdaget.", "No sources detected.")}</p>
                  ) : (
                    data.sources.map((s: any) => {
                      const meta = sourceMeta(s.type);
                      const Icon = meta.icon;
                      return (
                        <div key={s.id} className="flex items-center gap-2 text-sm border rounded-lg p-2">
                          <Icon className={`h-4 w-4 shrink-0 ${meta.className}`} />
                          <Badge variant="outline" className="shrink-0">{meta.label}</Badge>
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                            {s.url}
                          </a>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{tr("Siste innhold", "Latest content")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.content.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{tr("Ingen innhold ennå.", "No content yet.")}</p>
                  ) : (
                    data.content.map((item: any) => (
                      <div key={item.id} className="border rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          {item.url ? (
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium text-sm hover:underline">
                              {item.title}
                            </a>
                          ) : (
                            <span className="font-medium text-sm">{item.title}</span>
                          )}
                          <span className="text-xs text-muted-foreground shrink-0">{fmtDate(item.publishedAt, language)}</span>
                        </div>
                        {item.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.summary}</p>}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Timeline */}
            <TabsContent value="timeline" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{tr("Aktivitetstidslinje", "Activity timeline")}</CardTitle>
                  <CardDescription>{tr("Innlegg per uke (ISO-uke).", "Items per week (ISO week).")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.timeline.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">{tr("Ingen data ennå.", "No data yet.")}</p>
                  ) : (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.timeline} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="week" fontSize={11} tickLine={false} />
                          <YAxis allowDecimals={false} fontSize={11} tickLine={false} />
                          <Tooltip
                            contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                          />
                          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Topics */}
            <TabsContent value="topics" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{tr("Emner", "Topics")}</CardTitle>
                  <CardDescription>{tr("Mest omtalte temaer i innholdet.", "Most discussed themes in content.")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.topics.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{tr("Ingen emner ennå.", "No topics yet.")}</p>
                  ) : (
                    data.topics.map((t: any, i: number) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{t.topic}</span>
                          <span className="text-muted-foreground">{t.score}</span>
                        </div>
                        <Progress value={(t.score / maxTopicScore) * 100} className="h-2" />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Gaps */}
            <TabsContent value="gaps" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{tr("Innholdsgap", "Content gaps")}</CardTitle>
                  <CardDescription>
                    {tr(
                      "Emner konkurrenten dekker, men du ikke har skrevet om — muligheter.",
                      "Topics the competitor covers but you haven't — opportunities.",
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.gaps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {tr("Ingen åpenbare gap — bra jobbet!", "No obvious gaps — well done!")}
                    </p>
                  ) : (
                    data.gaps.map((g: any, i: number) => (
                      <div key={i} className="flex items-center justify-between gap-2 border rounded-lg p-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
                          <span className="font-medium text-sm truncate">{g.topic}</span>
                          <Badge variant="secondary" className="shrink-0">{g.opportunityScore}</Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => setLocation(`/generate?topic=${encodeURIComponent(g.topic)}`)}
                        >
                          <Sparkles className="h-3.5 w-3.5 mr-1" />
                          {tr("Generer innlegg", "Generate post")}
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Recommendations */}
            <TabsContent value="recommend" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{tr("Anbefalinger", "Recommendations")}</CardTitle>
                  <CardDescription>{aiPowered ? tr("AI-genererte forslag basert på konkurrentens innhold.", "AI-generated suggestions based on the competitor\u2019s content.") : tr("Basert på gap og emner.", "Based on gaps and topics.")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {recommendations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {tr("Synkroniser for å få anbefalinger.", "Sync to get recommendations.")}
                    </p>
                  ) : (
                    recommendations.map((rec, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm border rounded-lg p-3">
                        <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function buildRecommendations(data: any, tr: (no: string, en: string) => string): string[] {
  if (!data) return [];
  const recs: string[] = [];
  const gaps: any[] = data.gaps || [];
  const topics: any[] = data.topics || [];

  if (gaps.length > 0) {
    const top = gaps.slice(0, 3).map((g) => g.topic).join(", ");
    recs.push(
      tr(
        `Vurder å lage innhold om: ${top}. Konkurrenten dekker disse, men du har ikke gjort det ennå.`,
        `Consider creating content about: ${top}. The competitor covers these, but you haven't yet.`,
      ),
    );
  }
  if (topics.length > 0) {
    recs.push(
      tr(
        `Konkurrentens hovedfokus er "${topics[0].topic}". Lag din egen vinkling for å skille deg ut.`,
        `The competitor's main focus is "${topics[0].topic}". Craft your own angle to stand out.`,
      ),
    );
  }
  if (data.stats && data.stats.postsPerWeek > 0) {
    recs.push(
      tr(
        `Konkurrenten publiserer ~${data.stats.postsPerWeek} ganger per uke. Match eller overgå tempoet for å holde tritt.`,
        `The competitor publishes ~${data.stats.postsPerWeek} times per week. Match or exceed this cadence to keep up.`,
      ),
    );
  }
  return recs;
}
