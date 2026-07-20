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
  const [goal, setGoal] = useState<Goal | null>(null);
  const [perWeek, setPerWeek] = useState<PerWeek>(3);
  const [platform, setPlatform] = useState<Platform>("linkedin");
  const idempotencyKey = useRef(`enkel-${(globalThis.crypto?.randomUUID?.() ?? String(Date.now()) + Math.random().toString(36).slice(2))}`);

  const previewQuery = trpc.plan.preview.useQuery(
    { goal: (goal ?? "mixed") as Goal, platform, postsPerWeek: perWeek },
    { enabled: step === 3 && !!goal },
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

  return (
    <main className="container max-w-2xl py-6 md:py-8" lang="nb">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Lag din 4-ukers innholdsplan</h1>
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
                  <dt className="text-muted-foreground">Periode</dt>
                  <dd className="text-right font-medium">4 uker</dd>
                  <dt className="text-muted-foreground">Innlegg</dt>
                  <dd className="text-right font-medium">{previewQuery.data?.posts ?? FREQ.find((f) => f.perWeek === perWeek)?.posts}</dd>
                  <dt className="text-muted-foreground">Bilder</dt>
                  <dd className="text-right font-medium">{previewQuery.data?.images ?? previewQuery.data?.posts}</dd>
                  <dt className="text-muted-foreground">Plattform</dt>
                  <dd className="text-right font-medium">{PLATFORMS.find((p) => p.id === platform)?.label}</dd>
                </dl>
              )}
            </CardContent>
          </Card>
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
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
          disabled={step === 1 || createPlan.isPending}
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
