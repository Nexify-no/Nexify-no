/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2 } from "lucide-react";

interface EventTooltipProps {
  event: {
    id: string;
    title: string;
    start: Date | null;
    extendedProps: {
      platform: string;
      status: string;
      content: string;
    };
  };
  onEdit: (eventId: string) => void;
  onDelete: (eventId: string) => void;
  children: React.ReactNode;
}

export function EventTooltip({
  event,
  onEdit,
  onDelete,
  children,
}: EventTooltipProps) {
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
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{getPlatformIcon(event.extendedProps.platform)}</span>
              <div>
                <p className="font-semibold text-sm">
                  {getPlatformLabel(event.extendedProps.platform)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(event.start)}
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={getStatusColor(event.extendedProps.status)}
            >
              {getStatusLabel(event.extendedProps.status)}
            </Badge>
          </div>

          {/* Content Preview */}
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="text-sm text-foreground line-clamp-4">
              {event.extendedProps.content}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => onEdit(event.id)}
            >
              <Edit className="mr-1.5 h-3.5 w-3.5" />
              Rediger
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDelete(event.id)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Slett
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}