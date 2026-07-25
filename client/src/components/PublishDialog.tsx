/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

// Safe publish window (MB2). Always shows WHICH brand and WHICH destination the
// post goes to, disables platforms that aren't connected, refuses to publish
// without a destination, requires a final confirm, and sends an idempotency key
// so a double click can never publish twice.

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

type Props = {
  open: boolean;
  onClose: () => void;
  content: string;
  imageUrl?: string | null;
  postId?: number | null;
  onPublished?: () => void;
};

const LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "X",
};

export function PublishDialog({ open, onClose, content, imageUrl, postId, onPublished }: Props) {
  const dest = trpc.social.destinations.useQuery(undefined, { enabled: open });
  const [confirming, setConfirming] = useState(false);
  // One key per dialog session: retrying the same post is idempotent server-side.
  const idempotencyKey = useMemo(
    () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/-/g, "").slice(0, 40),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, postId],
  );

  const publish = trpc.linkedin.createPost.useMutation({
    onSuccess: () => {
      toast.success("Publisert!");
      setConfirming(false);
      onPublished?.();
      onClose();
    },
    onError: (e) => { setConfirming(false); toast.error(e.message || "Kunne ikke publisere"); },
  });

  if (!open) return null;

  const linkedin = dest.data?.platforms.find((p) => p.platform === "linkedin");
  const canPublish = linkedin?.connected === true && !!content.trim();

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl bg-background border shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-base font-semibold">Publiser innlegg</h2>
          <button type="button" onClick={onClose} aria-label="Lukk" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {dest.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Henter kanaler …
            </div>
          ) : (
            <>
              <dl className="rounded-xl border divide-y text-sm">
                <div className="flex justify-between gap-3 px-3 py-2">
                  <dt className="text-muted-foreground">Merkevare</dt>
                  <dd className="font-medium truncate">{dest.data?.brandName || "—"}</dd>
                </div>
                <div className="flex justify-between gap-3 px-3 py-2">
                  <dt className="text-muted-foreground">Plattform</dt>
                  <dd className="font-medium">LinkedIn</dd>
                </div>
                <div className="flex justify-between gap-3 px-3 py-2">
                  <dt className="text-muted-foreground">Publiseres som</dt>
                  <dd className="font-medium truncate">
                    {linkedin?.connected
                      ? (linkedin.destinationName || "Ukjent side")
                      : <span className="text-amber-600">Ingen tilkoblet side</span>}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2">
                {(dest.data?.platforms ?? []).map((p) => (
                  <span
                    key={p.platform}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
                      p.connected ? "border-primary/40 text-primary" : "text-muted-foreground opacity-60"
                    }`}
                    title={p.connected ? `Publiserer som ${p.destinationName ?? ""}` : "Ikke tilkoblet"}
                  >
                    {p.connected ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                    {LABELS[p.platform] ?? p.platform}
                    {!p.connected && " · ikke tilkoblet"}
                  </span>
                ))}
              </div>

              {imageUrl && <img src={imageUrl} alt="" className="w-full rounded-xl border" />}
              <p className="whitespace-pre-wrap rounded-xl border bg-muted/30 p-3 text-sm leading-relaxed max-h-56 overflow-y-auto">
                {content}
              </p>

              {!linkedin?.connected && (
                <p className="text-xs text-amber-600">
                  Denne merkevaren har ingen tilkoblet LinkedIn-side. Koble til i Innstillinger før du publiserer.
                </p>
              )}
            </>
          )}
        </div>

        <div className="border-t px-5 py-3 flex flex-wrap gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>Tilbake til redigering</Button>
          {confirming ? (
            <Button
              onClick={() => publish.mutate({
                content,
                postId: postId ?? undefined,
                brandId: dest.data?.brandId,
                idempotencyKey,
              })}
              disabled={publish.isPending || !canPublish}
            >
              {publish.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Publiserer …</>
                : <>Bekreft publisering</>}
            </Button>
          ) : (
            <Button onClick={() => setConfirming(true)} disabled={!canPublish}>
              <Send className="h-4 w-4 mr-2" />
              Publiser nå
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
