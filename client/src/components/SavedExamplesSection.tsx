/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Star, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface SavedExamplesSectionProps {
  language: "no" | "en";
  onUseExample: (example: any) => void;
}

export function SavedExamplesSection({ language, onUseExample }: SavedExamplesSectionProps) {
  const utils = trpc.useUtils();
  const { data: examples, isLoading } = trpc.examples.list.useQuery();
  
  const useExampleMutation = trpc.examples.use.useMutation({
    onSuccess: (example) => {
      onUseExample(example);
    },
  });
  
  const deleteExampleMutation = trpc.examples.delete.useMutation({
    onSuccess: () => {
      utils.examples.list.invalidate();
      toast.success(language === "no" ? "Eksempel slettet!" : "Example deleted!");
    },
  });

  if (isLoading || !examples || examples.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" />
          {language === "no" ? "Mine lagrede eksempler" : "My Saved Examples"}
        </CardTitle>
        <CardDescription>
          {language === "no"
            ? "Klikk på et eksempel for å bruke det som mal"
            : "Click on an example to use it as a template"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {examples.map((example) => (
            <div
              key={example.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{example.title}</h4>
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary capitalize">
                    {example.platform}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium capitalize">
                    {example.tone}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {example.rawInput}
                </p>
                {example.usageCount > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <TrendingUp className="h-3 w-3" />
                    {language === "no" ? "Brukt" : "Used"} {example.usageCount} {language === "no" ? "ganger" : "times"}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => useExampleMutation.mutate({ exampleId: example.id })}
                  disabled={useExampleMutation.isPending}
                >
                  {language === "no" ? "Bruk" : "Use"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteExampleMutation.mutate({ exampleId: example.id })}
                  disabled={deleteExampleMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}