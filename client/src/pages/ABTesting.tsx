/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Zap, TrendingUp, Trophy, Target, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PAGE_DESCRIPTIONS } from "@/lib/pageDescriptions";

export default function ABTesting() {
  const [topic, setTopic] = useState("");
  const [variantA, setVariantA] = useState("");
  const [variantB, setVariantB] = useState("");
  useState<"A" | "B" | null>(null);

  const { data: tests, refetch } = trpc.abtest.list.useQuery();
  const { data: subscription } = trpc.user.getSubscription.useQuery();

  // Auto-save draft functionality
  const [, setDraftSaved] = useState(false);
  const [, setLastSavedAt] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { data: existingDraft } = trpc.drafts.get.useQuery({ pageType: "ab_test" });
  const saveDraftMutation = trpc.drafts.save.useMutation({
    onSuccess: () => {
      setDraftSaved(true);
      setLastSavedAt(new Date());
    },
  });
  const deleteDraftMutation = trpc.drafts.delete.useMutation();

  // Restore draft on load
  useEffect(() => {
    if (existingDraft && !topic) {
      try {
        const formData = JSON.parse(existingDraft.formData);
        if (formData.topic) setTopic(formData.topic);
        if (formData.variantA) setVariantA(formData.variantA);
        if (formData.variantB) setVariantB(formData.variantB);
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
        topic,
        variantA,
        variantB,
      });
      
      if (topic || variantA || variantB) {
        saveDraftMutation.mutate({
          pageType: "ab_test",
          formData,
          title: topic.substring(0, 50) || "A/B Test utkast",
        });
      }
    }, 1500);
  }, [topic, variantA, variantB, saveDraftMutation]);

  // Trigger auto-save when form changes
  useEffect(() => {
    if (topic || variantA || variantB) {
      setDraftSaved(false);
      autoSaveDraft();
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [topic, variantA, variantB, autoSaveDraft]);

  // Clear draft after successful creation
  const clearDraft = () => {
    deleteDraftMutation.mutate({ pageType: "ab_test" });
    setDraftSaved(false);
    setLastSavedAt(null);
  };

  const createMutation = trpc.abtest.create.useMutation({
    onSuccess: () => {
      toast.success("A/B test opprettet!");
      clearDraft();
      setTopic("");
      setVariantA("");
      setVariantB("");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Kunne ikke opprette test");
    },
  });

  const generateMutation = trpc.abtest.generate.useMutation({
    onSuccess: (data) => {
      setVariantA(data.variantA);
      setVariantB(data.variantB);
      toast.success("Varianter generert!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Kunne ikke generere varianter");
    },
  });

  const recordResultMutation = trpc.abtest.recordResult.useMutation({
    onSuccess: () => {
      toast.success("Resultat lagret!");
      refetch();
    },
  });

  const isPro = subscription?.status === "active";

  const handleGenerate = () => {
    if (!topic.trim()) {
      toast.error("Skriv inn et tema");
      return;
    }
    generateMutation.mutate({ topic });
  };

  const handleCreate = () => {
    if (!topic.trim() || !variantA.trim() || !variantB.trim()) {
      toast.error("Fyll inn alle feltene");
      return;
    }
    createMutation.mutate({ topic, variantA, variantB });
  };

  const handleRecordResult = (testId: number, winner: "a" | "b") => {
    recordResultMutation.mutate({ testId, winner });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-blue-50/30">
      <main className="container py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <PageHeader title="A/B Testing" description={PAGE_DESCRIPTIONS.abTesting} />
              <p className="text-muted-foreground mt-1">
                Test to versjoner og finn ut hva som fungerer best
              </p>
            </div>
          </div>

          {!isPro && (
            <Card className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
              <div className="flex items-center gap-3">
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500">PRO</Badge>
                <p className="text-sm text-amber-900">
                  A/B Testing krever Pro-abonnement for å generere og teste varianter
                </p>
              </div>
            </Card>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Create New Test */}
          <Card className="p-6 border-2 hover:border-blue-200 transition-all">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              Opprett ny test
            </h2>

            <div className="space-y-4">
              <div>
                <Label>Tema / Emne</Label>
                <Input
                  placeholder="F.eks: 'LinkedIn tips for bedrifter'"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={!isPro || generateMutation.isPending}
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={!isPro || generateMutation.isPending}
                variant="outline"
                className="w-full border-blue-200 hover:bg-blue-50"
              >
                <Zap className="w-4 h-4 mr-2" />
                {generateMutation.isPending ? "Genererer..." : "Generer 2 varianter automatisk"}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Eller skriv manuelt</span>
                </div>
              </div>

              <div>
                <Label>Variant A</Label>
                <Textarea
                  placeholder="Første versjon av innlegget..."
                  value={variantA}
                  onChange={(e) => setVariantA(e.target.value)}
                  disabled={!isPro || createMutation.isPending}
                  rows={4}
                />
              </div>

              <div>
                <Label>Variant B</Label>
                <Textarea
                  placeholder="Andre versjon av innlegget..."
                  value={variantB}
                  onChange={(e) => setVariantB(e.target.value)}
                  disabled={!isPro || createMutation.isPending}
                  rows={4}
                />
              </div>

              <Button
                onClick={handleCreate}
                disabled={!isPro || createMutation.isPending}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
              >
                {createMutation.isPending ? "Oppretter..." : "Opprett test"}
              </Button>
            </div>
          </Card>

          {/* Info Card */}
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <h3 className="text-xl font-bold mb-4 text-blue-900">Hvordan fungerer det?</h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-blue-900">Generer eller skriv</h4>
                  <p className="text-sm text-blue-700">
                    La AI generere 2 varianter, eller skriv dem selv
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-blue-900">Test i virkeligheten</h4>
                  <p className="text-sm text-blue-700">
                    Publiser begge variantene på forskjellige tidspunkter eller målgrupper
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-blue-900">Velg vinner</h4>
                  <p className="text-sm text-blue-700">
                    Sammenlign engasjement og marker hvilken som presterte best
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-white rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900 font-medium">💡 Tips:</p>
              <p className="text-sm text-blue-700 mt-1">
                Test én ting om gangen: overskrift, tone, lengde, eller CTA. Så vet du hva som gjorde forskjellen!
              </p>
            </div>
          </Card>
        </div>

        {/* Existing Tests */}
        {tests && tests.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Dine tester</h2>
            <div className="grid gap-6">
              {tests.map((test: any) => (
                <Card key={test.id} className="p-6 hover:shadow-lg transition-all">
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xl font-bold">{test.title}</h3>
                      {test.winner && (
                        <Badge className="bg-gradient-to-r from-green-600 to-emerald-600">
                          <Trophy className="w-3 h-3 mr-1" />
                          Vinner: Variant {test.winner}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Opprettet {new Date(test.createdAt).toLocaleDateString("nb-NO")}
                    </p>
                  </div>

                  {/* Side-by-Side Comparison */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Variant A */}
                    <Card
                      className={`p-4 transition-all ${
                        test.winner === "A"
                          ? "border-2 border-green-500 bg-green-50/50"
                          : test.winner === "B"
                          ? "opacity-60"
                          : "border-2 hover:border-blue-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="outline" className="font-bold">Variant A</Badge>
                        {test.winner === "A" && (
                          <Trophy className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{test.variantA}</p>
                      {!test.winner && (
                        <Button
                          onClick={() => handleRecordResult(test.id, "a")}
                          disabled={recordResultMutation.isPending}
                          size="sm"
                          className="w-full mt-4 bg-green-600 hover:bg-green-700"
                        >
                          <TrendingUp className="w-4 h-4 mr-2" />
                          Marker som vinner
                        </Button>
                      )}
                    </Card>

                    {/* Variant B */}
                    <Card
                      className={`p-4 transition-all ${
                        test.winner === "B"
                          ? "border-2 border-green-500 bg-green-50/50"
                          : test.winner === "A"
                          ? "opacity-60"
                          : "border-2 hover:border-blue-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="outline" className="font-bold">Variant B</Badge>
                        {test.winner === "B" && (
                          <Trophy className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{test.variantB}</p>
                      {!test.winner && (
                        <Button
                          onClick={() => handleRecordResult(test.id, "b")}
                          disabled={recordResultMutation.isPending}
                          size="sm"
                          className="w-full mt-4 bg-green-600 hover:bg-green-700"
                        >
                          <TrendingUp className="w-4 h-4 mr-2" />
                          Marker som vinner
                        </Button>
                      )}
                    </Card>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {tests && tests.length === 0 && isPro && (
          <Card className="p-12 text-center border-dashed border-2">
            <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Ingen tester ennå</h3>
            <p className="text-muted-foreground">
              Opprett din første A/B test for å finne ut hva som fungerer best!
            </p>
          </Card>
        )}
      </main>
    </div>
  );
}