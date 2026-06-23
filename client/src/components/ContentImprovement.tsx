/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { SkeletonCard } from "@/components/SkeletonLoader";

interface ContentImprovementProps {
  originalContent: string;
  platform: "linkedin" | "twitter" | "facebook" | "instagram";
  tone: string;
  length: "short" | "medium" | "long";
  onContentImproved?: (improvedContent: string) => void;
}

export function ContentImprovement({
  originalContent,
  platform,
  tone,
  length,
  onContentImproved,
}: ContentImprovementProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [addEmojis, setAddEmojis] = useState(true);
  const [addHashtags, setAddHashtags] = useState(true);
  const [copiedContent, setCopiedContent] = useState(false);

  const improveContentMutation = trpc.langchain.improveContent.useMutation({
    onSuccess: (data) => {
      if (data.improvedContent) {
        toast.success("Innholdet ble forbedret!");
        onContentImproved?.(data.improvedContent);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Kunne ikke forbedre innholdet");
    },
  });

  const handleImproveContent = () => {
    if (!originalContent.trim()) {
      toast.error("Vennligst skriv inn innhold for forbedring");
      return;
    }

    improveContentMutation.mutate({
      originalContent,
      platform,
      tone,
      length,
      addEmojis,
      addHashtags,
    });
  };

  const handleCopyContent = () => {
    if (improveContentMutation.data?.improvedContent) {
      navigator.clipboard.writeText(improveContentMutation.data.improvedContent);
      setCopiedContent(true);
      toast.success("Forbedret innhold kopiert!");
      setTimeout(() => setCopiedContent(false), 2000);
    }
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        disabled={!originalContent.trim()}
        className="w-full"
      >
        <Sparkles className="h-4 w-4 mr-2" />
        Forbedre innhold
      </Button>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Forbedre innhold med AI
        </CardTitle>
        <CardDescription>
          Forbedre innholdet ditt med avanserte AI-teknikker
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Options */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="add-emojis"
              checked={addEmojis}
              onCheckedChange={(checked) => setAddEmojis(checked as boolean)}
            />
            <Label htmlFor="add-emojis" className="cursor-pointer">
              Legg til emojier
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="add-hashtags"
              checked={addHashtags}
              onCheckedChange={(checked) => setAddHashtags(checked as boolean)}
            />
            <Label htmlFor="add-hashtags" className="cursor-pointer">
              Legg til hashtags
            </Label>
          </div>
        </div>

        {/* Improved Content Display */}
        {improveContentMutation.isPending ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : improveContentMutation.data?.improvedContent ? (
          <div className="space-y-3">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Forbedret innhold:</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {improveContentMutation.data.improvedContent}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyContent}
              className="w-full"
            >
              {copiedContent ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Kopiert
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Kopier forbedret innhold
                </>
              )}
            </Button>
          </div>
        ) : null}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleImproveContent}
            disabled={improveContentMutation.isPending || !originalContent.trim()}
            className="flex-1"
          >
            {improveContentMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {improveContentMutation.isPending ? "Forbedrer..." : "Forbedre innhold"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            className="flex-1"
          >
            Lukk
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}