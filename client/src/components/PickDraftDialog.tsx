/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * Pick a saved draft to schedule on a date clicked in the calendar (PR #81).
 *
 * Only `status: "draft"` posts are offered. Already-scheduled posts are moved by
 * dragging them in the calendar, and published ones are history — listing either
 * here would invite scheduling the same post twice.
 *
 * Choosing a draft hands off to ScheduleDialog with the clicked date, so the
 * user confirms the exact time, timezone, brand and destination before anything
 * is written.
 */

import { FileText, Loader2, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

export type DraftChoice = {
  id: number;
  platform: "linkedin" | "twitter" | "instagram" | "facebook";
  content: string;
  imageUrl?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** The date clicked in the calendar, carried into ScheduleDialog. */
  date: Date | null;
  onChoose: (draft: DraftChoice) => void;
};

const PLATFORM_ICON: Record<string, string> = {
  linkedin: "💼",
  twitter: "🐦",
  instagram: "📸",
  facebook: "👥",
};

export function PickDraftDialog({ open, onClose, date, onChoose }: Props) {
  // PR #81: refetch on every open. While the dialog is closed this query is
  // inactive, so ScheduleDialog's invalidate() marks it stale WITHOUT refetching
  // — reopening then listed a draft that was already scheduled, and picking it
  // silently MOVED that post instead of scheduling something new.
  const list = trpc.content.list.useQuery(undefined, {
    enabled: open,
    refetchOnMount: "always",
  });

  if (!open) return null;

  const drafts = (list.data ?? []).filter((p) => p.status === "draft");
  const when = date
    ? new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "long" }).format(date)
    : "";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl border bg-background shadow-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" aria-hidden="true" />
            Velg et utkast{when && <span className="font-normal text-muted-foreground">— {when}</span>}
          </h2>
          <button type="button" onClick={onClose} aria-label="Lukk" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {list.isLoading && (
            <div className="grid place-items-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            </div>
          )}

          {list.isError && (
            <div className="rounded-xl border border-destructive/40 p-4 text-sm">
              <p className="text-muted-foreground">Kunne ikke laste utkastene.</p>
              <button
                type="button"
                onClick={() => list.refetch()}
                className="mt-2 font-medium underline underline-offset-2"
              >
                Prøv igjen
              </button>
            </div>
          )}

          {!list.isLoading && !list.isError && drafts.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Du har ingen utkast ennå. Lag et nytt innlegg i stedet.
            </p>
          )}

          <ul className="space-y-2">
            {drafts.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() =>
                    onChoose({
                      id: p.id,
                      platform: p.platform,
                      content: p.generatedContent,
                      imageUrl: p.imageUrl ?? null,
                    })
                  }
                  className="w-full flex items-start gap-3 rounded-xl border p-3 text-left hover:border-primary/50 hover:bg-muted/50 transition-colors"
                >
                  <span className="text-lg leading-none shrink-0" aria-hidden="true">
                    {PLATFORM_ICON[p.platform] ?? "📝"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm line-clamp-2">{p.generatedContent}</span>
                    <span className="mt-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
                      {p.platform}
                    </span>
                  </span>
                  {p.imageUrl && (
                    <img src={p.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg border object-cover" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
