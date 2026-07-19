import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { BrainCircuit, Check, ExternalLink, Globe2, Loader2, Palette, RefreshCw, Save, Sparkles } from "lucide-react";
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

function ListField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={4} /><p className="text-xs text-muted-foreground">Én per linje eller skill med komma.</p></div>;
}

export default function BrandBrain() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const profileQuery = trpc.brand.get.useQuery();
  const profile = profileQuery.data;
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [tab, setTab] = useState<Tab>("company");
  const [form, setForm] = useState<Editable>(EMPTY);

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

  const steps = useMemo(() => ["Leser nettstedet", "Finner tjenester og målgrupper", "Lærer tone og skrivestil", "Bygger 30 innholdsideer"], []);
  const set = (key: keyof Editable, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const saveProfile = () => save.mutate({
    companyName: form.companyName, industry: form.industry, summary: form.summary,
    offers: list(form.offers), audiences: list(form.audiences), customerProblems: list(form.customerProblems),
    differentiators: list(form.differentiators), tonePersonality: list(form.tonePersonality), writingStyle: form.writingStyle,
    preferredWords: list(form.preferredWords), avoidWords: list(form.avoidWords), callsToAction: list(form.callsToAction), contentPillars: list(form.contentPillars),
  });

  if (profileQuery.isLoading) return <div className="min-h-[60vh] grid place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!profile || profile.status !== "ready") {
    const busy = analyze.isPending;
    return (
      <main className="container max-w-4xl py-8 px-4">
        <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Merkehjerne", current: true }]} className="mb-6" />
        <Card className="overflow-hidden border-primary/20">
          <div className="h-2 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400" />
          <CardContent className="p-8 md:p-12 text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 grid place-items-center mb-6"><BrainCircuit className="h-8 w-8 text-primary" /></div>
            <h1 className="text-3xl font-bold">Bygg bedriftens Merkehjerne</h1>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">Lim inn bedriftens nettsted. Penna leser de viktigste sidene og lager en redigerbar merkeprofil med stemme, målgrupper og innholdsideer.</p>
            {!busy ? (
              <div className="mt-8 max-w-xl mx-auto flex flex-col sm:flex-row gap-3">
                <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://bedriften.no" className="h-12" />
                <Button className="h-12 px-6" disabled={!websiteUrl.trim()} onClick={() => analyze.mutate({ websiteUrl })}><Sparkles className="h-4 w-4 mr-2" />Analyser nettsted</Button>
              </div>
            ) : (
              <div className="mt-8 max-w-md mx-auto text-left space-y-3">{steps.map((step, index) => <div key={step} className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30"><Loader2 className={`h-4 w-4 text-primary ${index === 0 ? "animate-spin" : "animate-pulse"}`} /><span>{step}</span></div>)}</div>
            )}
            {(profile?.lastError || analyze.error) && <p className="mt-5 text-sm text-destructive">{profile?.lastError || analyze.error?.message}</p>}
          </CardContent>
        </Card>
      </main>
    );
  }

  const tabs: Array<[Tab, string]> = [["company", "Bedriften"], ["voice", "Stemme og strategi"], ["ideas", "Innholdsideer"], ["sources", "Kilder"]];
  return (
    <main className="container max-w-6xl py-8 px-4">
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Merkehjerne", current: true }]} className="mb-5" />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div><div className="flex items-center gap-3"><BrainCircuit className="h-8 w-8 text-primary" /><h1 className="text-3xl font-bold">Merkehjerne</h1></div><p className="text-muted-foreground mt-1">{profile.companyName} · Sist analysert {profile.analyzedAt ? new Date(profile.analyzedAt).toLocaleDateString("nb-NO") : "nå"}</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => analyze.mutate({ websiteUrl: profile.websiteUrl })} disabled={analyze.isPending}><RefreshCw className={`h-4 w-4 mr-2 ${analyze.isPending ? "animate-spin" : ""}`} />Analyser på nytt</Button><Button onClick={saveProfile} disabled={save.isPending}><Save className="h-4 w-4 mr-2" />Lagre</Button></div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5">{tabs.map(([value, label]) => <Button key={value} variant={tab === value ? "default" : "outline"} onClick={() => setTab(value)}>{label}</Button>)}</div>

      {tab === "company" && <div className="grid lg:grid-cols-2 gap-5">
        <Card><CardHeader><CardTitle>Bedriftsprofil</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>Bedriftsnavn</Label><Input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} /></div><div className="space-y-2"><Label>Bransje</Label><Input value={form.industry} onChange={(e) => set("industry", e.target.value)} /></div><div className="space-y-2"><Label>Kort beskrivelse</Label><Textarea rows={6} value={form.summary} onChange={(e) => set("summary", e.target.value)} /></div></CardContent></Card>
        <Card><CardHeader><CardTitle>Markedet</CardTitle></CardHeader><CardContent className="space-y-5"><ListField label="Tjenester og tilbud" value={form.offers} onChange={(v) => set("offers", v)} /><ListField label="Målgrupper" value={form.audiences} onChange={(v) => set("audiences", v)} /><ListField label="Kundeproblemer" value={form.customerProblems} onChange={(v) => set("customerProblems", v)} /><ListField label="Det som skiller bedriften" value={form.differentiators} onChange={(v) => set("differentiators", v)} /></CardContent></Card>
      </div>}

      {tab === "voice" && <div className="grid lg:grid-cols-2 gap-5"><Card><CardHeader><CardTitle>Stemme</CardTitle></CardHeader><CardContent className="space-y-5"><ListField label="Personlighet og tone" value={form.tonePersonality} onChange={(v) => set("tonePersonality", v)} /><div className="space-y-2"><Label>Skrivestil</Label><Textarea rows={6} value={form.writingStyle} onChange={(e) => set("writingStyle", e.target.value)} /></div><ListField label="Ord å bruke" value={form.preferredWords} onChange={(v) => set("preferredWords", v)} /><ListField label="Ord å unngå" value={form.avoidWords} onChange={(v) => set("avoidWords", v)} /></CardContent></Card><Card><CardHeader><CardTitle>Innholdsstrategi</CardTitle></CardHeader><CardContent className="space-y-5"><ListField label="Oppfordringer til handling" value={form.callsToAction} onChange={(v) => set("callsToAction", v)} /><ListField label="Innholdspilarer" value={form.contentPillars} onChange={(v) => set("contentPillars", v)} /><div className="rounded-xl border p-4"><h3 className="font-medium flex items-center gap-2"><Palette className="h-4 w-4" />Visuell identitet</h3><div className="flex flex-wrap gap-2 mt-3">{(profile.brandColors ?? []).map((color) => <span key={color} className="inline-flex items-center gap-2 text-xs border rounded-full px-2 py-1"><span className="h-4 w-4 rounded-full border" style={{ backgroundColor: color }} />{color}</span>)}</div><p className="mt-3 text-sm text-muted-foreground">{(profile.brandFonts ?? []).join(" · ") || "Ingen skrifter funnet"}</p></div></CardContent></Card></div>}

      {tab === "ideas" && <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{(profile.contentIdeas ?? []).map((idea, index) => <Card key={`${idea.title}-${index}`} className="flex flex-col"><CardContent className="p-5 flex flex-col flex-1"><span className="text-xs font-medium text-primary">{idea.pillar}</span><h3 className="font-semibold text-lg mt-2">{idea.title}</h3><p className="text-sm text-muted-foreground mt-2 flex-1">{idea.angle}</p><Button className="mt-5" variant="outline" onClick={() => { setEditorHandoff({ topic: `${idea.title}\n\nVinkel: ${idea.angle}`, platform: idea.platform ?? "linkedin", source: "brand-brain" }); navigate("/generer"); }}><Sparkles className="h-4 w-4 mr-2" />Lag innlegg</Button></CardContent></Card>)}</div>}

      {tab === "sources" && <div className="grid lg:grid-cols-2 gap-5"><Card><CardHeader><CardTitle>Kildesider</CardTitle></CardHeader><CardContent className="space-y-3">{(profile.sourceUrls ?? []).map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/50"><span className="truncate text-sm">{url}</span><ExternalLink className="h-4 w-4 shrink-0" /></a>)}</CardContent></Card><Card><CardHeader><CardTitle>Dokumenterte fakta</CardTitle></CardHeader><CardContent className="space-y-3">{(profile.facts ?? []).map((fact, index) => <div key={index} className="rounded-lg border p-3"><p className="text-sm flex gap-2"><Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />{fact.statement}</p><a href={fact.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-primary mt-2 block truncate"><Globe2 className="h-3 w-3 inline mr-1" />{fact.sourceUrl}</a></div>)}</CardContent></Card></div>}
    </main>
  );
}
