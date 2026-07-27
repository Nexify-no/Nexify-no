/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Send an email to members — the capability that did not exist at all.
 *
 * There was no admin send path anywhere in the product: no procedure, no page, no
 * history. The one control that looked like one, "Send Notification" in the bulk
 * member actions, was a `// TODO` followed by `toast.success(...)`.
 *
 * Three things on this page exist specifically so it cannot lie the way that one
 * did:
 *
 *  - The recipient count is fetched BEFORE anything is written, and again as the
 *    segment changes. You never press Send without knowing the number.
 *  - If SendGrid is not configured the form says so up front and Send is
 *    disabled, rather than reporting success into a void.
 *  - The result is reported as sent / failed / skipped, separately. A customer
 *    who opted out of email is skipped, not delivered-to, and saying "sent to
 *    200" when 40 were skipped is the failure this page was built to remove.
 */

import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Mail, Send, AlertTriangle, Users } from "lucide-react";
import { toast } from "sonner";

type Segment = "all" | "active" | "suspended" | "admins" | "inactive_30d";

const SEGMENTS: Array<{ value: Segment; label: string; hint: string }> = [
  { value: "active", label: "Alle aktive medlemmer", hint: "Kontoer som ikke er sperret" },
  { value: "inactive_30d", label: "Inaktive (30 dager)", hint: "Har ikke logget inn på 30 dager" },
  { value: "admins", label: "Kun administratorer", hint: "Til intern beskjed" },
  { value: "suspended", label: "Sperrede kontoer", hint: "F.eks. for å forklare hvorfor" },
  { value: "all", label: "Alle kontoer", hint: "Slettede kontoer utelates alltid" },
];

export default function AdminEmail() {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  useLocation();

  const [segment, setSegment] = useState<Segment>("active");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaHref, setCtaHref] = useState("");

  const isAdmin = user?.role === "admin";

  const audience = trpc.admin.previewEmailAudience.useQuery(
    { segment },
    { enabled: Boolean(isAdmin) }
  );
  const history = trpc.admin.emailHistory.useQuery({ limit: 20 }, { enabled: Boolean(isAdmin) });

  const send = trpc.admin.sendEmail.useMutation({
    onSuccess: (r) => {
      toast.success(`Sendt: ${r.sent} · Feilet: ${r.failed} · Hoppet over: ${r.skipped}`);
      setSubject("");
      setBody("");
      setCtaLabel("");
      setCtaHref("");
      history.refetch();
      audience.refetch();
    },
    onError: (e) => toast.error(e.message || "Kunne ikke sende"),
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }
  if (!isAdmin) {
    // Render a message rather than calling setLocation() during render — a state
    // update in the render body warns in React and can loop with wouter. This is
    // the pattern MemberMonitoring already uses.
    return (
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-bold mb-2">Ingen tilgang</h1>
        <p className="text-muted-foreground">Denne siden er kun for administratorer.</p>
      </div>
    );
  }

  const emailConfigured = audience.data?.emailConfigured !== false;
  const count = audience.data?.count ?? 0;
  const tooLarge = audience.data?.tooLarge === true;
  const maxPerSend = audience.data?.maxPerSend ?? 500;
  const canSend =
    emailConfigured &&
    !tooLarge &&
    count > 0 &&
    subject.trim().length > 0 &&
    body.trim().length > 0;

  return (
    <div className="container py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Mail className="h-7 w-7" />
          E-post til medlemmer
        </h1>
        <p className="text-muted-foreground">
          Sendes med Penna-malen. Alt som sendes herfra loggføres per mottaker.
        </p>
      </div>

      {!emailConfigured && (
        <div className="mb-6 p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
          <p className="flex items-start gap-2 text-sm text-red-900 dark:text-red-100">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>
              <strong>E-post er ikke konfigurert.</strong> <code>SENDGRID_API_KEY</code> mangler på
              serveren, så ingenting kan sendes. Utsending er deaktivert her i stedet for å gi deg
              en kvittering på noe som aldri forlot maskinen.
            </span>
          </p>
        </div>
      )}

      {tooLarge && (
        <div className="mb-6 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
          <p className="text-sm text-amber-900 dark:text-amber-100">
            Dette segmentet har <strong>{count}</strong> mottakere, over grensen på {maxPerSend} per
            utsending. Velg et smalere segment — du får vite det nå, ikke etter at meldingen er
            skrevet.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Ny melding</CardTitle>
            <CardDescription>Du ser hvor mange den når før du sender.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Mottakere</label>
              <Select value={segment} onValueChange={(v) => setSegment(v as Segment)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEGMENTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                {SEGMENTS.find((s) => s.value === segment)?.hint}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Emne</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={300}
                placeholder="Kort og konkret"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Melding</label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[220px]"
                maxLength={20000}
                placeholder={"Skriv som du snakker.\n\nTom linje gir nytt avsnitt."}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Ren tekst. Den blir escapet før den legges i e-posten, så en `&lt;` i teksten din
                blir en `&lt;` hos mottakeren — ikke HTML.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium mb-2 block">Knappetekst (valgfritt)</label>
                <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} maxLength={60} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Knappelenke (valgfritt)</label>
                <Input
                  value={ctaHref}
                  onChange={(e) => setCtaHref(e.target.value)}
                  placeholder="https://penna.no/…"
                  maxLength={500}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                {audience.isLoading ? "Teller …" : `${count} mottaker(e)`}
              </p>
              <Button
                onClick={() =>
                  send.mutate({
                    segment,
                    subject: subject.trim(),
                    body: body.trim(),
                    ctaLabel: ctaLabel.trim() || undefined,
                    ctaHref: ctaHref.trim() || undefined,
                    respectOptOut: true,
                  })
                }
                disabled={!canSend || send.isPending}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                {send.isPending ? "Sender …" : `Send til ${count}`}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Medlemmer som har slått av e-postvarsler hoppes over og telles for seg. Maks 500
              mottakere per utsending.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sendt tidligere</CardTitle>
            <CardDescription>Én linje per utsending, nyeste først.</CardDescription>
          </CardHeader>
          <CardContent>
            {history.isLoading ? (
              <p className="text-sm text-muted-foreground">Laster …</p>
            ) : (history.data?.batches.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ingenting sendt herfra ennå.
              </p>
            ) : (
              <div className="space-y-3">
                {history.data!.batches.map((b) => (
                  <div key={b.batchId} className="p-3 rounded-lg border text-sm">
                    <p className="font-medium truncate">{b.subject}</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      {new Date(b.createdAt).toLocaleString("nb-NO")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{b.sent} sendt</Badge>
                      {b.failed > 0 && <Badge variant="destructive">{b.failed} feilet</Badge>}
                      {b.skipped > 0 && <Badge variant="outline">{b.skipped} hoppet over</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
