/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLocation } from "wouter";
import { setEditorHandoff, takeAbTestHandoff } from "@/lib/editorHandoff";
import {
  Zap,
  Trophy,
  Sparkles,
  Plus,
  Copy,
  Pause,
  Play,
  Flag,
  Loader2,
  Link2,
  ArrowLeft,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PAGE_DESCRIPTIONS } from "@/lib/pageDescriptions";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type GeneratedVariant = { label: string; body: string };

const PLATFORMS = ["linkedin", "twitter", "instagram", "facebook"] as const;
const DURATIONS = [24, 48, 72] as const;
const CONTROL_KEYS = ["Hook", "CTA", "Tone", "Length", "Image"] as const;

function trackingBase(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export default function ABTesting() {
  const { language } = useLanguage();
  const tr = (no: string, en: string) => (language === "no" ? no : en);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // --- create-dialog form state ---
  const [platform, setPlatform] = useState<string>("linkedin");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [durationHours, setDurationHours] = useState<number>(48);
  const [goal] = useState<string>("clicks");
  const [controls, setControls] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [seedBody, setSeedBody] = useState("");
  const [postId, setPostId] = useState<number | undefined>(undefined);
  const [variants, setVariants] = useState<GeneratedVariant[]>([]);

  // Prefill from Generate.tsx hand-off (?postId=&platform=&body=)
  useEffect(() => {
    // Prefer the in-memory hand-off (no URL leak); fall back to query params for
    // any older bookmarked links.
    const handoff = takeAbTestHandoff();
    const params = new URLSearchParams(window.location.search);
    const body = handoff?.body ?? params.get("body");
    const pid = handoff?.postId != null ? String(handoff.postId) : params.get("postId");
    const plat = handoff?.platform ?? params.get("platform");
    if (body || pid) {
      if (plat && (PLATFORMS as readonly string[]).includes(plat)) setPlatform(plat);
      if (pid && !Number.isNaN(Number(pid))) setPostId(Number(pid));
      if (body) {
        setSeedBody(body);
        setTopic(body);
      }
      setCreateOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listQuery = trpc.ab.list.useQuery();

  const generateMutation = trpc.ab.generateVariants.useMutation({
    onSuccess: (data) => {
      setVariants(data.variants);
      toast.success(tr("Varianter generert!", "Variants generated!"));
    },
    onError: (e) => toast.error(e.message || tr("Kunne ikke generere", "Generation failed")),
  });

  const createMutation = trpc.ab.create.useMutation({
    onSuccess: (data) => {
      toast.success(tr("A/B-test startet!", "A/B test started!"));
      setCreateOpen(false);
      resetForm();
      utils.ab.list.invalidate();
      setSelectedId(data.id);
    },
    onError: (e) => toast.error(e.message || tr("Kunne ikke opprette test", "Could not create test")),
  });

  function resetForm() {
    setDestinationUrl("");
    setControls([]);
    setTopic("");
    setSeedBody("");
    setVariants([]);
    setPostId(undefined);
  }

  function toggleControl(key: string) {
    setControls((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]
    );
  }

  function handleGenerate() {
    if (!topic.trim() && !seedBody.trim()) {
      toast.error(tr("Skriv inn et tema eller innhold", "Enter a topic or content"));
      return;
    }
    generateMutation.mutate({
      topic: topic.trim() || undefined,
      body: seedBody.trim() || undefined,
      platform,
      controls,
    });
  }

  function updateVariant(idx: number, body: string) {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, body } : v)));
  }

  function handleStart() {
    if (!destinationUrl.trim()) {
      toast.error(tr("Oppgi en destinasjons-URL", "Provide a destination URL"));
      return;
    }
    const valid = variants.filter((v) => v.body.trim());
    if (valid.length < 2) {
      toast.error(tr("Trenger minst 2 varianter", "Need at least 2 variants"));
      return;
    }
    createMutation.mutate({
      postId,
      platform,
      destinationUrl: destinationUrl.trim(),
      durationHours,
      goal,
      variants: valid.map((v) => ({ label: v.label, body: v.body })),
    });
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
      <PageHeader
        title={tr("A/B-testing", "A/B Testing")}
        description={PAGE_DESCRIPTIONS.abTesting}
      />

      {selectedId === null ? (
        <>
          <div className="flex items-center justify-between mt-4 mb-4">
            <h2 className="text-sm sm:text-base font-semibold text-muted-foreground">
              {tr("Dine tester", "Your tests")}
            </h2>
            <Button onClick={() => { resetForm(); setCreateOpen(true); }} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {tr("Ny A/B-test", "New A/B test")}
            </Button>
          </div>

          {listQuery.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-lg" />
              ))}
            </div>
          ) : !listQuery.data || listQuery.data.length === 0 ? (
            <EmptyState tr={tr} onCreate={() => { resetForm(); setCreateOpen(true); }} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {listQuery.data.map((exp) => (
                <ExperimentSummaryCard
                  key={exp.id}
                  exp={exp}
                  tr={tr}
                  onOpen={() => setSelectedId(exp.id)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <ExperimentDetail
          id={selectedId}
          tr={tr}
          onBack={() => { setSelectedId(null); utils.ab.list.invalidate(); }}
          setLocation={setLocation}
        />
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              {tr("Ny A/B-test", "New A/B test")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{tr("Plattform", "Platform")}</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{tr("Varighet", "Duration")}</Label>
                <Select
                  value={String(durationHours)}
                  onValueChange={(v) => setDurationHours(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d} {tr("timer", "hours")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{tr("Mål", "Goal")}</Label>
                <Select value={goal} disabled>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clicks">{tr("Klikk", "Clicks")}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {tr("Andre mål kommer snart", "Other goals coming soon")}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>{tr("Destinasjons-URL", "Destination URL")}</Label>
                <Input
                  type="url"
                  placeholder="https://..."
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{tr("Variant-kontroller", "Variant controls")}</Label>
              <div className="flex flex-wrap gap-3">
                {CONTROL_KEYS.map((key) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 text-sm cursor-pointer select-none"
                  >
                    <Checkbox
                      checked={controls.includes(key)}
                      onCheckedChange={() => toggleControl(key)}
                    />
                    {key}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{tr("Tema / innhold", "Topic / content")}</Label>
              <Textarea
                rows={3}
                placeholder={tr("Hva handler innlegget om?", "What is the post about?")}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {tr("Generer varianter", "Generate variants")}
            </Button>

            {variants.length > 0 && (
              <div className="space-y-3">
                {variants.map((v, idx) => (
                  <div key={idx} className="rounded-lg border p-3 space-y-2">
                    <Badge variant="outline">{v.label}</Badge>
                    <Textarea
                      rows={4}
                      value={v.body}
                      onChange={(e) => updateVariant(idx, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              {tr("Avbryt", "Cancel")}
            </Button>
            <Button
              onClick={handleStart}
              disabled={createMutation.isPending || variants.length < 2}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              {tr("Start test", "Start test")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({
  tr,
  onCreate,
}: {
  tr: (no: string, en: string) => string;
  onCreate: () => void;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
        <div className="rounded-full bg-primary/10 p-4">
          <Zap className="h-8 w-8 text-primary" />
        </div>
        <h3 className="font-semibold">
          {tr("Ingen A/B-tester ennå", "No A/B tests yet")}
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {tr(
            "Test ulike versjoner av innholdet ditt med ekte klikksporing og finn vinneren automatisk.",
            "Test different versions of your content with real click tracking and find the winner automatically."
          )}
        </p>
        <Button onClick={onCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {tr("Ny A/B-test", "New A/B test")}
        </Button>
      </CardContent>
    </Card>
  );
}

function statusBadge(status: string, tr: (no: string, en: string) => string) {
  const map: Record<string, { label: string; cls: string }> = {
    running: { label: tr("Aktiv", "Running"), cls: "bg-green-500/15 text-green-600 dark:text-green-400" },
    paused: { label: tr("Pauset", "Paused"), cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
    completed: { label: tr("Fullført", "Completed"), cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
    draft: { label: tr("Utkast", "Draft"), cls: "bg-muted text-muted-foreground" },
  };
  const s = map[status] || map.draft;
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>;
}

function ExperimentSummaryCard({
  exp,
  tr,
  onOpen,
}: {
  exp: any;
  tr: (no: string, en: string) => string;
  onOpen: () => void;
}) {
  return (
    <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={onOpen}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm capitalize">{exp.platform}</CardTitle>
          {statusBadge(exp.status, tr)}
        </div>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground space-y-1">
        <div className="flex justify-between">
          <span>{tr("Varianter", "Variants")}</span>
          <span className="font-medium text-foreground">{exp.variantCount}</span>
        </div>
        <div className="flex justify-between">
          <span>{tr("Klikk totalt", "Total clicks")}</span>
          <span className="font-medium text-foreground">{exp.totalClicks}</span>
        </div>
        {exp.winnerVariantId && (
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <Trophy className="h-3 w-3" />
            {tr("Vinner kåret", "Winner declared")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExperimentDetail({
  id,
  tr,
  onBack,
  setLocation,
}: {
  id: number;
  tr: (no: string, en: string) => string;
  onBack: () => void;
  setLocation: (path: string) => void;
}) {
  const utils = trpc.useUtils();
  const detail = trpc.ab.get.useQuery({ id }, { refetchInterval: 15000 });

  const invalidate = () => {
    utils.ab.get.invalidate({ id });
    utils.ab.list.invalidate();
  };

  const pauseM = trpc.ab.pause.useMutation({
    onSuccess: () => { toast.success(tr("Test pauset", "Test paused")); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const resumeM = trpc.ab.resume.useMutation({
    onSuccess: () => { toast.success(tr("Test gjenopptatt", "Test resumed")); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const endM = trpc.ab.end.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.winnerVariantId
          ? tr("Test avsluttet — vinner kåret!", "Test ended — winner declared!")
          : tr("Test avsluttet", "Test ended") + " — " + data.reason
      );
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const dupM = trpc.ab.duplicate.useMutation({
    onSuccess: () => { toast.success(tr("Test duplisert som utkast", "Duplicated as draft")); utils.ab.list.invalidate(); onBack(); },
    onError: (e) => toast.error(e.message),
  });

  const statByVariant = useMemo(() => {
    const m = new Map<number, any>();
    (((detail.data as { stats?: { variantId: number }[] } | undefined)?.stats) ?? []).forEach((s: any) => m.set(s.variantId, s));
    return m;
  }, [detail.data]);

  if (detail.isLoading) {
    return (
      <div className="mt-4 space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!detail.data) {
    const isNotFound = (detail.error as any)?.data?.code === "NOT_FOUND";
    const isServerError = !!detail.error && !isNotFound;
    return (
      <div className="mt-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {tr("Tilbake", "Back")}
        </Button>
        {isServerError ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-red-600 dark:text-red-400">
              {tr("Kunne ikke laste testen (serverfeil).", "Could not load the test (server error).")}
            </p>
            <Button variant="outline" size="sm" onClick={() => detail.refetch()}>
              {tr("Prøv igjen", "Retry")}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mt-4">
            {tr("Fant ikke testen.", "Test not found.")}
          </p>
        )}
      </div>
    );
  }

  const { experiment, variants, timeline } = detail.data as any;
  const winnerId: number | null = experiment.winnerVariantId ?? null;

  const distData = variants.map((v: any) => ({
    name: v.label || `#${v.id}`,
    clicks: Number(statByVariant.get(v.id)?.clicks ?? 0),
  }));

  const copyLink = (code: string) => {
    const url = `${trackingBase()}/r/${code}`;
    navigator.clipboard.writeText(url);
    toast.success(tr("Lenke kopiert", "Link copied"));
  };

  const useWinner = () => {
    const w = variants.find((v: any) => v.id === winnerId);
    if (!w) return;
    // Pass the winning variant to the editor via memory, not the URL (no leak).
    setEditorHandoff({ topic: w.body, source: "abtest" });
    setLocation("/generate");
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {tr("Tilbake", "Back")}
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {statusBadge(experiment.status, tr)}
          {experiment.status === "running" && (
            <Button size="sm" variant="outline" onClick={() => pauseM.mutate({ id })} disabled={pauseM.isPending}>
              <Pause className="h-4 w-4 mr-1" />{tr("Pause", "Pause")}
            </Button>
          )}
          {experiment.status === "paused" && (
            <Button size="sm" variant="outline" onClick={() => resumeM.mutate({ id })} disabled={resumeM.isPending}>
              <Play className="h-4 w-4 mr-1" />{tr("Gjenoppta", "Resume")}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => dupM.mutate({ id })} disabled={dupM.isPending}>
            <Copy className="h-4 w-4 mr-1" />{tr("Dupliser", "Duplicate")}
          </Button>
          {experiment.status !== "completed" && (
            <Button size="sm" variant="destructive" onClick={() => endM.mutate({ id })} disabled={endM.isPending}>
              <Flag className="h-4 w-4 mr-1" />{tr("Avslutt test", "End test")}
            </Button>
          )}
        </div>
      </div>

      {experiment.status === "completed" && !winnerId && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          {tr("Trenger mer data — ingen statistisk vinner.", "Needs more data — no statistical winner.")}
        </div>
      )}

      {/* Variant cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {variants.map((v: any) => {
          const s = statByVariant.get(v.id);
          const isWinner = winnerId === v.id;
          return (
            <Card key={v.id} className={isWinner ? "border-green-500/60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm flex items-center gap-1">
                    {isWinner && <Trophy className="h-4 w-4 text-green-500" />}
                    {v.label || `#${v.id}`}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                  {v.body}
                </p>
                <button
                  type="button"
                  onClick={() => copyLink(v.trackingCode)}
                  className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <Link2 className="h-3 w-3" />
                  {trackingBase()}/r/{v.trackingCode}
                </button>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Metric label={tr("Klikk", "Clicks")} value={Number(s?.clicks ?? 0)} />
                  <Metric label={tr("Unike", "Unique")} value={Number(s?.uniqueClicks ?? 0)} />
                  <Metric label="CTR" value={`${((Number(s?.ctr ?? 0)) * 100).toFixed(1)}%`} />
                  <Metric
                    label={tr("Sikkerhet", "Confidence")}
                    value={`${((Number(s?.confidence ?? 0)) * 100).toFixed(0)}%`}
                  />
                  <Metric
                    label={tr("Vinnersjanse", "Win prob.")}
                    value={`${((Number(s?.winnerProbability ?? 0)) * 100).toFixed(0)}%`}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {winnerId && (
        <Button onClick={useWinner} className="w-full sm:w-auto">
          <Trophy className="h-4 w-4 mr-2" />
          {tr("Bruk vinner", "Use winner")}
        </Button>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{tr("Klikk over tid", "Clicks over time")}</CardTitle>
          </CardHeader>
          <CardContent>
            {timeline && timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} hide={timeline.length > 12} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="clicks" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground py-8 text-center">
                {tr("Ingen klikk ennå", "No clicks yet")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{tr("Fordeling", "Distribution")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={distData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="clicks" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-muted/50 px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-semibold text-foreground">{value}</div>
    </div>
  );
}
