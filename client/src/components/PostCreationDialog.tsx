/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * What happens when you click a date in /kalender (PR #81).
 *
 * Two routes out, because both are things people actually want:
 *   - "Lag nytt innlegg"            → the generator, carrying the date
 *   - "Velg et eksisterende utkast" → pick a draft and schedule it directly
 *
 * The date travels through the in-memory `editorHandoff`, not sessionStorage.
 * The old `prefilledScheduleDate` key was written here and read by nobody — the
 * generator only ever looked at the handoff — so picking a date and creating a
 * post silently lost the date. One channel now, so it cannot drift again.
 */

import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, FileText, Sparkles } from "lucide-react";
import { setEditorHandoff } from "@/lib/editorHandoff";

interface PostCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  /** Open the draft picker for this date instead of leaving the calendar. */
  onPickDraft?: (date: Date) => void;
}

export function PostCreationDialog({
  open,
  onOpenChange,
  selectedDate,
  onPickDraft,
}: PostCreationDialogProps) {
  const [, setLocation] = useLocation();

  const handleCreatePost = () => {
    // Carry the clicked date all the way into the editor, so the post can be
    // scheduled for it after generation without the user re-picking it.
    if (selectedDate) {
      setEditorHandoff({ scheduledAt: selectedDate.toISOString(), source: "calendar" });
    }
    setLocation("/generate");
    onOpenChange(false);
  };

  const handlePickDraft = () => {
    if (!selectedDate) return;
    onOpenChange(false);
    onPickDraft?.(selectedDate);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return new Intl.DateTimeFormat("nb-NO", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {formatDate(selectedDate)}
          </DialogTitle>
          <DialogDescription>Hva vil du legge på denne datoen?</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <button
            type="button"
            onClick={handleCreatePost}
            className="w-full flex items-start gap-3 rounded-xl border p-4 text-left hover:border-primary/50 hover:bg-muted/50 transition-colors"
          >
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">Lag nytt innlegg</span>
              <span className="block text-sm text-muted-foreground">
                Åpner generatoren med datoen klar.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={handlePickDraft}
            disabled={!onPickDraft}
            className="w-full flex items-start gap-3 rounded-xl border p-4 text-left hover:border-primary/50 hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">Velg et eksisterende utkast</span>
              <span className="block text-sm text-muted-foreground">
                Planlegg noe du allerede har skrevet.
              </span>
            </span>
          </button>
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
