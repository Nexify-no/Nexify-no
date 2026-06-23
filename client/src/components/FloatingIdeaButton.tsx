/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Lightbulb } from "lucide-react";
import { toast } from "sonner";

export default function FloatingIdeaButton() {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [ideaText, setIdeaText] = useState("");
  const [platform, setPlatform] = useState<string>("");
  const [tags, setTags] = useState("");

  const utils = trpc.useUtils();

  const createIdea = trpc.ideas.create.useMutation({
    onSuccess: () => {
      toast.success("Idé lagret! 💡", {
        description: "Finn den i Idé-Bank når du er klar til å skrive.",
      });
      setIsOpen(false);
      setIdeaText("");
      setPlatform("");
      setTags("");
      utils.ideas.list.invalidate();
      utils.ideas.getStats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Kunne ikke lagre idé");
    },
  });

  const handleSubmit = () => {
    if (!ideaText.trim()) {
      toast.error("Skriv inn en idé først");
      return;
    }

    const tagArray = tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    createIdea.mutate({
      ideaText: ideaText.trim(),
      platform: platform as "linkedin" | "twitter" | "instagram" | "facebook" | undefined,
      tags: tagArray.length > 0 ? tagArray : undefined,
    });
  };

  // Don't show for unauthenticated users
  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      {/* Floating Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 z-50 transition-all duration-300 hover:scale-110"
            size="icon"
          >
            <Plus className="h-6 w-6 text-white" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Lagre en idé raskt</p>
        </TooltipContent>
      </Tooltip>

      {/* Quick Add Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
                <Lightbulb className="h-4 w-4 text-white" />
              </div>
              Rask idé
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <Textarea
                placeholder="Skriv din idé her... F.eks. 'Skrive om hvordan AI endrer markedsføring i 2026'"
                value={ideaText}
                onChange={(e) => setIdeaText(e.target.value)}
                rows={3}
                className="resize-none"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Plattform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="twitter">Twitter/X</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Input
                  placeholder="Tags (valgfritt)"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                Avbryt
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!ideaText.trim() || createIdea.isPending}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
              >
                {createIdea.isPending ? "Lagrer..." : "Lagre"}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Tip: Trykk Ctrl+Shift+I for hurtigtast (kommer snart)
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}