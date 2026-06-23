/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { MessageSquare, Sparkles, Copy, CheckCircle2, Loader2, ThumbsUp, Heart, Lightbulb } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PAGE_DESCRIPTIONS } from "@/lib/pageDescriptions";

export default function EngagementHelper() {
  const { data: subscription } = trpc.user.getSubscription.useQuery();
  const [originalPost, setOriginalPost] = useState("");
  const [responseType, setResponseType] = useState<"supportive" | "insightful" | "question" | "appreciation">("supportive");
  const [generatedResponse, setGeneratedResponse] = useState("");
  const [copied, setCopied] = useState(false);

  // Auto-save draft functionality
  const [, setDraftSaved] = useState(false);
  const [, setLastSavedAt] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { data: existingDraft } = trpc.drafts.get.useQuery({ pageType: "engagement" });
  const saveDraftMutation = trpc.drafts.save.useMutation({
    onSuccess: () => {
      setDraftSaved(true);
      setLastSavedAt(new Date());
    },
  });
  const deleteDraftMutation = trpc.drafts.delete.useMutation();

  // Restore draft on load
  useEffect(() => {
    if (existingDraft && !originalPost) {
      try {
        const formData = JSON.parse(existingDraft.formData);
        if (formData.originalPost) setOriginalPost(formData.originalPost);
        if (formData.responseType) setResponseType(formData.responseType);
        toast.info("Utkast gjenopprettet", { duration: 2000 });
      } catch (e) {
        console.error("Failed to parse draft", e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingDraft]);

  // Auto-save with debounce
  const autoSaveDraft = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      const formData = JSON.stringify({
        originalPost,
        responseType,
      });
      
      if (originalPost) {
        saveDraftMutation.mutate({
          pageType: "engagement",
          formData,
          title: "Engasjement utkast",
        });
      }
    }, 1500);
  }, [originalPost, responseType, saveDraftMutation]);

  // Trigger auto-save when form changes
  useEffect(() => {
    if (originalPost) {
      setDraftSaved(false);
      autoSaveDraft();
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [originalPost, responseType, autoSaveDraft]);

  // Clear draft after successful generation
  const clearDraft = () => {
    deleteDraftMutation.mutate({ pageType: "engagement" });
    setDraftSaved(false);
    setLastSavedAt(null);
  };

  const generateResponseMutation = trpc.engagement.generateResponse.useMutation({
    onSuccess: (data: { response: string }) => {
      setGeneratedResponse(data.response);
      clearDraft();
      toast.success("Svar generert!");
    },
    onError: (error: { message: string }) => {
      toast.error(error.message);
    },
  });

  const handleGenerate = () => {
    if (!originalPost.trim()) {
      toast.error("Vennligst lim inn innlegget du vil svare på");
      return;
    }
    generateResponseMutation.mutate({ originalPost, responseType });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedResponse);
    setCopied(true);
    toast.success("Kopiert!");
    setTimeout(() => setCopied(false), 2000);
  };

  const isPro = subscription?.status === "active";

  if (!isPro) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="mb-8">
          <PageHeader title="Engasjement-Hjelper" description={PAGE_DESCRIPTIONS.engagementHelper} />
          <p className="text-muted-foreground mt-2">
            Generer smarte og engasjerende svar på innlegg
          </p>
        </div>

        <Card className="p-8 text-center border-2 border-dashed">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center mb-4">
            <MessageSquare className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-xl font-semibold mb-2">🔒 Pro-funksjon</h3>
          <p className="text-muted-foreground mb-6">
            Engasjement-Hjelper er kun tilgjengelig for Pro-abonnenter
          </p>
          <Button
            onClick={() => window.location.href = "/settings"}
            className="bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600"
          >
            Oppgrader til Pro
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-green-500 to-teal-500 bg-clip-text text-transparent">
          💬 Engasjement-Hjelper
        </h1>
        <p className="text-muted-foreground mt-2">
          Generer smarte og engasjerende svar på innlegg
        </p>
      </div>

      <div className="grid gap-6">
        {/* Input Card */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-500" />
            Innlegg å svare på
          </h2>

          <div className="space-y-4">
            <div>
              <Label htmlFor="originalPost">Lim inn innlegget</Label>
              <Textarea
                id="originalPost"
                placeholder="Lim inn innlegget du vil svare på her..."
                value={originalPost}
                onChange={(e) => setOriginalPost(e.target.value)}
                rows={6}
                className="mt-1"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Kopier innlegget fra LinkedIn, Twitter, eller andre plattformer
              </p>
            </div>

            <div>
              <Label htmlFor="responseType">Type svar</Label>
              <Select value={responseType} onValueChange={(value: typeof responseType) => setResponseType(value)}>
                <SelectTrigger id="responseType" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supportive">
                    <div className="flex items-center gap-2">
                      <ThumbsUp className="h-4 w-4 text-blue-500" />
                      <span>Støttende - Vis støtte og enighet</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="insightful">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-yellow-500" />
                      <span>Innsiktsfull - Legg til perspektiv</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="question">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-purple-500" />
                      <span>Spørsmål - Still oppfølgingsspørsmål</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="appreciation">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-red-500" />
                      <span>Takknemlighet - Takk for deling</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generateResponseMutation.isPending}
              className="w-full bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600"
            >
              {generateResponseMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Genererer...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generer svar
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Output Card */}
        {generatedResponse && (
          <Card className="p-6 bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-950/20 dark:to-teal-950/20 border-green-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Generert svar
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Kopiert!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Kopier
                  </>
                )}
              </Button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 whitespace-pre-wrap">
              {generatedResponse}
            </div>
          </Card>
        )}

        {/* Tips Card */}
        <Card className="p-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-blue-500" />
            Tips for bedre engasjement
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">1.</span>
              <span>Vær autentisk - rediger svaret til din egen stemme</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">2.</span>
              <span>Svar raskt - tidlig engasjement gir bedre synlighet</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">3.</span>
              <span>Legg til personlig erfaring når det passer</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">4.</span>
              <span>Still oppfølgingsspørsmål for å starte samtale</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">5.</span>
              <span>Tag relevante personer når det er naturlig</span>
            </li>
          </ul>
        </Card>

        {/* Response Types Guide */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">📚 Guide til svartyper</h3>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <ThumbsUp className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h4 className="font-semibold">Støttende</h4>
                <p className="text-sm text-muted-foreground">
                  Perfekt for å vise enighet og bygge relasjoner
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <h4 className="font-semibold">Innsiktsfull</h4>
                <p className="text-sm text-muted-foreground">
                  Legg til verdi med ditt perspektiv og erfaring
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <h4 className="font-semibold">Spørsmål</h4>
                <p className="text-sm text-muted-foreground">
                  Start dypere samtaler med gjennomtenkte spørsmål
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <Heart className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h4 className="font-semibold">Takknemlighet</h4>
                <p className="text-sm text-muted-foreground">
                  Vis at du setter pris på innholdet som deles
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}