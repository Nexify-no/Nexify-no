import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle, BadgeCheck, Ban, BrainCircuit, Check, ExternalLink, FileSearch, Globe2,
  Loader2, Palette, Plus, Quote, RefreshCw, Save, ShieldAlert, Sparkles, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { setEditorHandoff } from "@/lib/editorHandoff";
import { trpc } from "@/lib/trpc";

type Tab = "company" | "voice" | "ideas" | "sources";
type FactUi = { statement: string; sourceUrl: string; evidenceQuote?: string };
type Editable = {
  companyName: string; industry: string; summary: string; offers: string;
  audiences: string; customerProblems: string; differentiators: string;
  tonePersonality: string; writingStyle: string; preferredWords: string;
  avoidWords: string; callsToAction: string; contentPillars: string;
};

const EMPTY: Editable = {
  companyName: "", industry: "", summary: "", offers: "", audiences: "",
  customerProblems: "", differentiators: "", tonePersonality: "", writingStyle: "",
  preferredWords: "", avoidWords: "", callsToAction: "", contentPillars: "",
};
const list = (value: string) => value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
const lines = (value: unknown) => Array.isArray(value) ? value.join("\n") : "";

/** Classify a failed analysis from its stored public message (worker never leaks codes). */
function failureKind(message?: string | null): "blocked" | "empty" | "unsafe" | "busy" | "failed" {
  const m = (message ?? "").toLowerCase();
  if (m.includes("tillater ikke")) return "blocked";
  if (m.includes("lesbart innhold") || m.includes("nok innhold")) return "empty";
  if (m.includes("sikkerhetsgrunner") || m.includes("nettadressen kan ikke")) return "unsafe";
  if (m.includes("opptatt")) return "busy";
  return "failed";
}

function ListField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={4} /><p className="text-xs text-muted-foreground">Én per linje eller skill med komma.</p></div>;
}

/**
 * The Merkehjerne on screen describes a different company than the brand it is
 * attached to.
 *
 * This is not a style warning — it is the difference between publishing your own
 * voice and publishing someone else's. It happened: legacy adoption stamped an
 * unowned Merkehjerne onto whichever brand was active, so a brand named Penna.no
 * carried a Merkehjerne built from ballongforfest.no, and every post generated
 * for it went out in a balloon company's words. Red, not amber, and it names the
 * company it actually found so the user can see the mismatch rather than take our
 * word for it.
 */
function brandMismatchBanner(describes: string | null, brandName: string | null) {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/5 p-4">
      <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
      <div className="space-y-1 text-sm">
        <p className="font-medium">
          Denne Merkehjernen beskriver {describes ? <>«{describes}»</> : "en annen bedrift"}
          {brandName ? <> — ikke «{brandName}»</> : null}.
        </p>
        <p className="text-muted-foreground">
          Innlegg for denne merkevaren blir skrevet med feil stemme, tjenester og målgruppe.
          Kjør «Analyser på nytt» med riktig nettadresse før du publiserer noe.
        </p>
      </div>
    </div>
  );
}

function needsReviewBanner(warningCount: number, factCount: number) {
  if (warningCount === 0 && factCount > 0) return null;
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <p className="text-sm">
        Se ekstra nøye gjennom dette.{warningCount > 0 ? ` Vi filtrerte bort mistenkelig instruksjonstekst fra ${warningCount} kilde(r).` : ""}
        {factCount === 0 ? " Vi fant ingen dokumenterte fakta med kildesitat." : ""}
      </p>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="container max-w-4xl py-8 px-4">
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Merkehjerne", current: true }]} className="mb-6" />
      {children}
    </main>
  );
}

export default function BrandBrain() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  // Server is source of truth: poll while a scan is running so the view updates
  // even after a reload (the analyze mutation may no longer be pending).
  const profileQuery = trpc.brand.get.useQuery(undefined, {
    refetchInterval: (query) => (query.state.data?.status === "analyzing" ? 3_000 : false),
    refetchIntervalInBackground: false,
  });
  const profile = profileQuery.data;
  // Only to NAME the brand in the mismatch banner — the mismatch itself is
  // decided server-side, against the row the generator actually reads.
  const brandsQuery = trpc.brands.list.useQuery(undefined, {
    enabled: Boolean((profile as any)?.brandMismatch),
    staleTime: 60 * 1000,
  });
  const activeBrandName =
    brandsQuery.data?.brands?.find((b: any) => b.id === brandsQuery.data?.activeBrandId)?.name ?? null;
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [tab, setTab] = useState<Tab>("company");
  const [form, setForm] = useState<Editable>(EMPTY);
  const [newFact, setNewFact] = useState("");
  // MB3: lets the user skip the confirm screen and edit fields directly.
  const [forceEdit, setForceEdit] = useState(false);
  // "Analyser på nytt" used to re-run profile.websiteUrl with no way to change it.
  // That made the one instruction the mismatch banner gives — analyse the RIGHT
  // address — impossible to follow: a Merkehjerne built from the wrong site could
  // only ever be rebuilt from the wrong site. Opening an editable address is the
  // whole fix.
  const [reanalyzeOpen, setReanalyzeOpen] = useState(false);
  const [reanalyzeUrl, setReanalyzeUrl] = useState("");

  useEffect(() => {
    if (!profile) return;
    setWebsiteUrl(profile.websiteUrl ?? "");
    setForm({
      companyName: profile.companyName ?? "", industry: profile.industry ?? "", summary: profile.summary ?? "",
      offers: lines(profile.offers), audiences: lines(profile.audiences), customerProblems: lines(profile.customerProblems),
      differentiators: lines(profile.differentiators), tonePersonality: lines(profile.tonePersonality),
      writingStyle: profile.writingStyle ?? "", preferredWords: lines(profile.preferredWords),
      avoidWords: lines(profile.avoidWords), callsToAction: lines(profile.callsToAction), contentPillars: lines(profile.contentPillars),
    });
  }, [profile]);

  const analyze = trpc.brand.analyze.useMutation({
    onSuccess: async () => { await utils.brand.get.invalidate(); toast.success("Merkehjernen er klar!"); },
    onError: (error) => toast.error(error.message),
  });
  const save = trpc.brand.update.useMutation({
    onSuccess: async () => { await utils.brand.get.invalidate(); toast.success("Endringene er lagret"); },
    onError: (error) => toast.error(error.message),
  });
  const confirmBrain = trpc.brand.confirm.useMutation({
    onSuccess: async () => { await utils.brand.get.invalidate(); toast.success("Merkehjernen er bekreftet"); },
    onError: (error) => toast.error(error.message),
  });
  const saveFacts = trpc.brand.setFacts.useMutation({
    onSuccess: async () => { await utils.brand.get.invalidate(); },
    onError: (error) => toast.error(error.message),
  });

  const steps = useMemo(() => ["Leser nettstedet", "Finner tjenester og målgrupper", "Lærer tone og skrivestil", "Bygger 30 innholdsideer"], []);
  const set = (key: keyof Editable, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const runAnalyze = (url: string) => analyze.mutate({ websiteUrl: url });
  const saveProfile = () => save.mutate({
    companyName: form.companyName, industry: form.industry, summary: form.summary,
    offers: list(form.offers), audiences: list(form.audiences), customerProblems: list(form.customerProblems),
    differentiators: list(form.differentiators), tonePersonality: list(form.tonePersonality), writingStyle: form.writingStyle,
    preferredWords: list(form.preferredWords), avoidWords: list(form.avoidWords), callsToAction: list(form.callsToAction), contentPillars: list(form.contentPillars),
  });

  // Prefill with the address on the profile — usually right, and when it is wrong
  // seeing it is what tells the user so.
  useEffect(() => {
    if (profile?.websiteUrl && !reanalyzeUrl) setReanalyzeUrl(profile.websiteUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.websiteUrl]);

  const reanalyzeRow = () => (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input
        value={reanalyzeUrl}
        onChange={(e) => setReanalyzeUrl(e.target.value)}
        placeholder="https://bedriften.no"
        className="sm:max-w-sm"
        aria-label="Nettadresse å analysere"
      />
      <Button
        onClick={() => runAnalyze(reanalyzeUrl)}
        disabled={!reanalyzeUrl.trim() || analyze.isPending}
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${analyze.isPending ? "animate-spin" : ""}`} />
        {analyze.isPending ? "Analyserer …" : "Analyser denne adressen"}
      </Button>
    </div>
  );

  const manifest = (profile?.sourceManifest ?? []) as Array<{ url: string; title: string; chars: number; suspiciousPromptText: boolean }>;
  const warnings = (profile?.injectionWarnings ?? []) as string[];
  const facts = (profile?.facts ?? []) as FactUi[];
  const removeFact = (index: number) => saveFacts.mutate({ facts: facts.filter((_, i) => i !== index) });
  const addFact = () => {
    const statement = newFact.trim();
    if (!statement) return;
    saveFacts.mutate({ facts: [...facts, { statement, sourceUrl: "" }] }, { onSuccess: () => setNewFact("") });
  };

  if (profileQuery.isLoading) {
    return <div className="min-h-[60vh] grid place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const analyzing = profile?.status === "analyzing" || analyze.isPending;

  // ── STATE: analyzing ──────────────────────────────────────────────────────
  if (analyzing) {
    return (
      <Shell>
        <Card className="overflow-hidden border-primary/20">
          <div className="h-2 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400" />
          <CardContent className="p-8 md:p-12 text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 grid place-items-center mb-6"><Loader2 className="h-8 w-8 text-primary animate-spin" /></div>
            <h1 className="text-2xl md:text-3xl font-bold">Vi bygger bedriftens Merkehjerne …</h1>
            <p className="mt-3 text-muted-foreground">Dette tar vanligvis under et minutt. Du kan trygt vente her.</p>
            <div className="mt-8 max-w-md mx-auto text-left space-y-3">
              {steps.map((step, index) => <div key={step} className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30"><Loader2 className={`h-4 w-4 text-primary ${index === 0 ? "animate-spin" : "animate-pulse"}`} /><span>{step}</span></div>)}
            </div>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  // ── STATE: failed / site-blocked / not-enough-content / unsafe ────────────
  if (profile?.status === "failed") {
    const kind = failureKind(profile.lastError);
    const meta: Record<string, { icon: ReactNode; title: string; hint: string }> = {
      blocked: { icon: <Ban className="h-8 w-8 text-amber-600" />, title: "Nettstedet tillater ikke automatisk lesing", hint: "Siden blokkerer roboter i robots.txt. Prøv en annen offentlig side, eller legg inn informasjonen manuelt." },
      empty: { icon: <FileSearch className="h-8 w-8 text-amber-600" />, title: "Vi fant ikke nok innhold", hint: "Nettstedet ga for lite lesbar tekst (kan være tungt JavaScript-basert). Prøv en annen side eller fyll inn manuelt." },
      unsafe: { icon: <ShieldAlert className="h-8 w-8 text-destructive" />, title: "Nettadressen kan ikke analyseres", hint: "Adressen ble avvist av sikkerhetsgrunner. Bruk en vanlig offentlig https-adresse til bedriftens nettsted." },
      busy: { icon: <AlertTriangle className="h-8 w-8 text-amber-600" />, title: "Analysetjenesten er opptatt", hint: "Prøv igjen om et lite øyeblikk." },
      failed: { icon: <AlertTriangle className="h-8 w-8 text-destructive" />, title: "Analysen mislyktes", hint: "Noe gikk galt under analysen. Prøv igjen, eller fyll inn informasjonen manuelt." },
    };
    const m = meta[kind];
    return (
      <Shell>
        <Card className="overflow-hidden">
          <CardContent className="p-8 md:p-12 text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-muted grid place-items-center mb-6">{m.icon}</div>
            <h1 className="text-2xl font-bold">{m.title}</h1>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">{m.hint}</p>
            <div className="mt-8 max-w-xl mx-auto flex flex-col sm:flex-row gap-3">
              <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://bedriften.no" className="h-12" />
              <Button className="h-12 px-6" disabled={!websiteUrl.trim() || analyze.isPending} onClick={() => runAnalyze(websiteUrl)}><RefreshCw className="h-4 w-4 mr-2" />Prøv igjen</Button>
            </div>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  // ── STATE: not started ────────────────────────────────────────────────────
  if (!profile || profile.status !== "ready") {
    return (
      <Shell>
        <Card className="overflow-hidden border-primary/20">
          <div className="h-2 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400" />
          <CardContent className="p-8 md:p-12 text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 grid place-items-center mb-6"><BrainCircuit className="h-8 w-8 text-primary" /></div>
            <h1 className="text-3xl font-bold">Bygg bedriftens Merkehjerne</h1>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">Lim inn bedriftens nettsted. Penna leser de viktigste sidene og lager en redigerbar merkeprofil med stemme, målgrupper og innholdsideer — så slipper du å skrive alt selv.</p>
            <div className="mt-8 max-w-xl mx-auto flex flex-col sm:flex-row gap-3">
              <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://bedriften.no" className="h-12" />
              <Button className="h-12 px-6" disabled={!websiteUrl.trim()} onClick={() => runAnalyze(websiteUrl)}><Sparkles className="h-4 w-4 mr-2" />Analyser nettsted</Button>
            </div>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  // ── STATE: analysed but NOT confirmed → review screen (MB3) ───────────────
  // Nothing is generated from a brand until the user has seen and confirmed what
  // we read from the website.
  if (!profile.confirmedAt && !forceEdit) {
    const line = (label: string, value: string) =>
      value ? (
        <div key={label} className="flex flex-col gap-0.5 py-2 border-b last:border-b-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-sm">{value}</dd>
        </div>
      ) : null;
    const joined = (v: unknown, n = 6) =>
      Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string").slice(0, n).join(" · ") : "";
    const colors = (profile.brandColors ?? []) as string[];
    return (
      <Shell>
        <div className="flex items-center gap-3 mb-1">
          <BrainCircuit className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">Stemmer dette?</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Dette fant vi på {profile.websiteUrl}. Bekreft før vi lager innhold — du kan endre alt senere.
        </p>

        {(profile as any).brandMismatch
          ? brandMismatchBanner((profile as any).profileDescribes ?? null, activeBrandName)
          : null}
        {needsReviewBanner(warnings.length, facts.length)}

        <Card className="mb-4">
          <CardContent className="p-5">
            <dl>
              {line("Bedrift", profile.companyName ?? "")}
              {line("Bransje", profile.industry ?? "")}
              {line("Beskrivelse", profile.summary ?? "")}
              {line("Tjenester", joined(profile.offers))}
              {line("Målgrupper", joined(profile.audiences))}
              {line("Tone", joined(profile.tonePersonality))}
              {line("Skrivestil", profile.writingStyle ?? "")}
            </dl>
            {colors.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-3">
                <span className="text-xs text-muted-foreground">Farger</span>
                {colors.slice(0, 6).map((c) => (
                  <span key={c} className="inline-flex items-center gap-1.5 text-xs border rounded-full px-2 py-1">
                    <span className="h-3.5 w-3.5 rounded-full border" style={{ backgroundColor: c }} />
                    {c}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-5">
          <CardHeader><CardTitle className="text-base">Fakta og kilder</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {facts.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Vi fant ingen dokumenterte fakta med kildesitat. Du kan legge inn nøkkelinfo selv etterpå.
              </p>
            )}
            {facts.slice(0, 5).map((fact, index) => (
              <div key={index} className="rounded-lg border p-3">
                <p className="text-sm flex gap-2"><Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />{fact.statement}</p>
                {fact.evidenceQuote && (
                  <p className="mt-2 flex gap-2 text-xs text-muted-foreground italic">
                    <Quote className="h-3 w-3 shrink-0 mt-0.5" />«{fact.evidenceQuote}»
                  </p>
                )}
                {fact.sourceUrl && (
                  <a href={fact.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-primary mt-2 block truncate">
                    <Globe2 className="h-3 w-3 inline mr-1" />{fact.sourceUrl}
                  </a>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => confirmBrain.mutate()} disabled={confirmBrain.isPending}>
            <BadgeCheck className="h-4 w-4 mr-2" />
            {confirmBrain.isPending ? "Bekrefter …" : "Bekreft og lag innhold"}
          </Button>
          <Button variant="outline" onClick={() => setForceEdit(true)}>Rediger informasjonen</Button>
          <Button variant="outline" onClick={() => setReanalyzeOpen((open) => !open)} disabled={analyze.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${analyze.isPending ? "animate-spin" : ""}`} />
            Analyser på nytt
          </Button>
        </div>
        {reanalyzeOpen ? reanalyzeRow() : null}
      </Shell>
    );
  }

  // ── STATE: ready (+ needs-review banner) ──────────────────────────────────
  const needsReview = warnings.length > 0 || facts.length === 0;
  const tabs: Array<[Tab, string]> = [["company", "Bedriften"], ["voice", "Stemme og strategi"], ["ideas", "Innholdsideer"], ["sources", "Fakta og kilder"]];
  return (
    <main className="container max-w-6xl py-8 px-4">
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Merkehjerne", current: true }]} className="mb-5" />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div><div className="flex items-center gap-3"><BrainCircuit className="h-8 w-8 text-primary" /><h1 className="text-3xl font-bold">Merkehjerne</h1></div><p className="text-muted-foreground mt-1">{profile.companyName} · Sist analysert {profile.analyzedAt ? new Date(profile.analyzedAt).toLocaleDateString("nb-NO") : "nå"}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          {profile.confirmedAt
            ? <span className="inline-flex items-center gap-2 text-sm text-green-700 bg-green-500/10 border border-green-500/30 rounded-full px-3 py-1.5"><BadgeCheck className="h-4 w-4" />Bekreftet {new Date(profile.confirmedAt).toLocaleDateString("nb-NO")}</span>
            : <Button onClick={() => confirmBrain.mutate()} disabled={confirmBrain.isPending}><BadgeCheck className="h-4 w-4 mr-2" />Bekreft Merkehjerne</Button>}
          <Button variant="outline" onClick={() => setReanalyzeOpen((open) => !open)} disabled={analyze.isPending}><RefreshCw className={`h-4 w-4 mr-2 ${analyze.isPending ? "animate-spin" : ""}`} />Analyser på nytt</Button>
          <Button variant="outline" onClick={saveProfile} disabled={save.isPending}><Save className="h-4 w-4 mr-2" />Lagre</Button>
        </div>
      </div>
      {reanalyzeOpen ? <div className="mb-6">{reanalyzeRow()}</div> : null}
      {(profile as any).brandMismatch
        ? brandMismatchBanner((profile as any).profileDescribes ?? null, activeBrandName)
        : null}

      {needsReview && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm">Se gjennom profilen før du bruker den. {warnings.length > 0 ? `Vi filtrerte bort mistenkelig instruksjonstekst fra ${warnings.length} kilde(r). ` : ""}{facts.length === 0 ? "Vi fant ingen dokumenterte fakta med kildesitat — vurder å legge inn nøkkelinfo manuelt." : ""}</p>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2 mb-5">{tabs.map(([value, label]) => <Button key={value} variant={tab === value ? "default" : "outline"} onClick={() => setTab(value)}>{label}</Button>)}</div>

      {tab === "company" && <div className="grid lg:grid-cols-2 gap-5">
        <Card><CardHeader><CardTitle>Bedriftsprofil</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>Bedriftsnavn</Label><Input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} /></div><div className="space-y-2"><Label>Bransje</Label><Input value={form.industry} onChange={(e) => set("industry", e.target.value)} /></div><div className="space-y-2"><Label>Kort beskrivelse</Label><Textarea rows={6} value={form.summary} onChange={(e) => set("summary", e.target.value)} /></div></CardContent></Card>
        <Card><CardHeader><CardTitle>Markedet</CardTitle></CardHeader><CardContent className="space-y-5"><ListField label="Tjenester og tilbud" value={form.offers} onChange={(v) => set("offers", v)} /><ListField label="Målgrupper" value={form.audiences} onChange={(v) => set("audiences", v)} /><ListField label="Kundeproblemer" value={form.customerProblems} onChange={(v) => set("customerProblems", v)} /><ListField label="Det som skiller bedriften" value={form.differentiators} onChange={(v) => set("differentiators", v)} /></CardContent></Card>
      </div>}

      {tab === "voice" && <div className="grid lg:grid-cols-2 gap-5"><Card><CardHeader><CardTitle>Stemme</CardTitle></CardHeader><CardContent className="space-y-5"><ListField label="Personlighet og tone" value={form.tonePersonality} onChange={(v) => set("tonePersonality", v)} /><div className="space-y-2"><Label>Skrivestil</Label><Textarea rows={6} value={form.writingStyle} onChange={(e) => set("writingStyle", e.target.value)} /></div><ListField label="Ord å bruke" value={form.preferredWords} onChange={(v) => set("preferredWords", v)} /><ListField label="Ord å unngå" value={form.avoidWords} onChange={(v) => set("avoidWords", v)} /></CardContent></Card><Card><CardHeader><CardTitle>Innholdsstrategi</CardTitle></CardHeader><CardContent className="space-y-5"><ListField label="Oppfordringer til handling" value={form.callsToAction} onChange={(v) => set("callsToAction", v)} /><ListField label="Innholdspilarer" value={form.contentPillars} onChange={(v) => set("contentPillars", v)} /><div className="rounded-xl border p-4"><h3 className="font-medium flex items-center gap-2"><Palette className="h-4 w-4" />Visuell identitet</h3><div className="flex flex-wrap gap-2 mt-3">{(profile.brandColors ?? []).map((color) => <span key={color} className="inline-flex items-center gap-2 text-xs border rounded-full px-2 py-1"><span className="h-4 w-4 rounded-full border" style={{ backgroundColor: color }} />{color}</span>)}</div><p className="mt-3 text-sm text-muted-foreground">{(profile.brandFonts ?? []).join(" · ") || "Ingen skrifter funnet"}</p></div></CardContent></Card></div>}

      {tab === "ideas" && <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{(profile.contentIdeas ?? []).map((idea, index) => <Card key={`${idea.title}-${index}`} className="flex flex-col"><CardContent className="p-5 flex flex-col flex-1"><span className="text-xs font-medium text-primary">{idea.pillar}</span><h3 className="font-semibold text-lg mt-2">{idea.title}</h3><p className="text-sm text-muted-foreground mt-2 flex-1">{idea.angle}</p><Button className="mt-5" variant="outline" onClick={() => { setEditorHandoff({ topic: `${idea.title}\n\nVinkel: ${idea.angle}`, platform: idea.platform ?? "linkedin", source: "brand-brain" }); navigate("/generer"); }}><Sparkles className="h-4 w-4 mr-2" />Lag innlegg</Button></CardContent></Card>)}</div>}

      {tab === "sources" && <div className="grid lg:grid-cols-2 gap-5">
        <Card><CardHeader><CardTitle>Analyserte sider</CardTitle></CardHeader><CardContent className="space-y-3">
          {manifest.length === 0 && <p className="text-sm text-muted-foreground">Ingen kildesider registrert.</p>}
          {manifest.map((src, index) => <div key={`${src.url}-${index}`} className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium truncate">{src.title || src.url}</span><a href={src.url} target="_blank" rel="noreferrer" className="shrink-0 text-muted-foreground hover:text-primary"><ExternalLink className="h-4 w-4" /></a></div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Globe2 className="h-3 w-3" /><span className="truncate">{src.url}</span></div>
            <div className="mt-1 flex items-center gap-2 text-xs">{src.chars.toLocaleString("nb-NO")} tegn lest{src.suspiciousPromptText && <span className="inline-flex items-center gap-1 text-amber-600"><ShieldAlert className="h-3 w-3" />filtrert tekst</span>}</div>
          </div>)}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Dokumenterte fakta</CardTitle></CardHeader><CardContent className="space-y-3">
          {facts.length === 0 && <p className="text-sm text-muted-foreground">Ingen fakta med kildesitat ennå. Legg gjerne inn nøkkelinfo manuelt nedenfor.</p>}
          {facts.map((fact, index) => <div key={index} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm flex gap-2"><Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />{fact.statement}</p>
              <button type="button" onClick={() => removeFact(index)} disabled={saveFacts.isPending} className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-50" aria-label="Slett faktum"><Trash2 className="h-4 w-4" /></button>
            </div>
            {fact.evidenceQuote && <p className="mt-2 flex gap-2 text-xs text-muted-foreground italic"><Quote className="h-3 w-3 shrink-0 mt-0.5" />«{fact.evidenceQuote}»</p>}
            {fact.sourceUrl
              ? <a href={fact.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-primary mt-2 block truncate"><Globe2 className="h-3 w-3 inline mr-1" />{fact.sourceUrl}</a>
              : <span className="text-xs text-muted-foreground mt-2 block">Lagt til manuelt</span>}
          </div>)}
          <div className="flex gap-2 pt-1">
            <Input value={newFact} onChange={(e) => setNewFact(e.target.value)} placeholder="Legg til et faktum om bedriften …" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFact(); } }} />
            <Button variant="outline" onClick={addFact} disabled={saveFacts.isPending || !newFact.trim()}><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent></Card>
      </div>}
    </main>
  );
}
