/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { 
  Mic, 
  Sparkles, 
  CheckCircle2, 
  Plus,
  Trash2,
  Brain,
  Zap,
  ArrowRight,
  FileText,
  Target,
  RefreshCw,
  Lightbulb,
  AlertCircle
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { PAGE_DESCRIPTIONS } from "@/lib/pageDescriptions";

export default function VoiceTraining() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  useLocation();
  const [newSample, setNewSample] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: subscription } = trpc.user.getSubscription.useQuery();
  const { data: voiceProfile, refetch: refetchProfile } = trpc.voice.getProfile.useQuery();
  const { data: samples, refetch: refetchSamples } = trpc.voice.getSamples.useQuery();

  const addSampleMutation = trpc.voice.addSample.useMutation({
    onSuccess: () => {
      setNewSample("");
      refetchSamples();
      toast.success("Tekstprøve lagt til!");
    },
    onError: (error) => {
      toast.error(error.message || "Kunne ikke legge til tekstprøve");
    }
  });

  const deleteSampleMutation = trpc.voice.deleteSample.useMutation({
    onSuccess: () => {
      refetchSamples();
      toast.success("Tekstprøve slettet");
    },
    onError: (error) => {
      toast.error(error.message || "Kunne ikke slette tekstprøve");
    }
  });

  const analyzeVoiceMutation = trpc.voice.trainProfile.useMutation({
    onSuccess: () => {
      refetchProfile();
      setIsAnalyzing(false);
      toast.success("Stemmeprofil oppdatert!");
    },
    onError: (error: any) => {
      setIsAnalyzing(false);
      toast.error(error.message || "Kunne ikke analysere stemmen");
    }
  });

  if (authLoading || !isAuthenticated) {
    if (!authLoading && !isAuthenticated) {
      window.location.href = getLoginUrl();
      return null;
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex flex-col items-center gap-4"><div className="h-14 w-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div><p className="text-sm text-muted-foreground animate-pulse">Laster...</p></div>
      </div>
    );
  }

  const isPro = subscription?.status === "active";
  const samplesCount = samples?.length || 0;
  const minSamplesRequired = 3;
  const canAnalyze = samplesCount >= minSamplesRequired;
  const progress = Math.min((samplesCount / minSamplesRequired) * 100, 100);

  const handleAddSample = () => {
    if (!newSample.trim()) {
      toast.error("Vennligst skriv inn en tekstprøve");
      return;
    }
    if (newSample.trim().length < 50) {
      toast.error("Tekstprøven må være minst 50 tegn");
      return;
    }
    addSampleMutation.mutate({ sampleText: newSample.trim() });
  };

  const handleDeleteSample = (sampleId: number) => {
    deleteSampleMutation.mutate({ sampleId });
  };

  const handleAnalyze = () => {
    if (!canAnalyze) {
      toast.error(`Du trenger minst ${minSamplesRequired} tekstprøver for å analysere`);
      return;
    }
    setIsAnalyzing(true);
    analyzeVoiceMutation.mutate();
  };

  const getStatusBadge = () => {
    if (!voiceProfile) return { label: "Ikke startet", color: "bg-gray-100 text-gray-700" };
    switch (voiceProfile.trainingStatus) {
      case "trained":
        return { label: "✅ Trent", color: "bg-green-100 text-green-700" };
      case "in_progress":
        return { label: "⏳ Analyserer...", color: "bg-yellow-100 text-yellow-700" };
      case "needs_update":
        return { label: "🔄 Trenger oppdatering", color: "bg-orange-100 text-orange-700" };
      default:
        return { label: "Ikke startet", color: "bg-gray-100 text-gray-700" };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <main className="container py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Mic className="h-6 w-6 text-white" />
            </div>
            <div>
              <PageHeader title="Stemmetrening" description={PAGE_DESCRIPTIONS.voiceTraining} />
              <p className="text-muted-foreground">
                Lær AI å skrive som deg - din unike stemme, din stil
              </p>
            </div>
          </div>

          {!isPro && (
            <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 mb-6">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="font-medium text-purple-800">Stemmetrening krever Pro-abonnement</p>
                      <p className="text-sm text-purple-700">Oppgrader for å trene AI til å skrive i din stil</p>
                    </div>
                  </div>
                  <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90">
                    Oppgrader nå
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Status Overview */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge className={statusBadge.color}>{statusBadge.label}</Badge>
              </div>
              <p className="text-2xl font-bold text-purple-600">
                {voiceProfile?.trainingStatus === "trained" ? "Klar" : "Venter"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Tekstprøver</span>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{samplesCount}</p>
              <p className="text-xs text-muted-foreground">Minimum {minSamplesRequired} kreves</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Fremgang</span>
                <Target className="h-4 w-4 text-muted-foreground" />
              </div>
              <Progress value={progress} className="mb-2" />
              <p className="text-xs text-muted-foreground">
                {canAnalyze ? "Klar til analyse!" : `${minSamplesRequired - samplesCount} prøver gjenstår`}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* How it works */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Hvordan det fungerer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-purple-600">1</span>
                </div>
                <h4 className="font-semibold mb-1">Del tekstprøver</h4>
                <p className="text-sm text-muted-foreground">
                  Lim inn eksempler på innhold du har skrevet tidligere
                </p>
              </div>
              <div className="text-center">
                <div className="h-12 w-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-pink-600">2</span>
                </div>
                <h4 className="font-semibold mb-1">AI analyserer</h4>
                <p className="text-sm text-muted-foreground">
                  AI lærer din tone, ordvalg og skrivestil
                </p>
              </div>
              <div className="text-center">
                <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-primary">3</span>
                </div>
                <h4 className="font-semibold mb-1">Personlig innhold</h4>
                <p className="text-sm text-muted-foreground">
                  Alt generert innhold høres ut som deg
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Voice Profile Summary (if trained) */}
        {voiceProfile?.trainingStatus === "trained" && voiceProfile.profileSummary && (
          <Card className="mb-8 border-green-200 bg-green-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                Din stemmeprofil
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">{voiceProfile.profileSummary}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {voiceProfile.vocabularyLevel && (
                  <div className="text-center p-3 bg-white rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Ordforråd</p>
                    <p className="font-semibold capitalize">{voiceProfile.vocabularyLevel}</p>
                  </div>
                )}
                {voiceProfile.sentenceStyle && (
                  <div className="text-center p-3 bg-white rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Setningsstil</p>
                    <p className="font-semibold capitalize">{voiceProfile.sentenceStyle}</p>
                  </div>
                )}
                <div className="text-center p-3 bg-white rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Bruker emojis</p>
                  <p className="font-semibold">{voiceProfile.usesEmojis ? "Ja" : "Nei"}</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Bruker hashtags</p>
                  <p className="font-semibold">{voiceProfile.usesHashtags ? "Ja" : "Nei"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add Sample Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Legg til tekstprøve
            </CardTitle>
            <CardDescription>
              Lim inn et eksempel på innhold du har skrevet. Jo flere prøver, jo bedre lærer AI din stil.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Textarea
                placeholder="Lim inn et LinkedIn-innlegg, en e-post, en artikkel eller annet innhold du har skrevet..."
                value={newSample}
                onChange={(e) => setNewSample(e.target.value)}
                rows={6}
                disabled={!isPro}
                className="resize-none"
              />
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {newSample.length} tegn (minimum 50)
                </p>
                <Button 
                  onClick={handleAddSample}
                  disabled={!isPro || addSampleMutation.isPending || newSample.length < 50}
                >
                  {addSampleMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Legger til...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Legg til prøve
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Tips */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800 mb-1">Tips for bedre resultater</p>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Bruk innhold du er stolt av og som representerer din beste skriving</li>
                    <li>• Inkluder ulike typer innhold (innlegg, e-poster, artikler)</li>
                    <li>• Jo mer variert, jo bedre forstår AI din stil</li>
                    <li>• Minimum 3 prøver, men 5-10 gir best resultat</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Existing Samples */}
        {samples && samples.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Dine tekstprøver ({samples.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {samples.map((sample: { id: number; sampleText: string }, index: number) => (
                  <div key={sample.id} className="p-4 border rounded-lg bg-gray-50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">Prøve {index + 1}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {sample.sampleText.length} tegn
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {sample.sampleText}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteSample(sample.id)}
                        disabled={deleteSampleMutation.isPending}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analyze Button */}
        <Card className={canAnalyze ? "border-primary bg-primary/5" : ""}>
          <CardContent className="pt-6">
            <div className="text-center">
              {canAnalyze ? (
                <>
                  <Brain className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">Klar til å analysere!</h3>
                  <p className="text-muted-foreground mb-4">
                    Du har {samplesCount} tekstprøver. Klikk for å la AI lære din skrivestil.
                  </p>
                  <Button 
                    size="lg"
                    onClick={handleAnalyze}
                    disabled={!isPro || isAnalyzing}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                        Analyserer...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Analyser min stemme
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">Trenger flere prøver</h3>
                  <p className="text-muted-foreground mb-4">
                    Legg til {minSamplesRequired - samplesCount} flere tekstprøver for å starte analysen.
                  </p>
                  <Progress value={progress} className="max-w-xs mx-auto" />
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pro Feature Banner */}
        {!isPro && (
          <Card className="mt-8 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-200">
            <CardContent className="pt-6 text-center">
              <Mic className="h-10 w-10 text-purple-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Lås opp Stemmetrening</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                Med Pro-abonnement kan du trene AI til å skrive i din unike stil. 
                Aldri mer generisk AI-tekst - alt innhold høres ut som deg.
              </p>
              <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90">
                Oppgrader til Pro - 199 kr/mnd
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}