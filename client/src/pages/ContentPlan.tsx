/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Din 4-ukers innholdsplan (Enkel-modus — bak FEATURE_ENKEL_PLAN).
 * Fase 1c: read-only uker/kort/fremdrift med backoff-polling.
 * Fase 2: ett bilde per innlegg (skeleton/bilde/Bytt bilde).
 * Fase 3b: godkjenn / rediger / fjern per innlegg + toppknapper «Godkjenn alle»
 * og «Lagre i Mine innlegg» (kopierer godkjente innlegg til posts som UTKAST —
 * ingenting publiseres eller planlegges automatisk). Server er kilde til
 * sannhet; høyrisiko-innlegg kan ikke godkjennes. Mobil først.
 */
import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarDays, Check, CheckCheck, ChevronDown, ChevronUp, ImageOff,
  Loader2, Pencil, RefreshCw, Save, Trash2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  intro: "Presentasjon",
  problem: "Problem → løsning",
  tips: "Tips",
  question: "Spørsmål",
  case: "Kundecase",
  behind_scenes: "Bak kulissene",
  faq: "FAQ",
  cta: "Ta kontakt",
  seasonal: "Sesong",
  offer: "Tilbud",
};

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { text: string; cls: string }> = {
    pending: { text: "I kø", cls: "bg-muted text-muted-foreground" },
    generating: { text: "Skrives …", cls: "bg-primary/10 text-primary" },
    done: { text: "Klar", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    failed: { text: "Feilet", cls: "bg-destructive/10 text-destructive" },
  };
  const m = map[status] ?? map.pending;
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", m.cls)}>{m.text}</span>;
}

function formatDate(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" });
}

/** One post's image slot: skeleton while loading, image when ready, action on failed/skipped. */
function PostImage({
  planId,
  post,
}: {
  planId: number;
  post: { id: number; imageUrl: string | null; imageStatus: string; generationStatus: string };
}) {
  const utils = trpc.useUtils();
  const regenerate = trpc.plan.regenerateImage.useMutation({
    onSettled: () => { void utils.plan.get.invalidate({ planId }); },
  });
  const busy = regenerate.isPending;
  const status = busy ? "generating" : post.imageStatus;
  const onRegenerate = () => regenerate.mutate({ planId, plannedPostId: post.id });

  if (status === "pending" || status === "generating" || status === "verifying") {
    return (
      <div className="mt-3 aspect-[16/10] w-full rounded-md bg-muted animate-pulse flex items-center justify-center" aria-label="Bildet lages">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }
  if (status === "completed" && post.imageUrl) {
    return (
      <div className="mt-3">
        <img src={post.imageUrl} alt="Illustrasjon til innlegget" loading="lazy" className="aspect-[16/10] w-full rounded-md object-cover bg-muted" />
        <Button variant="ghost" size="sm" className="mt-1 h-11 px-2 text-xs text-muted-foreground" onClick={onRegenerate} disabled={busy} aria-label="Lag et nytt bilde til dette innlegget">
          <RefreshCw className="h-3.5 w-3.5 mr-1" aria-hidden="true" />Bytt bilde
        </Button>
      </div>
    );
  }
  if (post.generationStatus !== "done") return null;
  const reason = status === "skipped" ? "Bilde ikke inkludert." : status === "failed" ? "Bildet kunne ikke lages." : "Ingen bilde ennå.";
  return (
    <div className="mt-3 rounded-md border border-dashed border-muted-foreground/25 p-3 flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
        <ImageOff className="h-3.5 w-3.5" aria-hidden="true" />{reason}
      </span>
      <Button variant="outline" size="sm" className="h-11 text-xs shrink-0" onClick={onRegenerate} disabled={busy} aria-label="Lag et bilde til dette innlegget">
        <RefreshCw className="h-3.5 w-3.5 mr-1" aria-hidden="true" />Lag bilde
      </Button>
    </div>
  );
}

interface PostRow {
  id: number;
  weekNumber: number;
  suggestedDate: string | Date;
  platform: string;
  contentType: string;
  generationStatus: string;
  approvalStatus: string;
  verificationStatus: string;
  content: string | null;
  reason: string | null;
  imageUrl: string | null;
  imageStatus: string;
  savedPostId: number | null;
}

/** One post card: content, image, and Fase 3b actions (godkjenn / rediger / fjern). */
function PostCard({ planId, post }: { planId: number; post: PostRow }) {
  const utils = trpc.useUtils();
  const invalidate = () => { void utils.plan.get.invalidate({ planId }); };
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const approve = trpc.plan.approve.useMutation({ onSettled: invalidate });
  const unapprove = trpc.plan.unapprove.useMutation({ onSettled: invalidate });
  const editPost = trpc.plan.editPost.useMutation({ onSuccess: () => { setEditing(false); invalidate(); } });
  const removePost = trpc.plan.removePost.useMutation({ onSettled: invalidate });

  const busy = approve.isPending || unapprove.isPending || editPost.isPending || removePost.isPending;
  const approved = post.approvalStatus === "approved";
  const saved = post.savedPostId != null;
  const canApprove = post.generationStatus === "done" && post.verificationStatus !== "high_risk";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-xs font-medium text-muted-foreground capitalize">{formatDate(post.suggestedDate)}</span>
          <span className="text-xs rounded-full bg-muted px-2 py-0.5">{PLATFORM_LABELS[post.platform] ?? post.platform}</span>
          <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5">{TYPE_LABELS[post.contentType] ?? post.contentType}</span>
          <StatusBadge status={post.generationStatus} />
          {approved && (
            <span className="text-xs rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 inline-flex items-center gap-1">
              <Check className="h-3 w-3" aria-hidden="true" />{saved ? "Lagret" : "Godkjent"}
            </span>
          )}
          {post.verificationStatus === "high_risk" && (
            <span className="text-xs rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5">Sjekk manuelt</span>
          )}
        </div>

        {post.reason && <p className="text-xs text-muted-foreground mb-2">{post.reason}</p>}

        {post.generationStatus === "generating" && (
          <div className="h-16 rounded-md bg-muted animate-pulse" aria-label="Innlegget skrives" />
        )}
        {post.generationStatus === "failed" && (
          <p className="text-xs text-destructive">Dette innlegget kunne ikke lages.</p>
        )}

        {post.generationStatus === "done" && post.content && !editing && (
          <div>
            <p className={cn("text-sm whitespace-pre-wrap", !open && "line-clamp-3")}>{post.content}</p>
            <Button variant="ghost" size="sm" className="mt-1 h-11 px-2 text-xs text-primary" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? "Vis mindre av innlegget" : "Vis hele innlegget"}>
              {open ? <><ChevronUp className="h-3.5 w-3.5 mr-1" aria-hidden="true" />Vis mindre</> : <><ChevronDown className="h-3.5 w-3.5 mr-1" aria-hidden="true" />Vis mer</>}
            </Button>
          </div>
        )}

        {editing && (
          <div>
            <textarea
              className="w-full min-h-32 rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Rediger innlegget"
            />
            {editPost.isError && <p className="text-xs text-destructive mt-1" role="alert">{editPost.error.message}</p>}
            <div className="flex gap-2 mt-2">
              <Button size="sm" className="h-11" disabled={busy || draft.trim().length === 0} onClick={() => editPost.mutate({ planId, plannedPostId: post.id, content: draft.trim() })}>
                <Save className="h-3.5 w-3.5 mr-1" aria-hidden="true" />Lagre endring
              </Button>
              <Button size="sm" variant="ghost" className="h-11" disabled={busy} onClick={() => setEditing(false)}>
                <X className="h-3.5 w-3.5 mr-1" aria-hidden="true" />Avbryt
              </Button>
            </div>
          </div>
        )}

        {post.generationStatus === "done" && !!post.content && <PostImage planId={planId} post={post} />}

        {/* Handlinger */}
        {post.generationStatus === "done" && !!post.content && !editing && (
          <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
            {approved ? (
              <Button size="sm" variant="outline" className="h-11 text-xs" disabled={busy || saved} onClick={() => unapprove.mutate({ planId, plannedPostId: post.id })}>
                Angre godkjenning
              </Button>
            ) : (
              <Button size="sm" className="h-11 text-xs" disabled={busy || !canApprove} onClick={() => approve.mutate({ planId, plannedPostId: post.id })} title={!canApprove ? "Kan ikke godkjennes automatisk" : undefined}>
                <Check className="h-3.5 w-3.5 mr-1" aria-hidden="true" />Godkjenn
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-11 text-xs" disabled={busy || saved} onClick={() => { setDraft(post.content ?? ""); setEditing(true); }}>
              <Pencil className="h-3.5 w-3.5 mr-1" aria-hidden="true" />Rediger
            </Button>
            {!saved && (
              <Button size="sm" variant="ghost" className="h-11 text-xs text-destructive hover:text-destructive" disabled={busy} onClick={() => { if (confirm("Fjerne dette innlegget og lage et nytt i stedet?")) removePost.mutate({ planId, plannedPostId: post.id }); }}>
                <Trash2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" />Fjern
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ContentPlan() {
  const flagsQuery = trpc.plan.flags.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const listQuery = trpc.plan.list.useQuery(undefined, { enabled: flagsQuery.data?.enabled === true });
  const planId = listQuery.data?.[0]?.id;
  const utils = trpc.useUtils();

  const attemptRef = useRef(0);
  const planQuery = trpc.plan.get.useQuery(
    { planId: planId ?? 0 },
    {
      enabled: !!planId,
      refetchIntervalInBackground: false,
      refetchInterval: (query) => {
        const status = query.state.data?.plan?.status;
        if (status === "queued" || status === "processing") {
          attemptRef.current = Math.min(attemptRef.current + 1, 6);
          return Math.min(15_000, 3_000 * Math.pow(1.5, attemptRef.current));
        }
        attemptRef.current = 0;
        return false;
      },
    },
  );

  const approveAll = trpc.plan.approveAll.useMutation({ onSettled: () => { if (planId) void utils.plan.get.invalidate({ planId }); } });
  const saveApproved = trpc.plan.saveApproved.useMutation({ onSettled: () => { if (planId) void utils.plan.get.invalidate({ planId }); } });

  const weeks = useMemo(() => {
    const posts = (planQuery.data?.posts ?? []) as PostRow[];
    const grouped = new Map<number, PostRow[]>();
    for (const post of posts) {
      const list = grouped.get(post.weekNumber) ?? [];
      list.push(post);
      grouped.set(post.weekNumber, list);
    }
    return [...grouped.entries()].sort((a, b) => a[0] - b[0]);
  }, [planQuery.data?.posts]);

  const counts = useMemo(() => {
    const posts = (planQuery.data?.posts ?? []) as PostRow[];
    const approved = posts.filter((p) => p.approvalStatus === "approved").length;
    const approvedUnsaved = posts.filter((p) => p.approvalStatus === "approved" && p.savedPostId == null).length;
    const approvable = posts.filter((p) => p.approvalStatus !== "approved" && p.generationStatus === "done" && p.verificationStatus !== "high_risk").length;
    return { approved, approvedUnsaved, approvable };
  }, [planQuery.data?.posts]);

  if (flagsQuery.isLoading) {
    return <div className="container max-w-3xl py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Laster" /></div>;
  }

  if (!flagsQuery.data?.enabled) {
    return (
      <main className="container max-w-3xl py-10" lang="nb">
        <Card><CardContent className="py-10 text-center">
          <h1 className="text-xl font-semibold mb-2">Innholdsplan kommer snart</h1>
          <p className="text-sm text-muted-foreground">Denne funksjonen er ikke tilgjengelig ennå.</p>
        </CardContent></Card>
      </main>
    );
  }

  const plan = planQuery.data?.plan;
  const progress = planQuery.data?.progress;
  const generating = plan?.status === "queued" || plan?.status === "processing";

  return (
    <main className="container max-w-3xl py-6 md:py-8" lang="nb">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Din 4-ukers innholdsplan</h1>
        {plan && (
          <p className="text-sm text-muted-foreground mt-1">
            {PLATFORM_LABELS[plan.platform] ?? plan.platform} · {plan.postsPerWeek} innlegg per uke
          </p>
        )}
      </div>

      {listQuery.isLoading && (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Laster planer" /></div>
      )}

      {!listQuery.isLoading && !planId && (
        <Card><CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground mb-4">Du har ingen innholdsplan ennå.</p>
          <Link href="/lag-plan"><Button className="min-h-11">Lag plan</Button></Link>
        </CardContent></Card>
      )}

      {generating && progress && (
        <Card className="mb-6 border-primary/20">
          <CardContent className="py-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium text-sm">Lager innholdsplan …</p>
              <p className="text-xs text-muted-foreground">{progress.done} av {progress.total} innlegg klare</p>
            </div>
          </CardContent>
        </Card>
      )}

      {plan?.status === "partial" && (
        <p className="mb-4 text-sm text-amber-600 dark:text-amber-400">Noen innlegg kunne ikke lages. Resten av planen er klar.</p>
      )}
      {plan?.status === "failed" && (
        <p className="mb-4 text-sm text-destructive">Planen kunne ikke lages. Prøv å lage en ny plan senere.</p>
      )}

      {/* Topphandlinger — vises når planen har ferdige innlegg */}
      {planId && !generating && (planQuery.data?.posts?.length ?? 0) > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="min-h-11"
            disabled={approveAll.isPending || counts.approvable === 0}
            onClick={() => approveAll.mutate({ planId })}
          >
            <CheckCheck className="h-4 w-4 mr-1.5" aria-hidden="true" />Godkjenn alle{counts.approvable > 0 ? ` (${counts.approvable})` : ""}
          </Button>
          <Button
            className="min-h-11"
            disabled={saveApproved.isPending || counts.approvedUnsaved === 0}
            onClick={() => saveApproved.mutate({ planId })}
          >
            {saveApproved.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4 mr-1.5" aria-hidden="true" />}
            Lagre i Mine innlegg{counts.approvedUnsaved > 0 ? ` (${counts.approvedUnsaved})` : ""}
          </Button>
          {saveApproved.isSuccess && saveApproved.data && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />{saveApproved.data.count} lagret som utkast
            </span>
          )}
        </div>
      )}
      {planId && (planQuery.data?.posts?.length ?? 0) > 0 && (
        <p className="mb-6 -mt-3 text-xs text-muted-foreground">
          Godkjente innlegg lagres som utkast i «Mine innlegg». Ingenting publiseres automatisk.
        </p>
      )}

      {weeks.map(([weekNumber, posts]) => (
        <section key={weekNumber} className="mb-8" aria-label={`Uke ${weekNumber}`}>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
            Uke {weekNumber}
          </h2>
          <div className="space-y-3">
            {posts.map((post) => (
              <PostCard key={post.id} planId={planId as number} post={post} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
