/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Bookmark, Trash2, Loader2, FolderOpen, Plus, ArrowRight, Linkedin, Twitter, Instagram, Facebook } from "lucide-react";
import { toast } from "sonner";

const platformIcons: Record<string, React.ReactNode> = {
  linkedin: <Linkedin className="h-3.5 w-3.5 text-blue-600" />,
  twitter: <Twitter className="h-3.5 w-3.5 text-sky-500" />,
  instagram: <Instagram className="h-3.5 w-3.5 text-pink-500" />,
  facebook: <Facebook className="h-3.5 w-3.5 text-blue-700" />,
};

interface SavedTemplatesProps {
  onUseTemplate: (template: {
    platform: string;
    tone: string;
    rawInput: string;
    generatedContent: string;
  }) => void;
  currentContent?: string;
  currentPlatform?: string;
  currentTone?: string;
  currentTopic?: string;
}

export function SavedTemplates({
  onUseTemplate,
  currentContent,
  currentPlatform,
  currentTone,
  currentTopic,
}: SavedTemplatesProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [templateTitle, setTemplateTitle] = useState("");

  const { data: templates, isLoading } = trpc.templates.list.useQuery();
  const utils = trpc.useUtils();

  const saveMutation = trpc.templates.save.useMutation({
    onSuccess: () => {
      toast.success("Mal lagret!");
      setSaveDialogOpen(false);
      setTemplateTitle("");
      utils.templates.list.invalidate();
    },
    onError: () => toast.error("Kunne ikke lagre malen"),
  });

  const deleteMutation = trpc.templates.delete.useMutation({
    onSuccess: () => {
      toast.success("Mal slettet");
      utils.templates.list.invalidate();
    },
    onError: () => toast.error("Kunne ikke slette malen"),
  });

  const useMutation = trpc.templates.use.useMutation({
    onSuccess: (data) => {
      onUseTemplate({
        platform: data.platform,
        tone: data.tone,
        rawInput: data.rawInput,
        generatedContent: data.generatedContent,
      });
      toast.success("Mal lastet inn!");
      utils.templates.list.invalidate();
    },
    onError: () => toast.error("Kunne ikke laste malen"),
  });

  const handleSave = () => {
    if (!currentContent || !currentPlatform || !currentTone || !currentTopic) {
      toast.error("Generer innhold først for å lagre som mal");
      return;
    }
    if (!templateTitle.trim()) {
      toast.error("Gi malen et navn");
      return;
    }
    saveMutation.mutate({
      title: templateTitle.trim(),
      platform: currentPlatform as "linkedin" | "twitter" | "instagram" | "facebook",
      tone: currentTone,
      rawInput: currentTopic,
      generatedContent: currentContent,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-amber-500" />
            Lagrede maler
          </CardTitle>
          {currentContent && (
            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                  <Plus className="h-3 w-3" />
                  Lagre
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Lagre som mal</DialogTitle>
                  <DialogDescription>Gi malen et beskrivende navn slik at du enkelt kan finne den igjen.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <Input
                    placeholder="F.eks. LinkedIn produktlansering..."
                    value={templateTitle}
                    onChange={(e) => setTemplateTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  />
                  <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                    <p><strong>Plattform:</strong> {currentPlatform}</p>
                    <p><strong>Tone:</strong> {currentTone}</p>
                    <p className="line-clamp-2"><strong>Emne:</strong> {currentTopic}</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Avbryt</Button>
                  <Button onClick={handleSave} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Bookmark className="h-4 w-4 mr-1" />}
                    Lagre mal
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !templates || templates.length === 0 ? (
          <div className="text-center py-4">
            <FolderOpen className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Ingen lagrede maler ennå</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">Generer innhold og lagre det som mal for rask gjenbruk</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {templates.map((template) => (
              <div
                key={template.id}
                className="group flex items-start gap-2 p-2 rounded-lg border border-transparent hover:border-border hover:bg-muted/30 transition-colors"
              >
                <div className="mt-0.5 shrink-0">
                  {platformIcons[template.platform] || <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{template.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{template.rawInput}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{template.tone}</span>
                    {template.usageCount > 0 && (
                      <span className="text-[10px] text-muted-foreground">Brukt {template.usageCount}x</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => useMutation.mutate({ id: template.id })}
                    disabled={useMutation.isPending}
                    title="Bruk denne malen"
                  >
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (confirm("Slett denne malen?")) {
                        deleteMutation.mutate({ id: template.id });
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    title="Slett mal"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}