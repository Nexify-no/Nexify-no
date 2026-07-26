/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Lag din 4-ukers innholdsplan (Enkel-modus, Fase 3a — bak FEATURE_ENKEL_PLAN).
 * Tre enkle steg uten tekniske AI-valg: Mål → Frekvens + plattform → Kostnad,
 * så ett trykk lager hele planen. Merkehjerne-gate foran (planen bygges fra
 * bedriftens profil). Dobbelttrykk-vern via én idempotency-nøkkel per økt.
 * Ved suksess sendes brukeren til /innholdsplan der planen fylles ut.
 */
import { useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ActiveBrandHeader } from "@/components/ActiveBrandHeader";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Loader2, Sparkles,
  Users, HeartHandshake, Image as ImageIcon, MessageCircle, Tag, Layers,
} from "lucide-react";

type Goal = "customers" | "trust" | "showcase" | "engagement" | "offer" | "mixed";
type Platform = "linkedin" | "facebook" | "instagram";
type PerWeek = 2 | 3 | 5;

const GOALS: { id: Goal; label: string; desc: string; Icon: typeof Users }[] = [
  { id: "mixed", label: "Litt av alt", desc: "En variert miks — anbefalt", Icon: Layers },
  { id: "customers", label: "Få flere kunder", desc: "Innhold som skaper henvendelser", Icon: Users },
  { id: "trust", label: "Bygg tillit", desc: "Vis kompetanse og troverdighet", Icon: HeartHandshake },
  { id: "showcase", label: "Vis frem arbeid", desc: "Prosjekter og resultater", Icon: ImageIcon },
  { id: "engagement", label: "Skap engasjement", desc: "Spørsmål og dialog", Icon: MessageCircle },
  { id: "offer", label: "Markedsfør et tilbud", desc: "Løft frem en tjeneste", Icon: Tag },
];

const FREQ: { perWeek: PerWeek; posts: number; label: string; recommended?: boolean }[] = [
  { perWeek: 2, posts: 8, label: "Rolig" },
  { perWeek: 3, posts: 12, label: "Anbefalt", recommended: true },
  { perWeek: 5, posts: 20, label: "Aktiv" },
];

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
];

export default function EnkelCreate() {
  const [, navigate] = useLocation();
  const flagsQuery = trpc.plan.flags.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const brandQuery = trpc.brand.get.useQuery(undefined, { enabled: flagsQuery.data?.enabled === true });

  const [step, setStep] = useState<1 | 2 | 3>(1);
  // PR #84: ONE primary action.
  //
  // Asking for a goal, a frequency and a platform before anything happens made a
  // three-screen form out of "write me four weeks of content". The defaults are
  // the answers most people give — mixed goal, 3 per week, LinkedIn — so the
  // button works immediately and the wizard becomes optional refinement for the
  // people who want it.
  const [customising, setCustomising] = useState(false);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [perWeek, setPerWeek] = useState<PerWeek>(3);
  const [platform, setPlatform] = useState<Platform>("linkedin");
  const idempotencyKey = useRef(`enkel-${(globalThis.crypto?.randomUUID?.() ?? String(Date.now()) + Math.random().toString(36).slice(2))}`);

  // Enabled on the SIMPLE path too. Gating it on `step === 3` meant the whole point
  // of the preview — "what this costs of your remaining monthly quota, before
  // anything is generated" — was unreachable for anyone who just pressed the big
  // button, so a user with 3 posts left queued a 12-post plan with no warning.
  const previewQuery = trpc.plan.preview.useQuery(
    { goal: (goal ?? "mixed") as Goal, platform, postsPerWeek: perWeek },
    { enabled: flagsQuery.data?.enabled === true },
  );

  const createPlan = trpc.plan.create.useMutation({
    onSuccess: () => navigate("/innholdsplan"),
  });

  const brandReady = brandQuery.data?.status === "ready";

  const canNext = useMemo(() => (step === 1 ? !!goal : true), [step, goal]);

  if (flagsQuery.isLoading) {
    return <div className="container max-w-2xl py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Laster" /></div>;
  }

  if (!flagsQuery.data?.enabled) {
    return (
      <main className="container max-w-2xl py-10" lang="nb">
        <Card><CardContent className="py-10 text-center">
          <h1 className="text-xl font-semibold mb-2">Kommer snart</h1>
          <p className="text-sm text-muted-foreground">Denne funksjonen er ikke tilgjengelig ennå.</p>
        </CardContent></Card>
      </main>
    );
  }

  // Merkehjerne-gate: planen bygges fra bedriftens profil.
  if (!brandQuery.isLoading && !brandReady) {
    return (
      <main className="container max-w-2xl py-10" lang="nb">
        <Card><CardContent className="py-10 text-center">
          <Sparkles className="h-8 w-8 text-primary mx-auto mb-3" aria-hidden="true" />
          <h1 className="text-xl font-semibold mb-2">Bygg Merkehjernen din først</h1>
          <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
            Innholdsplanen lages fra bedriftens profil — navn, tilbud, målgruppe og tone.
            Det tar bare et par minutter.
          </p>
          <Link href="/merkehjerne"><Button className="min-h-11">Til Merkehjernen</Button></Link>
        </CardContent></Card>
      </main>
    );
  }

  const effectiveGoal: Goal = goal ?? "mixed";
  const overBudget =
    previewQuery.data?.postsRemaining != null
    && previewQuery.data.postsRemaining < previewQuery.data.contentQuotaNeeded;

  // ── The whole page, for anyone who does not want to configure anything ──
  if (!customising) {
    return (
      <main className="container max-w-2xl py-6 md:py-8" lang="nb">
        <ActiveBrandHeader subtitle="Innholdet lages fra denne merkevarens Merkehjerne" />

        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Lag din 4-ukers innholdsplan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Penna skriver fire uker med innlegg fra Merkehjernen din. Du velger etterpå hva som
            publiseres — ingenting går ut automatisk.
          </p>
        </div>

        {overBudget && (
          <p className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400" role="status">
            Planen er større enn det du har igjen denne måneden ({previewQuery.data?.postsRemaining} av{" "}
            {previewQuery.data?.contentQuotaNeeded} innlegg). Vi lager så mange vi kan — resten kan du
            lage neste periode.
          </p>
        )}

        {createPlan.isError && (
          <p className="mb-3 text-sm text-destructive" role="alert">{createPlan.error.message}</p>
        )}

        <Button
          className="w-full min-h-14 text-base"
          // Also disabled while the Merkehjerne check is in flight: the gate below
          // is `!brandQuery.isLoading && !brandReady`, so a fast click surfaced the
          // raw server error instead of the "build your Merkehjerne first" screen.
          disabled={createPlan.isPending || brandQuery.isLoading}
          onClick={() => createPlan.mutate({
            goal: effectiveGoal, platform, postsPerWeek: perWeek, idempotencyKey: idempotencyKey.current,
          })}
        >
          {createPlan.isPending
            ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />Lager innholdet …</>
            : <><Sparkles className="mr-2 h-5 w-5" aria-hidden="true" />Lag 4 ukers innhold</>}
        </Button>

        <button
          type="button"
          onClick={() => setCustomising(true)}
          disabled={createPlan.isPending}
          className="mx-auto mt-4 block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
        >
          Tilpass mål, kanal og hyppighet
        </button>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Standard: {perWeek} innlegg i uka på {PLATFORMS.find((p) => p.id === platform)?.label}, blandet innhold.
        </p>
      </main>
    );
  }

  return (
    <main className="container max-w-2xl py-6 md:py-8" lang="nb">
      <ActiveBrandHeader subtitle="Innholdet lages fra denne merkevarens Merkehjerne" />

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Tilpass innholdsplanen</h1>
        <p className="text-sm text-muted-foreground mt-1">Steg {step} av 3</p>
        <div className="mt-3 flex gap-1.5" aria-hidden="true">
          {[1, 2, 3].map((s) => (
            <div key={s} className={cn("h-1.5 flex-1 rounded-full", s <= step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
      </div>

      {/* Steg 1 — Mål */}
      {step === 1 && (
        <section aria-label="Velg mål">
          <h2 className="text-lg font-semibold mb-3">Hva er målet med innholdet?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {GOALS.map(({ id, label, desc, Icon }) => {
              const active = goal === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setGoal(id)}
                  aria-pressed={active}
                  className={cn(
                    "text-left rounded-lg border p-4 min-h-[88px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                    <span className="font-medium text-sm">{label}</span>
                    {active && <CheckCircle2 className="h-4 w-4 text-primary ml-auto" aria-hidden="true" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Steg 2 — Frekvens + plattform */}
      {step === 2 && (
        <section aria-label="Velg frekvens og plattform" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-3">Hvor ofte vil du publisere?</h2>
            <div className="grid grid-cols-3 gap-3">
              {FREQ.map(({ perWeek: pw, posts, label, recommended }) => {
                const active = perWeek === pw;
                return (
                  <button
                    key={pw}
                    type="button"
                    onClick={() => setPerWeek(pw)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-lg border p-4 min-h-[92px] text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                    )}
                  >
                    <div className="text-lg font-bold">{pw}/uke</div>
                    <div className="text-xs text-muted-foreground">{posts} innlegg</div>
                    <div className={cn("mt-1 text-[11px] font-medium", recommended ? "text-primary" : "text-muted-foreground")}>{label}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-3">Hvilken plattform?</h2>
            <div className="grid grid-cols-3 gap-3">
              {PLATFORMS.map(({ id, label }) => {
                const active = platform === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPlatform(id)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-lg border p-3 min-h-11 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      active ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Steg 3 — Kostnad + bekreft */}
      {step === 3 && (
        <section aria-label="Forhåndsvisning">
          <h2 className="text-lg font-semibold mb-3">Klar til å lage planen</h2>
          <Card className="mb-4">
            <CardContent className="py-5">
              {previewQuery.isLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Regner ut" /></div>
              ) : (
                <dl className="grid grid-cols-2 gap-y-3 text-sm">
                  {previewQuery.data?.brandName && (<>
                    <dt className="text-muted-foreground">Merkevare</dt>
                    <dd className="text-right font-medium truncate">{previewQuery.data.brandName}</dd>
                  </>)}
                  <dt className="text-muted-foreground">Periode</dt>
                  <dd className="text-right font-medium">4 uker</dd>
                  <dt className="text-muted-foreground">Innlegg</dt>
                  <dd className="text-right font-medium">{previewQuery.data?.posts ?? FREQ.find((f) => f.perWeek === perWeek)?.posts}</dd>
                  <dt className="text-muted-foreground">Bilder</dt>
                  <dd className="text-right font-medium">{previewQuery.data?.images ?? previewQuery.data?.posts}</dd>
                  <dt className="text-muted-foreground">Plattform</dt>
                  <dd className="text-right font-medium">{PLATFORMS.find((p) => p.id === platform)?.label}</dd>
                  {previewQuery.data?.postsRemaining != null && (<>
                    <dt className="text-muted-foreground">Innlegg igjen denne måneden</dt>
                    <dd className={`text-right font-medium ${previewQuery.data.postsRemaining < (previewQuery.data.posts ?? 0) ? "text-amber-600" : ""}`}>
                      {previewQuery.data.postsRemaining}
                    </dd>
                  </>)}
                  {previewQuery.data?.imagesRemaining != null && (<>
                    <dt className="text-muted-foreground">Bilder igjen denne måneden</dt>
                    <dd className={`text-right font-medium ${previewQuery.data.imagesRemaining < (previewQuery.data.images ?? 0) ? "text-amber-600" : ""}`}>
                      {previewQuery.data.imagesRemaining}
                    </dd>
                  </>)}
                </dl>
              )}
            </CardContent>
          </Card>
          {previewQuery.data?.postsRemaining != null && previewQuery.data.postsRemaining < previewQuery.data.posts && (
            <p className="text-xs text-amber-600 mb-3" role="status">
              Planen er større enn det du har igjen denne måneden. Vi lager så mange vi kan — resten kan du lage neste periode.
            </p>
          )}
          <p className="text-xs text-muted-foreground mb-4">
            Innleggene lages i bakgrunnen og dukker opp etter hvert. Ingenting publiseres automatisk —
            du godkjenner selv.
          </p>
          {createPlan.isError && (
            <p className="text-sm text-destructive mb-3" role="alert">{createPlan.error.message}</p>
          )}
          <Button
            className="w-full min-h-12 text-base"
            disabled={createPlan.isPending || !goal}
            onClick={() => goal && createPlan.mutate({ goal, platform, postsPerWeek: perWeek, idempotencyKey: idempotencyKey.current })}
          >
            {createPlan.isPending ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" aria-hidden="true" />Lager planen …</> : <><Sparkles className="h-5 w-5 mr-2" aria-hidden="true" />Lag min 4-ukers plan</>}
          </Button>
        </section>
      )}

      {/* Navigasjon */}
      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="ghost"
          className="min-h-11"
          onClick={() => { if (step > 1) setStep((s) => (s - 1) as 1 | 2 | 3); else setCustomising(false); }}
          disabled={createPlan.isPending}
        >
          <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" />Tilbake
        </Button>
        {step < 3 && (
          <Button
            className="min-h-11"
            onClick={() => setStep((s) => ((s + 1) as 1 | 2 | 3))}
            disabled={!canNext}
          >
            Neste<ArrowRight className="h-4 w-4 ml-1" aria-hidden="true" />
          </Button>
        )}
      </div>
    </main>
  );
}
