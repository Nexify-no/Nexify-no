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
import { Plus, Trash2, CheckCircle2, Circle, ArrowRight, Sparkles } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { PAGE_DESCRIPTIONS } from "@/lib/pageDescriptions";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";

export default function ContentSeries() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [postCount, setPostCount] = useState<number>(3);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [seriesIdToDelete, setSeriesIdToDelete] = useState<number | null>(null);
  const [seriesTitleToDelete, setSeriesTitleToDelete] = useState("");


  const { data: seriesData, refetch } = trpc.series.list.useQuery();
  const seriesList = seriesData?.map((s: any) => ({
    ...s,
    totalPosts: s.totalParts,
    generatedPosts: 0, // Will be calculated from seriesPosts
  })) || [];
  const { data: subscription } = trpc.user.getSubscription.useQuery();

  // Auto-save draft functionality
  const [, setDraftSaved] = useState(false);
  const [, setLastSavedAt] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { data: existingDraft } = trpc.drafts.get.useQuery({ pageType: "series" });
  const saveDraftMutation = trpc.drafts.save.useMutation({
    onSuccess: () => {
      setDraftSaved(true);
      setLastSavedAt(new Date());
    },
  });
  const deleteDraftMutation = trpc.drafts.delete.useMutation();

  // Restore draft on load
  useEffect(() => {
    if (existingDraft && !title) {
      try {
        const formData = JSON.parse(existingDraft.formData);
        if (formData.title) setTitle(formData.title);
        if (formData.description) setDescription(formData.description);
        if (formData.postCount) setPostCount(formData.postCount);
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
        title,
        description,
        postCount,
      });
      
      if (title || description) {
        saveDraftMutation.mutate({
          pageType: "series",
          formData,
          title: title.substring(0, 50) || "Serie utkast",
        });
      }
    }, 1500);
  }, [title, description, postCount, saveDraftMutation]);

  // Trigger auto-save when form changes
  useEffect(() => {
    if (title || description) {
      setDraftSaved(false);
      autoSaveDraft();
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [title, description, postCount, autoSaveDraft]);

  // Clear draft after successful creation
  const clearDraft = () => {
    deleteDraftMutation.mutate({ pageType: "series" });
    setDraftSaved(false);
    setLastSavedAt(null);
  };

  const createMutation = trpc.series.create.useMutation({
    onSuccess: () => {
      toast.success("Serie opprettet!");
      clearDraft();
      setTitle("");
      setDescription("");
      setPostCount(3);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Kunne ikke opprette serie");
    },
  });

  const deleteMutation = trpc.series.delete.useMutation({
    onSuccess: () => {
      toast.success("Serie slettet");
      setDeleteConfirmOpen(false);
      setSeriesIdToDelete(null);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Kunne ikke slette serie");
    },
  });

  const handleDeleteClick = (id: number, title: string) => {
    setSeriesIdToDelete(id);
    setSeriesTitleToDelete(title);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (seriesIdToDelete) {
      deleteMutation.mutate({ id: seriesIdToDelete });
    }
  };

  const generatePostMutation = trpc.series.generatePost.useMutation({
    onSuccess: () => {
      toast.success("Innlegg generert!");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Kunne ikke generere innlegg");
    },
  });

  const isPro = subscription?.status === "active";

  const handleCreate = () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Fyll inn tittel og beskrivelse");
      return;
    }
    createMutation.mutate({ title, description, postCount });
  };

  return (
    <>
      <DeleteConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Slett serie?"
        description="Denne handlingen kan ikke angres. All innhold i serien vil bli slettet permanent."
        itemName={seriesTitleToDelete}
        isLoading={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setSeriesIdToDelete(null);
        }}
        confirmText="Slett"
        cancelText="Avbryt"
        isDangerous={true}
      />
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <main className="container py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <PageHeader title="Innholds-Serier" description={PAGE_DESCRIPTIONS.contentSeries} />
              <p className="text-muted-foreground mt-1">
                Planlegg og generer flerdelte innleggsserier
              </p>
            </div>
          </div>

          {!isPro && (
            <Card className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
              <div className="flex items-center gap-3">
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500">PRO</Badge>
                <p className="text-sm text-amber-900">
                  Innholds-Serier krever Pro-abonnement for å planlegge og generere serier automatisk
                </p>
              </div>
            </Card>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Create New Series */}
          <Card className="p-6 border-2 hover:border-purple-200 transition-all">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-600" />
              Opprett ny serie
            </h2>

            <div className="space-y-4">
              <div>
                <Label>Serietittel</Label>
                <Input
                  placeholder="F.eks: 'LinkedIn Masterclass'"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!isPro || createMutation.isPending}
                />
              </div>

              <div>
                <Label>Beskrivelse</Label>
                <Textarea
                  placeholder="Beskriv hva serien skal handle om..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!isPro || createMutation.isPending}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Antall innlegg</Label>
                  <Select
                    value={postCount.toString()}
                    onValueChange={(v) => setPostCount(parseInt(v))}
                    disabled={!isPro || createMutation.isPending}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 innlegg</SelectItem>
                      <SelectItem value="5">5 innlegg</SelectItem>
                      <SelectItem value="7">7 innlegg</SelectItem>
                      <SelectItem value="10">10 innlegg</SelectItem>
                    </SelectContent>
                  </Select>
                </div>


              </div>

              <Button
                onClick={handleCreate}
                disabled={!isPro || createMutation.isPending}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {createMutation.isPending ? "Oppretter..." : "Opprett serie"}
              </Button>
            </div>
          </Card>

          {/* Info Card */}
          <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
            <h3 className="text-xl font-bold mb-4 text-purple-900">Hvordan fungerer det?</h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-purple-900">Opprett en serie</h4>
                  <p className="text-sm text-purple-700">
                    Velg tema, antall innlegg og plattform
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-purple-900">Generer innlegg</h4>
                  <p className="text-sm text-purple-700">
                    AI lager hvert innlegg i serien automatisk
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-purple-900">Publiser gradvis</h4>
                  <p className="text-sm text-purple-700">
                    Publiser ett innlegg om gangen for maksimal effekt
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-white rounded-lg border border-purple-200">
              <p className="text-sm text-purple-900 font-medium">💡 Tips:</p>
              <p className="text-sm text-purple-700 mt-1">
                Serier fungerer best med 3-7 innlegg. Hold hvert innlegg fokusert på ett hovedpoeng.
              </p>
            </div>
          </Card>
        </div>

        {/* Existing Series */}
        {seriesList && seriesList.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">Dine serier</h2>
            <div className="grid gap-6">
              {seriesList.map((series: any) => (
                <Card key={series.id} className="p-6 hover:shadow-lg transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold">{series.title}</h3>

                        <Badge
                          variant={series.status === "completed" ? "default" : "secondary"}
                          className={series.status === "completed" ? "bg-green-600" : ""}
                        >
                          {series.status === "completed" ? "Fullført" : "Pågår"}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">{series.description}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(series.id, series.title)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>

                  {/* Timeline */}
                  <div className="relative">
                    <div className="flex items-center gap-2 overflow-x-auto pb-4">
                      {Array.from({ length: series.totalPosts }).map((_, index) => {
                        const isGenerated = index < series.generatedPosts;
                        return (
                          <div key={index} className="flex items-center flex-shrink-0">
                            <div
                              className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                                isGenerated
                                  ? "bg-green-600 border-green-600 text-white"
                                  : "bg-background border-muted-foreground/30 text-muted-foreground"
                              }`}
                            >
                              {isGenerated ? (
                                <CheckCircle2 className="w-5 h-5" />
                              ) : (
                                <Circle className="w-5 h-5" />
                              )}
                            </div>
                            {index < series.totalPosts - 1 && (
                              <div
                                className={`w-12 h-0.5 ${
                                  isGenerated ? "bg-green-600" : "bg-muted-foreground/30"
                                }`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      {series.generatedPosts} av {series.totalPosts} innlegg generert
                    </p>
                    {series.generatedPosts < series.totalPosts && (
                      <Button
                        onClick={() => generatePostMutation.mutate({ seriesId: series.id })}
                        disabled={generatePostMutation.isPending}
                        size="sm"
                        className="bg-gradient-to-r from-purple-600 to-pink-600"
                      >
                        Generer neste innlegg
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {seriesList && seriesList.length === 0 && isPro && (
          <Card className="p-12 text-center mt-8 border-dashed border-2">
            <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Ingen serier ennå</h3>
            <p className="text-muted-foreground">
              Opprett din første innholdsserie for å komme i gang!
            </p>
          </Card>
        )}
      </main>
      </div>
    </>
  );
}