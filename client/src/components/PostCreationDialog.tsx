/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
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
import { Calendar, Sparkles } from "lucide-react";

interface PostCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
}

export function PostCreationDialog({
  open,
  onOpenChange,
  selectedDate,
}: PostCreationDialogProps) {
  const [, setLocation] = useLocation();

  const handleCreatePost = () => {
    // Navigate to Generate page with pre-filled date
    if (selectedDate) {
      // Store selected date in sessionStorage for Generate page to pick up
      sessionStorage.setItem("prefilledScheduleDate", selectedDate.toISOString());
    }
    setLocation("/generate");
    onOpenChange(false);
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Lag nytt innlegg
          </DialogTitle>
          <DialogDescription>
            Opprett et nytt innlegg planlagt for{" "}
            <span className="font-semibold text-foreground">
              {formatDate(selectedDate)}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Planlagt dato</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(selectedDate)}
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Du vil bli tatt til innholdsgeneratoren hvor du kan lage innlegget
            ditt. Datoen vil være forhåndsutfylt.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleCreatePost}>
            <Sparkles className="mr-2 h-4 w-4" />
            Lag innlegg
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}