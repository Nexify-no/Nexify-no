/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Edit the copy of every e-mail Penna sends.
 *
 * Each one used to be a template literal in server/_core/email.ts, so changing a
 * sentence in the welcome e-mail took a code change, a review and a deploy — and
 * so it never happened. The built-in copy stays in the code as the fallback: turn
 * an override off, or delete it, and the original goes out again.
 *
 * The two things that make this safe to hand to an admin:
 *   - Required variables. A password-reset e-mail without `{{resetLink}}` is a
 *     locked-out customer, so the server refuses to store one and the editor says
 *     why before you press Save.
 *   - A test send that only ever reaches one typed address, subject-prefixed
 *     `[TEST]`, so "let me see how it looks" cannot become a send to customers.
 */

import { useEffect, useMemo, useState } from "react";
import { AdminGateScreen, useAdminGate } from "@/components/AdminGate";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TipTapEditor } from "@/components/TipTapEditor";
import { PageHeader } from "@/components/PageHeader";
import {
  AlertTriangle,
  Eye,
  Mail,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
  Variable,
} from "lucide-react";
import { toast } from "sonner";

type Draft = {
  id?: number;
  templateKey: string | null;
  name: string;
  subject: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaHref: string;
  enabled: boolean;
};

const EMPTY_DRAFT: Draft = {
  templateKey: null,
  name: "",
  subject: "",
  bodyHtml: "",
  ctaLabel: "",
  ctaHref: "",
  enabled: true,
};

export default function AdminEmailTemplates() {
  const { state: gate, isAdmin, retry } = useAdminGate();
  const list = trpc.admin.listEmailTemplates.useQuery(undefined, { enabled: isAdmin });
  const utils = trpc.useUtils();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [testTo, setTestTo] = useState("");

  const save = trpc.admin.saveEmailTemplate.useMutation({
    // Keep the id the server assigned. Without it a NEW custom template had no id
    // on the second Save either, so it was inserted again — one row per press.
    onSuccess: ({ id }) => {
      setDraft((d) => (d && d.id === undefined ? { ...d, id } : d));
      toast.success("Malen er lagret");
      utils.admin.listEmailTemplates.invalidate();
    },
    // The server's message names the actual problem ("{{resetLink}} må være med"),
    // so show it verbatim rather than a generic failure.
    onError: (e) => toast.error(e.message),
  });

  const reset = trpc.admin.resetEmailTemplate.useMutation({
    onSuccess: () => {
      toast.success("Tilbakestilt til standardteksten");
      setDraft(null);
      utils.admin.listEmailTemplates.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeCustom = trpc.admin.deleteEmailTemplate.useMutation({
    onSuccess: () => {
      toast.success("Malen er slettet");
      setDraft(null);
      utils.admin.listEmailTemplates.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const sendTest = trpc.admin.sendTestEmailTemplate.useMutation({
    onSuccess: (r) => toast.success(`Test sendt til ${r.sentTo}`),
    onError: (e) => toast.error(e.message),
  });

  const uploadImage = trpc.admin.uploadEmailImage.useMutation();

  /**
   * The preview input, debounced.
   *
   * Keying the query on the live draft meant one request per KEYSTROKE. The
   * per-user limit on /api/trpc is 150 requests a minute, so typing at a normal
   * speed rate-limited the admin out of their own page — Save included — and each
   * request also carried the whole body in a GET query string, which fails outright
   * once the body passes the 16 KB header limit.
   */
  const [previewInput, setPreviewInput] = useState<{
    templateKey: string | null;
    subject: string;
    bodyHtml: string;
    ctaLabel: string | null;
    ctaHref: string | null;
  } | null>(null);

  useEffect(() => {
    if (!draft) {
      setPreviewInput(null);
      return;
    }
    const t = setTimeout(
      () =>
        setPreviewInput({
          templateKey: draft.templateKey,
          subject: draft.subject,
          bodyHtml: draft.bodyHtml,
          ctaLabel: draft.ctaLabel || null,
          ctaHref: draft.ctaHref || null,
        }),
      500
    );
    return () => clearTimeout(t);
  }, [draft]);

  const preview = trpc.admin.previewEmailTemplate.useQuery(previewInput ?? { subject: "", bodyHtml: "" }, {
    enabled: Boolean(previewInput && previewInput.bodyHtml.trim()),
  });

  const builtIn = useMemo(
    () => list.data?.builtIns.find((b) => b.key === draft?.templateKey),
    [list.data, draft?.templateKey]
  );

  if (gate !== "ok") return <AdminGateScreen state={gate} onRetry={retry} />;

  function openBuiltIn(key: string) {
    const b = list.data?.builtIns.find((x) => x.key === key);
    if (!b) return;
    if (b.stored) {
      setDraft({
        id: b.stored.id,
        templateKey: key,
        name: b.stored.name,
        subject: b.stored.subject,
        bodyHtml: b.stored.bodyHtml,
        ctaLabel: b.stored.ctaLabel ?? "",
        ctaHref: b.stored.ctaHref ?? "",
        enabled: b.stored.enabled,
      });
      return;
    }
    // No override yet — start from a skeleton that already contains every required
    // variable, so the first Save cannot fail on a rule the admin never saw.
    const requiredLines = b.required
      .map((r) => `<p>{{${r}}}</p>`)
      .join("");
    setDraft({
      templateKey: key,
      name: b.name,
      subject: b.name,
      bodyHtml: `<p>Hei {{${b.variables[0]?.key ?? "name"}}},</p><p></p>${requiredLines}`,
      ctaLabel: "",
      ctaHref: "",
      enabled: true,
    });
  }

  /**
   * Append a variable to the body.
   *
   * Changing `draft.bodyHtml` is enough now that TipTapEditor syncs its document
   * from the `content` prop — before that sync existed this looked like it worked
   * and the next keystroke silently threw the insertion away.
   */
  function insertVariable(key: string) {
    if (!draft) return;
    setDraft({ ...draft, bodyHtml: `${draft.bodyHtml}<p>{{${key}}}</p>` });
  }

  /**
   * Pick a file, upload it, hand the HOSTED url back to the editor.
   *
   * Never a `data:` URL: Gmail, Outlook and most mobile clients block base64
   * images, so an inlined picture is one the recipient does not see.
   */
  async function pickAndUploadImage(): Promise<string | null> {
    const file = await new Promise<File | null>((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/webp,image/gif";
      input.onchange = () => resolve(input.files?.[0] ?? null);
      // A cancelled picker must resolve, or the promise leaks and the button
      // looks broken the next time.
      input.oncancel = () => resolve(null);
      input.click();
    });
    if (!file) return null;

    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
    const type = allowed.find((t) => t === file.type);
    if (!type) {
      toast.error("Kun PNG, JPEG, WEBP eller GIF.");
      return null;
    }
    // The tRPC input caps fileData at ~9 MB of base64, which is ~6.5 MB of bytes.
    if (file.size > 6_000_000) {
      toast.error("Bildet er for stort (maks 6 MB).");
      return null;
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Kunne ikke lese filen"));
        r.readAsDataURL(file);
      });
      const { url } = await uploadImage.mutateAsync({
        // Strip anything the server's filename rule would reject, rather than
        // letting the upload fail on a space in the file name.
        fileName: file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-64) || "bilde.png",
        fileData: dataUrl,
        contentType: type,
      });
      return url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Opplastingen feilet");
      return null;
    }
  }

  const problems = preview.data?.problems ?? [];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="E-postmaler"
        description="Endre teksten i e-postene Penna sender. Standardteksten ligger i koden og brukes så snart en mal er av eller slettet."
      />

      <main className="container py-8 grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* ── Left: what exists ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" /> Innebygde e-poster
              </CardTitle>
              <CardDescription>
                Disse sendes automatisk. Rediger teksten, eller la standarden stå.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {list.isLoading ? (
                <p className="text-sm text-muted-foreground">Laster …</p>
              ) : (
                list.data?.builtIns.map((b) => (
                  <button
                    key={b.key}
                    onClick={() => openBuiltIn(b.key)}
                    className={`w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors ${
                      draft?.templateKey === b.key ? "border-primary bg-accent" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{b.name}</span>
                      {b.overridden ? (
                        <Badge variant={b.enabled ? "default" : "secondary"} className="text-[10px]">
                          {b.enabled ? "Egen tekst" : "Egen tekst (av)"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Standard
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{b.description}</p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Egne maler</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
                <Plus className="h-4 w-4 mr-1" /> Ny
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {(list.data?.custom ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Ingen egne maler ennå.</p>
              ) : (
                list.data?.custom.map((c) => (
                  <button
                    key={c.id}
                    onClick={() =>
                      setDraft({
                        id: c.id,
                        templateKey: null,
                        name: c.name,
                        subject: c.subject,
                        bodyHtml: c.bodyHtml,
                        ctaLabel: c.ctaLabel ?? "",
                        ctaHref: c.ctaHref ?? "",
                        enabled: c.enabled,
                      })
                    }
                    className={`w-full text-left p-3 rounded-lg border hover:bg-accent ${
                      draft?.id === c.id ? "border-primary bg-accent" : ""
                    }`}
                  >
                    <span className="font-medium text-sm">{c.name}</span>
                    <p className="text-xs text-muted-foreground mt-1">{c.subject}</p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right: the editor ─────────────────────────────────────────── */}
        {!draft ? (
          <Card className="flex items-center justify-center min-h-[400px]">
            <p className="text-sm text-muted-foreground">
              Velg en e-post til venstre, eller lag en ny mal.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-start justify-between space-y-0 gap-4">
                <div className="min-w-0">
                  <CardTitle className="text-base">
                    {draft.templateKey ? builtIn?.name : draft.name || "Ny mal"}
                  </CardTitle>
                  {builtIn?.note ? (
                    <CardDescription className="mt-1">{builtIn.note}</CardDescription>
                  ) : null}
                </div>
                {draft.templateKey ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <Label htmlFor="tpl-enabled" className="text-xs whitespace-nowrap">
                      Bruk egen tekst
                    </Label>
                    <Switch
                      id="tpl-enabled"
                      checked={draft.enabled}
                      onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
                    />
                  </div>
                ) : null}
              </CardHeader>

              <CardContent className="space-y-4">
                {problems.length > 0 ? (
                  <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-900 dark:text-amber-200 space-y-1">
                      {problems.map((p, i) => (
                        <div key={i}>{p.message}</div>
                      ))}
                    </AlertDescription>
                  </Alert>
                ) : null}

                {!draft.templateKey ? (
                  <div>
                    <Label htmlFor="tpl-name">Navn (bare synlig for deg)</Label>
                    <Input
                      id="tpl-name"
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      placeholder="Kampanje: nye funksjoner"
                    />
                  </div>
                ) : null}

                <div>
                  <Label htmlFor="tpl-subject">Emne</Label>
                  <Input
                    id="tpl-subject"
                    value={draft.subject}
                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                    placeholder="Kort og konkret"
                  />
                </div>

                {builtIn && builtIn.variables.length > 0 ? (
                  <div>
                    <Label className="flex items-center gap-1 mb-2">
                      <Variable className="h-3.5 w-3.5" /> Variabler
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {builtIn.variables.map((v) => (
                        <Button
                          key={v.key}
                          type="button"
                          size="sm"
                          variant={builtIn.required.includes(v.key) ? "default" : "outline"}
                          onClick={() => insertVariable(v.key)}
                          title={
                            builtIn.required.includes(v.key)
                              ? `${v.label} — påkrevd`
                              : v.label
                          }
                        >
                          {`{{${v.key}}}`}
                          {builtIn.required.includes(v.key) ? " *" : ""}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Variabler merket med * må være med. I forhåndsvisningen erstattes de med
                      eksempelverdier.
                    </p>
                  </div>
                ) : null}

                <div>
                  <Label className="mb-2 block">Innhold</Label>
                  <TipTapEditor
                    // Remount per template, so no fragment of the previous one
                    // can survive into the next draft.
                    key={draft.templateKey ?? draft.id ?? "new"}
                    content={draft.bodyHtml}
                    onChange={(html) => setDraft({ ...draft, bodyHtml: html })}
                    onPickImage={pickAndUploadImage}
                    allowBase64Images={false}
                    placeholder="Skriv e-posten her. Bilder lastes opp og hostes — ikke bygges inn."
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="cta-label">Knappetekst (valgfritt)</Label>
                    <Input
                      id="cta-label"
                      value={draft.ctaLabel}
                      onChange={(e) => setDraft({ ...draft, ctaLabel: e.target.value })}
                      placeholder="Gå til dashbordet"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cta-href">Knappelenke</Label>
                    <Input
                      id="cta-href"
                      value={draft.ctaHref}
                      onChange={(e) => setDraft({ ...draft, ctaHref: e.target.value })}
                      placeholder="https://penna.no/dashboard"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Button
                    onClick={() =>
                      save.mutate({
                        id: draft.id,
                        templateKey: draft.templateKey,
                        name: draft.templateKey ? builtIn?.name ?? draft.templateKey : draft.name,
                        subject: draft.subject,
                        bodyHtml: draft.bodyHtml,
                        ctaLabel: draft.ctaLabel || null,
                        ctaHref: draft.ctaHref || null,
                        enabled: draft.enabled,
                      })
                    }
                    disabled={save.isPending}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    {save.isPending ? "Lagrer …" : "Lagre"}
                  </Button>

                  <div className="flex items-center gap-2">
                    <Input
                      value={testTo}
                      onChange={(e) => setTestTo(e.target.value)}
                      placeholder="din@epost.no"
                      className="w-56"
                      type="email"
                    />
                    <Button
                      variant="outline"
                      disabled={sendTest.isPending || !draft.bodyHtml.trim()}
                      onClick={() =>
                        sendTest.mutate({
                          to: testTo.trim() || undefined,
                          templateKey: draft.templateKey,
                          subject: draft.subject || "(uten emne)",
                          bodyHtml: draft.bodyHtml,
                          ctaLabel: draft.ctaLabel || null,
                          ctaHref: draft.ctaHref || null,
                        })
                      }
                    >
                      <Send className="h-4 w-4 mr-1" />
                      {sendTest.isPending ? "Sender …" : "Send test"}
                    </Button>
                  </div>

                  {draft.templateKey && builtIn?.overridden ? (
                    <Button
                      variant="ghost"
                      onClick={() => reset.mutate({ templateKey: draft.templateKey! })}
                      disabled={reset.isPending}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" /> Tilbakestill til standard
                    </Button>
                  ) : null}

                  {!draft.templateKey && draft.id ? (
                    <Button
                      variant="ghost"
                      className="text-red-600"
                      onClick={() => removeCustom.mutate({ id: draft.id! })}
                      disabled={removeCustom.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Slett
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Testen får «[TEST]» foran emnet og går bare til én adresse. Tom adresse = din
                  egen.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Eye className="h-4 w-4" /> Forhåndsvisning
                </CardTitle>
                <CardDescription>
                  {preview.data ? `Emne: ${preview.data.subject}` : "Skriv noe innhold først."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {preview.data ? (
                  // A sandboxed iframe, not innerHTML: the preview must not be able
                  // to run script or reach into the admin page even if the sanitiser
                  // is one day wrong about something.
                  <iframe
                    title="E-post-forhåndsvisning"
                    sandbox=""
                    srcDoc={preview.data.html}
                    className="w-full h-[560px] rounded-lg border bg-white"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Ingen forhåndsvisning ennå.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
