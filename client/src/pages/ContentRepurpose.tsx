/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Recycle, ArrowRight, Sparkles, TrendingUp, Cloud, Loader2, RefreshCw, Shuffle, Users, FileEdit, Lightbulb, CheckCircle2, ArrowDown, Zap } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/PageHeader";
import { PAGE_DESCRIPTIONS } from "@/lib/pageDescriptions";
import { Breadcrumb } from "@/components/Breadcrumb";

export default function ContentRepurpose() {
  const [, setLocation] = useLocation();
  const [selectedPost, setSelectedPost] = useState<number | null>(null);
  const [targetPlatform, setTargetPlatform] = useState<string>("");
  const [repurposeType, setRepurposeType] = useState<string>("");

  const { data: posts, isLoading } = trpc.content.list.useQuery();
  const { data: subscription } = trpc.user.getSubscription.useQuery();

  // Auto-save draft functionality
  const [draftSaved, setDraftSaved] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { data: existingDraft } = trpc.drafts.get.useQuery({ pageType: "repurpose" });
  const saveDraftMutation = trpc.drafts.save.useMutation({
    onSuccess: () => {
      setDraftSaved(true);
      setLastSavedAt(new Date());
    },
  });
  const deleteDraftMutation = trpc.drafts.delete.useMutation();

  // Restore draft on load
  useEffect(() => {
    if (existingDraft && !selectedPost) {
      try {
        const formData = JSON.parse(existingDraft.formData);
        if (formData.selectedPost) setSelectedPost(formData.selectedPost);
        if (formData.targetPlatform) setTargetPlatform(formData.targetPlatform);
        if (formData.repurposeType) setRepurposeType(formData.repurposeType);
        toast.info("Utkast gjenopprettet", { duration: 2000 });
      } catch (e) {
        // Failed to parse draft
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
        selectedPost,
        targetPlatform,
        repurposeType,
      });
      
      if (selectedPost || targetPlatform || repurposeType) {
        saveDraftMutation.mutate({
          pageType: "repurpose",
          formData,
          title: "Gjenbruk utkast",
        });
      }
    }, 1500);
  }, [selectedPost, targetPlatform, repurposeType, saveDraftMutation]);

  // Trigger auto-save when form changes
  useEffect(() => {
    if (selectedPost || targetPlatform || repurposeType) {
      setDraftSaved(false);
      autoSaveDraft();
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [selectedPost, targetPlatform, repurposeType, autoSaveDraft]);

  // Clear draft after successful repurpose
  const clearDraft = () => {
    deleteDraftMutation.mutate({ pageType: "repurpose" });
    setDraftSaved(false);
    setLastSavedAt(null);
  };

  const repurposeMutation = trpc.content.repurpose.useMutation({
    onSuccess: (data: any) => {
      toast.success("Innhold gjenbrukt!");
      clearDraft();
      setLocation(`/generate?content=${encodeURIComponent(data.content)}`);
    },
    onError: () => {
      toast.error("Kunne ikke gjenbruke innhold");
    },
  });

  const isPro = subscription?.status === "active";

  const repurposeTypes = [
    { value: "platform_adapt", label: "Tilpass til annen plattform", description: "Juster lengde og tone", icon: RefreshCw },
    { value: "format_change", label: "Endre format", description: "Fra liste til fortelling, etc.", icon: Shuffle },
    { value: "audience_shift", label: "Bytt målgruppe", description: "Fra B2B til B2C, etc.", icon: Users },
    { value: "update", label: "Oppdater med ny info", description: "Legg til nye data/insights", icon: FileEdit },
  ];

  const handleRepurpose = () => {
    if (!selectedPost || !targetPlatform || !repurposeType) {
      toast.error("Vennligst fyll ut alle feltene");
      return;
    }

    if (!isPro) {
      toast.error("Gjenbruk-Maskin krever Pro-abonnement");
      return;
    }

    repurposeMutation.mutate({
      postId: selectedPost,
      targetPlatform,
      repurposeType: repurposeType as "platform_adapt" | "format_change" | "audience_shift" | "update",
    });
  };

  const examples = [
    {
      original: { platform: "LinkedIn", content: "Lang artikkel om AI-trender (500 ord)" },
      repurposed: { platform: "Twitter", content: "5 tweets med key takeaways" },
      type: "platform_adapt",
      typeLabel: "Plattformtilpasning",
      engagement: "+45%",
    },
    {
      original: { platform: "Instagram", content: "Visuell guide til produktivitet" },
      repurposed: { platform: "LinkedIn", content: "Profesjonell artikkel med data" },
      type: "audience_shift",
      typeLabel: "Målgruppebytte",
      engagement: "+67%",
    },
    {
      original: { platform: "Facebook", content: "Kundehistorie fra 2025" },
      repurposed: { platform: "LinkedIn", content: "Oppdatert case study 2026" },
      type: "update",
      typeLabel: "Oppdatering",
      engagement: "+89%",
    },
  ];

  // Calculate current step
  const currentStep = !selectedPost ? 1 : !repurposeType ? 2 : !targetPlatform ? 3 : 4;

  const platformColors: Record<string, string> = {
    linkedin: "bg-blue-100 text-blue-700 border-blue-200",
    twitter: "bg-sky-100 text-sky-700 border-sky-200",
    instagram: "bg-pink-100 text-pink-700 border-pink-200",
    facebook: "bg-indigo-100 text-indigo-700 border-indigo-200",
    LinkedIn: "bg-blue-100 text-blue-700 border-blue-200",
    Twitter: "bg-sky-100 text-sky-700 border-sky-200",
    Instagram: "bg-pink-100 text-pink-700 border-pink-200",
    Facebook: "bg-indigo-100 text-indigo-700 border-indigo-200",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <main className="container py-6 max-w-7xl">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Gjenbruk-Maskin", current: true },
          ]}
          className="mb-4"
        />

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Recycle className="h-5 w-5 text-white" />
              </div>
              <div>
                <PageHeader title="Gjenbruk-Maskin" description={PAGE_DESCRIPTIONS.repurpose} />
                <p className="text-sm text-muted-foreground -mt-3">
                  Få mer ut av eksisterende innhold — tilpass og gjenbruk smart
                </p>
              </div>
            </div>
            {/* Auto-save indicator */}
            {(draftSaved || lastSavedAt) && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
                <Cloud className="h-3 w-3" />
                <span>
                  {draftSaved ? "Lagret" : "Lagrer..."}
                  {lastSavedAt && (
                    <span className="ml-1">
                      {lastSavedAt.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Pro upsell */}
          {!isPro && (
            <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200/60 mt-4">
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-purple-800">Gjenbruk-Maskin krever Pro-abonnement</p>
                      <p className="text-xs text-purple-600">Oppgrader for å maksimere verdien av ditt innhold</p>
                    </div>
                  </div>
                  <Button size="sm" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white">
                    Oppgrader nå
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Step Progress Indicator */}
        <div className="mb-6">
          <div className="flex items-center gap-0">
            {[
              { step: 1, label: "Velg innlegg" },
              { step: 2, label: "Velg metode" },
              { step: 3, label: "Velg plattform" },
            ].map((item, index) => (
              <div key={item.step} className="flex items-center flex-1">
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      currentStep > item.step
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                        : currentStep === item.step
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {currentStep > item.step ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      item.step
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium hidden sm:inline ${
                      currentStep >= item.step ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
                {index < 2 && (
                  <div
                    className={`h-0.5 flex-1 mx-2 rounded-full transition-all ${
                      currentStep > item.step ? "bg-emerald-500" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Form Area */}
          <div className="lg:col-span-2 space-y-5">
            {/* Step 1: Select Post */}
            <Card className={`transition-all ${currentStep === 1 ? "ring-2 ring-primary/20 shadow-md" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    selectedPost ? "bg-emerald-500 text-white" : "bg-primary/10 text-primary"
                  }`}>
                    {selectedPost ? <CheckCircle2 className="h-3.5 w-3.5" /> : "1"}
                  </div>
                  <CardTitle className="text-base">Velg innlegg å gjenbruke</CardTitle>
                </div>
                <CardDescription className="ml-8.5 text-xs">
                  Velg et av dine eksisterende innlegg som utgangspunkt
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Select
                  value={selectedPost?.toString() || ""}
                  onValueChange={(value) => setSelectedPost(parseInt(value))}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Velg et innlegg..." />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoading ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                        Laster innlegg...
                      </div>
                    ) : posts && posts.length > 0 ? (
                      posts.map((post: any) => (
                        <SelectItem key={post.id} value={post.id.toString()}>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${platformColors[post.platform] || ""}`}>
                              {post.platform}
                            </Badge>
                            <span className="truncate max-w-xs text-sm">
                              {post.generatedContent.substring(0, 50)}...
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-3 text-center text-sm text-muted-foreground">
                        Ingen innlegg funnet. Generer innhold først.
                      </div>
                    )}
                  </SelectContent>
                </Select>

                {/* Show selected post preview */}
                {selectedPost && posts && (
                  <div className="mt-3 p-3 bg-muted/40 rounded-lg border border-border/50">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Valgt innlegg:</p>
                    <p className="text-sm line-clamp-2">
                      {posts.find((p: any) => p.id === selectedPost)?.generatedContent?.substring(0, 150)}...
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Repurpose Type */}
            <Card className={`transition-all ${currentStep === 2 ? "ring-2 ring-primary/20 shadow-md" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    repurposeType ? "bg-emerald-500 text-white" : "bg-primary/10 text-primary"
                  }`}>
                    {repurposeType ? <CheckCircle2 className="h-3.5 w-3.5" /> : "2"}
                  </div>
                  <CardTitle className="text-base">Hvordan vil du gjenbruke?</CardTitle>
                </div>
                <CardDescription className="ml-8.5 text-xs">
                  Velg en metode for å transformere innholdet ditt
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {repurposeTypes.map((type) => {
                    const Icon = type.icon;
                    const isSelected = repurposeType === type.value;
                    return (
                      <div
                        key={type.value}
                        className={`group relative cursor-pointer rounded-xl border p-3.5 transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border hover:border-primary/40 hover:bg-muted/30"
                        }`}
                        onClick={() => setRepurposeType(type.value)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                          }`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${isSelected ? "text-primary" : ""}`}>
                              {type.label}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {type.description}
                            </p>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Step 3: Target Platform */}
            <Card className={`transition-all ${currentStep === 3 ? "ring-2 ring-primary/20 shadow-md" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    targetPlatform ? "bg-emerald-500 text-white" : "bg-primary/10 text-primary"
                  }`}>
                    {targetPlatform ? <CheckCircle2 className="h-3.5 w-3.5" /> : "3"}
                  </div>
                  <CardTitle className="text-base">Velg målplattform</CardTitle>
                </div>
                <CardDescription className="ml-8.5 text-xs">
                  Hvilken plattform skal det nye innholdet tilpasses for?
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { value: "linkedin", label: "LinkedIn", color: "bg-blue-500" },
                    { value: "twitter", label: "Twitter/X", color: "bg-sky-500" },
                    { value: "instagram", label: "Instagram", color: "bg-pink-500" },
                    { value: "facebook", label: "Facebook", color: "bg-indigo-500" },
                  ].map((platform) => {
                    const isSelected = targetPlatform === platform.value;
                    return (
                      <div
                        key={platform.value}
                        className={`cursor-pointer rounded-xl border p-3 text-center transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border hover:border-primary/40 hover:bg-muted/30"
                        }`}
                        onClick={() => setTargetPlatform(platform.value)}
                      >
                        <div className={`h-8 w-8 rounded-lg ${platform.color} mx-auto mb-2 flex items-center justify-center`}>
                          <span className="text-white text-xs font-bold">
                            {platform.label.charAt(0)}
                          </span>
                        </div>
                        <p className={`text-xs font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>
                          {platform.label}
                        </p>
                        {isSelected && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary mx-auto mt-1" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Action Button */}
            <Button
              className="w-full h-12 text-sm font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/20"
              size="lg"
              onClick={handleRepurpose}
              disabled={!selectedPost || !targetPlatform || !repurposeType || repurposeMutation.isPending || !isPro}
            >
              {repurposeMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gjenbruker innhold...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Recycle className="h-4 w-4" />
                  Gjenbruk innhold
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Success Stories */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">Suksesshistorier</CardTitle>
                    <CardDescription className="text-xs">
                      Eksempler på vellykket gjenbruk
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {examples.map((example, index) => (
                    <div key={index} className="p-3 bg-muted/40 rounded-lg border border-border/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${platformColors[example.original.platform] || ""}`}>
                          {example.original.platform}
                        </Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${platformColors[example.repurposed.platform] || ""}`}>
                          {example.repurposed.platform}
                        </Badge>
                        <Badge className="ml-auto bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0 hover:bg-emerald-100">
                          {example.engagement}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {example.original.content}
                      </p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <ArrowDown className="h-3 w-3 text-emerald-500" />
                        <p className="text-xs font-medium text-emerald-700">
                          {example.repurposed.content}
                        </p>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5 capitalize">
                        {example.typeLabel}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Tips */}
            <Card className="bg-gradient-to-br from-emerald-50/80 to-teal-50/80 border-emerald-200/60">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <Lightbulb className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <CardTitle className="text-sm text-emerald-800">Tips for gjenbruk</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {[
                    "Gjenbruk high-performing innhold",
                    "Tilpass tone til hver plattform",
                    "Oppdater med fersk data",
                    "Test forskjellige formater",
                  ].map((tip, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Zap className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-emerald-700">{tip}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* How it works */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Slik fungerer det
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {[
                    { step: "1", text: "Velg et eksisterende innlegg" },
                    { step: "2", text: "Velg gjenbruksmetode" },
                    { step: "3", text: "Velg ny plattform" },
                    { step: "4", text: "AI tilpasser innholdet automatisk" },
                  ].map((item) => (
                    <div key={item.step} className="flex items-center gap-2.5">
                      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-primary">{item.step}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{item.text}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}