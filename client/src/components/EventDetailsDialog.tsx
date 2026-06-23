/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Calendar, Copy } from "lucide-react";


interface EventDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: {
    id: string;
    title: string;
    start: Date | null;
    extendedProps: {
      platform: string;
      status: string;
      content: string;
    };
  } | null;
  onEdit: (eventId: string) => void;
  onDelete: (eventId: string) => void;
}

export function EventDetailsDialog({
  open,
  onOpenChange,
  event,
  onEdit,
  onDelete,
}: EventDetailsDialogProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  if (!event) return null;

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "linkedin":
        return "💼";
      case "twitter":
        return "🐦";
      case "facebook":
        return "👍";
      case "instagram":
        return "📸";
      default:
        return "📝";
    }
  };

  const getPlatformLabel = (platform: string) => {
    switch (platform) {
      case "linkedin":
        return "LinkedIn";
      case "twitter":
        return "Twitter/X";
      case "facebook":
        return "Facebook";
      case "instagram":
        return "Instagram";
      default:
        return platform;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "published":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      case "draft":
        return "bg-gray-500/10 text-gray-600 border-gray-500/20";
      case "failed":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-500/20";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "scheduled":
        return "Planlagt";
      case "published":
        return "Publisert";
      case "draft":
        return "Utkast";
      case "failed":
        return "Feilet";
      default:
        return status;
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return new Intl.DateTimeFormat("nb-NO", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(event.extendedProps.content);
      alert("✅ Innholdet er kopiert til utklippstavlen");
    } catch (error) {
      alert("❌ Kunne ikke kopiere innholdet");
    }
  };

  const handleEdit = () => {
    onEdit(event.id);
    onOpenChange(false);
  };

  const handleDeleteConfirm = () => {
    onDelete(event.id);
    setDeleteDialogOpen(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <span className="text-2xl">{getPlatformIcon(event.extendedProps.platform)}</span>
                {getPlatformLabel(event.extendedProps.platform)}
              </DialogTitle>
              <Badge
                variant="outline"
                className={getStatusColor(event.extendedProps.status)}
              >
                {getStatusLabel(event.extendedProps.status)}
              </Badge>
            </div>
            <DialogDescription className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" />
              {formatDate(event.start)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Content */}
            <div>
              <label className="text-sm font-medium mb-2 block">Innhold</label>
              <div className="rounded-lg border border-border bg-muted/30 p-4 max-h-[300px] overflow-y-auto">
                <p className="text-sm whitespace-pre-wrap">
                  {event.extendedProps.content}
                </p>
              </div>
            </div>

            {/* Copy Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyContent}
              className="w-full"
            >
              <Copy className="mr-2 h-4 w-4" />
              Kopier innhold
            </Button>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(true)}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Slett
            </Button>
            <Button onClick={handleEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Rediger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil permanent slette innlegget. Denne handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Slett
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}