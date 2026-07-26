/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * "Legg til merkevare" as a short journey (PR #80).
 *
 *   1. Paste a website address — that is the whole first step.
 *   2. Review what we found: name, services, audience, tone, colours, and the
 *      facts with the page each one came from.
 *   3. Confirm. Only then does the brand become real and get selected.
 *   4. Optional: connect the brand's own social pages.
 *
 * Two things are deliberate. The facts are shown WITH their sources, because a
 * fact the user cannot trace is a fact they cannot check. And nothing is
 * generated before step 3 — the brand stays a `draft` server-side until the user
 * has actually read the profile.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  ExternalLink,
  Globe,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

type Step = "url" | "review" | "connect";

type Props = {
  open: boolean;
  onClose: () => void;
};

const PLATFORMS = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "twitter", label: "X" },
] as const;

/** A list of short strings, or nothing at all when the analysis found none. */
function Chips({ label, items }: { label: string; items: readonly string[] | null | undefined }) {
  const clean = (items ?? []).filter((x) => typeof x === "string" && x.trim());
  if (clean.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {clean.slice(0, 8).map((x, i) => (
          <li key={`${x}-${i}`} className="rounded-md border bg-background px-2 py-1 text-xs">
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AddBrandWizard({ open, onClose }: Props) {
  const utils = trpc.useUtils();
  // Client-side navigation: a raw <a href> is a full reload, which tears down the
  // wizard on the way out. /settings is where the platform connections live —
  // there is no /settings/platforms route.
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>("url");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [brandId, setBrandId] = useState<number | null>(null);
  const [name, setName] = useState("");

  const reset = () => {
    setStep("url");
    setWebsiteUrl("");
    setBrandId(null);
    setName("");
  };

  const journey = trpc.brands.journey.useQuery(
    { brandId: brandId ?? 0 },
    {
      enabled: open && brandId != null && step === "review",
      // startFromUrl REUSES an abandoned draft, so the same brandId recurs across
      // wizard sessions. With the app's global 30s staleTime that served the
      // PREVIOUS site's profile from cache, with no refetch and no spinner —
      // the user reviewed site A's data while believing it was site B's.
      staleTime: 0,
      refetchOnMount: "always",
    },
  );

  const start = trpc.brands.startFromUrl.useMutation({
    onSuccess: (res) => {
      setBrandId(res.brandId);
      setName(res.profile?.companyName ?? "");
      setStep("review");
    },
    onError: (e) => toast.error(e.message),
  });

  const confirm = trpc.brands.confirmFromUrl.useMutation({
    onSuccess: async () => {
      // Switching brand changes every example, list and generator on screen, so
      // drop the whole cache rather than trying to enumerate what depends on it.
      await utils.invalidate();
      toast.success("Merkevaren er klar");
      setStep("connect");
    },
    onError: (e) => toast.error(e.message),
  });

  const discard = trpc.brands.discardDraft.useMutation({
    onSuccess: async () => { await utils.invalidate(); },
    // Nothing to tell the user — the draft is invisible either way — but a silent
    // catch would hide a real server problem from the logs.
    onError: (e) => console.warn("[AddBrandWizard] could not discard draft:", e.message),
  });

  const closeAndReset = () => {
    // Abandoning at the REVIEW step leaves a draft brand behind; clean it up so
    // the next attempt starts fresh instead of resuming a half-analysis.
    //
    // Only at that step: after confirm the brand is active and real, and asking
    // the server to discard it would (correctly) be refused.
    if (step === "review" && brandId != null) discard.mutate({ brandId });
    reset();
    onClose();
  };

  if (!open) return null;

  const profile = journey.data?.profile ?? null;
  const canStart = websiteUrl.trim().length > 3 && !start.isPending;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl rounded-2xl border bg-background shadow-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            {step === "url" && "Legg til merkevare"}
            {step === "review" && "Stemmer dette?"}
            {step === "connect" && "Koble til sidene dine"}
          </h2>
          <button
            type="button"
            onClick={closeAndReset}
            aria-label="Lukk"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* ── Step 1: the address, and nothing else ───────────────────────── */}
          {step === "url" && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (canStart) start.mutate({ websiteUrl: websiteUrl.trim() });
              }}
            >
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Nettadressen til bedriften</span>
                <span className="relative block">
                  <Globe
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    autoFocus
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="bedriften.no"
                    inputMode="url"
                    className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm"
                  />
                </span>
              </label>
              <p className="text-sm text-muted-foreground">
                Vi leser nettsiden og foreslår navn, tjenester, målgruppe, tone og farger. Du får se
                alt før noe opprettes — og ingenting skrives før du har bekreftet.
              </p>
              <Button type="submit" disabled={!canStart} className="w-full gap-2">
                {start.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Leser nettsiden …</>
                  : <>Analyser nettsiden<ArrowRight className="h-4 w-4" /></>}
              </Button>
            </form>
          )}

          {/* ── Step 2: review, with sources ────────────────────────────────── */}
          {step === "review" && (
            <div className="space-y-5">
              {journey.isLoading && (
                <div className="grid place-items-center py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                </div>
              )}

              {profile && (
                <>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium">Navn</span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    />
                  </label>

                  {profile.summary && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Kort om bedriften</p>
                      <p className="mt-1 text-sm leading-relaxed">{profile.summary}</p>
                    </div>
                  )}

                  <Chips label="Tjenester" items={profile.offers} />
                  <Chips label="Målgruppe" items={profile.audiences} />
                  <Chips label="Tone" items={profile.tonePersonality} />

                  {(profile.brandColors ?? []).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Farger</p>
                      <ul className="mt-1.5 flex flex-wrap gap-2">
                        {(profile.brandColors ?? []).slice(0, 8).map((c) => (
                          <li key={c} className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
                            <span
                              className="h-3.5 w-3.5 rounded-sm border"
                              style={{ backgroundColor: c }}
                              aria-hidden="true"
                            />
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Facts carry their source. A claim you cannot trace is a claim
                      you cannot check — and these end up in published posts. */}
                  {(profile.facts ?? []).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Fakta vi fant — med kilde
                      </p>
                      <ul className="mt-1.5 space-y-2">
                        {(profile.facts ?? []).slice(0, 10).map((f, i) => (
                          <li key={i} className="rounded-lg border p-2.5 text-sm">
                            <p>{f.statement}</p>
                            {f.sourceUrl && (
                              <a
                                href={f.sourceUrl}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                              >
                                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                {(() => { try { return new URL(f.sourceUrl).hostname; } catch { return f.sourceUrl; } })()}
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(profile.injectionWarnings ?? []).length > 0 && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                      <p className="text-muted-foreground">
                        Deler av nettsiden ble ignorert fordi innholdet forsøkte å styre analysen.
                        Sjekk gjerne at listene over ser riktige ut.
                      </p>
                    </div>
                  )}
                </>
              )}

              {journey.isError && (
                <div className="rounded-xl border border-destructive/40 p-4 text-sm">
                  <p className="text-muted-foreground">
                    Kunne ikke hente analysen. Utkastet kan ha blitt forkastet i en annen fane.
                  </p>
                  <button
                    type="button"
                    onClick={() => { reset(); }}
                    className="mt-2 font-medium underline underline-offset-2"
                  >
                    Start på nytt
                  </button>
                </div>
              )}

              {journey.data && !profile && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Fant ingen profil for denne merkevaren. Prøv en annen nettadresse.
                </p>
              )}
            </div>
          )}

          {/* ── Step 3: optional connections ────────────────────────────────── */}
          {step === "connect" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Merkevaren er opprettet og valgt. Vil du koble til sidene den skal publisere fra? Du
                kan hoppe over dette og gjøre det senere.
              </p>
              <ul className="space-y-2">
                {PLATFORMS.map((p) => (
                  <li
                    key={p.key}
                    className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5"
                  >
                    <span className="text-sm font-medium">{p.label}</span>
                    <button
                      type="button"
                      onClick={() => { reset(); onClose(); setLocation("/settings"); }}
                      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      Koble til konto
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          {step === "review" && (
            <>
              <Button variant="ghost" onClick={closeAndReset}>Avbryt</Button>
              <Button
                disabled={!profile || profile.status !== "ready" || confirm.isPending || !name.trim()}
                onClick={() => brandId != null && confirm.mutate({ brandId, name: name.trim() })}
                className="gap-2"
              >
                {confirm.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Oppretter …</>
                  : <><BadgeCheck className="h-4 w-4" aria-hidden="true" />Bekreft og opprett</>}
              </Button>
            </>
          )}
          {step === "connect" && (
            <Button onClick={() => { reset(); onClose(); }}>Ferdig</Button>
          )}
        </div>
      </div>
    </div>
  );
}
