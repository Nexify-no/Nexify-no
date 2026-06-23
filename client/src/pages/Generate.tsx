/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Copy, Loader2, Sparkles, Wand2, Upload, X, Image as ImageIcon, Mic, Flame, Save, Cloud } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { Linkedin, CheckCircle2, AlertCircle, ExternalLink, RotateCcw, RotateCw } from "lucide-react";
import { Link } from "wouter";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ContentImprovement } from "@/components/ContentImprovement";
import { TrendingTopicsSidebar } from "@/components/TrendingTopicsSidebar";
import { LivePostPreview } from "@/components/LivePostPreview";
import { SavedTemplates } from "@/components/SavedTemplates";
import { TrendingSuggestions } from "@/components/TrendingSuggestions";
import { TrendingContentTemplates } from "@/components/TrendingContentTemplates";
import { SmartSchedulingSuggestions } from "@/components/SmartSchedulingSuggestions";

/* ─── LinkedIn Sub-Components ─── */

function PostToLinkedInButton({ content }: { content: string; platform: string }) {
  const { data: connectionStatus } = trpc.linkedin.getConnectionStatus.useQuery();
  const postMutation = trpc.linkedin.createPost.useMutation({
    onSuccess: () => { toast.success("Publisert til LinkedIn!"); },
    onError: (error) => { toast.error(error.message || "Kunne ikke publisere til LinkedIn"); },
  });

  if (!connectionStatus?.connected) return null;

  const handlePost = () => {
    if (!content.trim()) { toast.error("Innholdet kan ikke være tomt"); return; }
    postMutation.mutate({ content });
  };

  return (
    <Button
      onClick={handlePost}
      disabled={postMutation.isPending || !content.trim()}
      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
    >
      {postMutation.isPending ? (
        <><Loader2 className="h-4 w-4 animate-spin mr-2" />Publiserer...</>
      ) : (
        <><Linkedin className="h-4 w-4 mr-2" />Publiser til LinkedIn</>
      )}
    </Button>
  );
}

function LinkedInStatusBadge() {
  const { data: connectionStatus, isLoading } = trpc.linkedin.getConnectionStatus.useQuery();

  if (isLoading) return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground px-1 py-1.5">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      <span>Sjekker LinkedIn...</span>
    </div>
  );

  if (connectionStatus?.connected) return (
    <div className="flex items-center gap-2 text-sm px-1 py-1.5 text-green-600 dark:text-green-400">
      <CheckCircle2 className="h-3.5 w-3.5" />
      <Linkedin className="h-3.5 w-3.5 text-blue-600" />
      <span className="font-medium">LinkedIn tilkoblet</span>
      <span className="text-muted-foreground text-xs">({connectionStatus.profileName})</span>
    </div>
  );

  return (
    <div className="flex items-center justify-between px-1 py-1.5">
      <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
        <AlertCircle className="h-3.5 w-3.5" />
        <Linkedin className="h-3.5 w-3.5" />
        <span className="font-medium">LinkedIn ikke tilkoblet</span>
      </div>
      <Link href="/innstillinger">
        <Button variant="outline" size="sm" className="h-6 text-xs">
          <ExternalLink className="h-3 w-3 mr-1" />Koble til
        </Button>
      </Link>
    </div>
  );
}

/* ─── Main Generate Component ─── */

export default function Generate() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Undo/Redo for generated content
  const { value: generatedContent, set: setGeneratedContent, undo, redo, canUndo, canRedo } = useUndoRedo("");

  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<"linkedin" | "twitter" | "instagram" | "facebook">("linkedin");
  const [tone, setTone] = useState<"professional" | "casual" | "friendly" | "formal" | "humorous">("professional");
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [keywords, setKeywords] = useState("");
  const [postsRemaining] = useState<number | null>(null);

  // ── Expanded generation properties ──
  const [targetAudience, setTargetAudience] = useState("");
  const [goal, setGoal] = useState<"" | "awareness" | "engagement" | "sales" | "leads" | "traffic" | "community">("");
  const [cta, setCta] = useState("");
  const [angle, setAngle] = useState<
    "" | "personal_story" | "actionable_tips" | "contrarian_opinion" | "case_study" | "shocking_stat" | "how_to" | "listicle" | "question"
  >("");
  const [emojiUsage, setEmojiUsage] = useState<"none" | "minimal" | "moderate" | "heavy">("minimal");
  const [hashtagCount, setHashtagCount] = useState<number>(3);
  const [useBullets, setUseBullets] = useState(false);
  const [closingQuestion, setClosingQuestion] = useState(true);
  const [language, setLanguage] = useState<"no" | "en" | "ar">("no");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Voice profile (declared before buildOptions, which depends on it).
  const { data: voiceProfile } = trpc.voice.getProfile.useQuery();
  const [useVoiceProfile, setUseVoiceProfile] = useState(false);

  // Build the option object shared by generate + enhance + save-preset.
  const buildOptions = useCallback(() => ({
    topic,
    platform,
    tone,
    length,
    keywords: keywords ? keywords.split(",").map((k) => k.trim()).filter(Boolean) : undefined,
    targetAudience: targetAudience.trim() || undefined,
    goal: goal || undefined,
    cta: cta.trim() || undefined,
    angle: angle || undefined,
    emojiUsage,
    hashtagCount,
    useBullets,
    closingQuestion,
    language,
    useVoiceProfile,
  }), [topic, platform, tone, length, keywords, targetAudience, goal, cta, angle, emojiUsage, hashtagCount, useBullets, closingQuestion, language, useVoiceProfile]);

  // ── Named presets ──
  const presetsQuery = trpc.presets.list.useQuery();
  const utils = trpc.useUtils();
  const [presetName, setPresetName] = useState("");
  const [showSavePreset, setShowSavePreset] = useState(false);

  const applyPreset = (p: NonNullable<typeof presetsQuery.data>[number]) => {
    setPlatform(p.platform);
    setTone(p.tone as typeof tone);
    setLength(p.length);
    setKeywords((p.keywords ?? []).join(", "));
    setTargetAudience(p.targetAudience ?? "");
    setGoal((p.goal ?? "") as typeof goal);
    setCta(p.cta ?? "");
    setAngle((p.angle ?? "") as typeof angle);
    setEmojiUsage(p.emojiUsage);
    setHashtagCount(p.hashtagCount);
    setUseBullets(p.useBullets);
    setClosingQuestion(p.closingQuestion);
    setLanguage(p.language);
    setShowAdvanced(true);
    toast.success(`Forhåndsinnstilling lastet: ${p.name}`);
  };

  const createPresetMutation = trpc.presets.create.useMutation({
    onSuccess: () => {
      utils.presets.list.invalidate();
      setShowSavePreset(false);
      setPresetName("");
      toast.success("Forhåndsinnstilling lagret!");
    },
    onError: (e) => toast.error(e.message || "Kunne ikke lagre"),
  });
  const deletePresetMutation = trpc.presets.delete.useMutation({
    onSuccess: () => { utils.presets.list.invalidate(); toast.success("Slettet"); },
  });

  const handleSavePreset = () => {
    if (!presetName.trim()) { toast.error("Gi forhåndsinnstillingen et navn"); return; }
    createPresetMutation.mutate({
      name: presetName.trim(),
      platform, tone, length,
      keywords: keywords ? keywords.split(",").map((k) => k.trim()).filter(Boolean) : undefined,
      targetAudience: targetAudience.trim() || undefined,
      goal: goal || undefined,
      cta: cta.trim() || undefined,
      angle: angle || undefined,
      emojiUsage, hashtagCount, useBullets, closingQuestion, language,
    });
  };

  // Auto-select the user's default preset on first load (only if form is empty).
  const appliedDefaultRef = useRef(false);
  useEffect(() => {
    if (appliedDefaultRef.current || !presetsQuery.data || topic) return;
    const def = presetsQuery.data.find((p) => p.isDefault);
    if (def) { appliedDefaultRef.current = true; applyPreset(def); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetsQuery.data]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) { redo(); } else { undo(); }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [generateAIImage, setGenerateAIImage] = useState(false);
  const [imageGenerationType, setImageGenerationType] = useState<"dalle" | "nanoBanana">("nanoBanana");
  const [imageStyle, setImageStyle] = useState<"minimalist" | "bold" | "professional" | "creative">("professional");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImagePrompt, setGeneratedImagePrompt] = useState<string | null>(null);

  const { data: subscription } = trpc.user.getSubscription.useQuery();

  // State for idea tracking
  const [currentIdeaId, setCurrentIdeaId] = useState<number | null>(null);
  const markIdeaAsUsed = trpc.ideas.markAsUsed.useMutation();

  // Auto-save draft functionality
  const [draftSaved, setDraftSaved] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { data: existingDraft } = trpc.drafts.get.useQuery({ pageType: "generate" });
  const saveDraftMutation = trpc.drafts.save.useMutation({
    onSuccess: () => { setDraftSaved(true); setLastSavedAt(new Date()); },
  });
  const deleteDraftMutation = trpc.drafts.delete.useMutation();

  // Restore draft on load
  useEffect(() => {
    if (existingDraft && !topic) {
      try {
        const formData = JSON.parse(existingDraft.formData);
        if (formData.topic) setTopic(formData.topic);
        if (formData.platform) setPlatform(formData.platform);
        if (formData.tone) setTone(formData.tone);
        if (formData.length) setLength(formData.length);
        if (formData.keywords) setKeywords(formData.keywords);
        if (formData.useVoiceProfile !== undefined) setUseVoiceProfile(formData.useVoiceProfile);
        if (formData.generateAIImage !== undefined) setGenerateAIImage(formData.generateAIImage);
        if (formData.imageStyle) setImageStyle(formData.imageStyle);
        toast.info("Utkast gjenopprettet", { duration: 2000 });
      } catch (e) {
        console.error("Failed to parse draft", e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingDraft]);

  // Auto-save with debounce
  const autoSaveDraft = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const formData = JSON.stringify({ topic, platform, tone, length, keywords, useVoiceProfile, generateAIImage, imageStyle });
      if (topic.trim()) {
        saveDraftMutation.mutate({ pageType: "generate", formData, title: topic.substring(0, 50) || "Utkast" });
      }
    }, 1500);
  }, [topic, platform, tone, length, keywords, useVoiceProfile, generateAIImage, imageStyle, saveDraftMutation]);

  // Trigger auto-save when form changes
  useEffect(() => {
    if (topic) { setDraftSaved(false); autoSaveDraft(); }
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [topic, platform, tone, length, keywords, useVoiceProfile, generateAIImage, imageStyle, autoSaveDraft]);

  const clearDraft = () => {
    deleteDraftMutation.mutate({ pageType: "generate" });
    setDraftSaved(false);
    setLastSavedAt(null);
  };

  // Handle URL parameters from Trends page or Idea Bank
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const topicParam = urlParams.get('topic');
    const ideaParam = urlParams.get('idea');
    const ideaIdParam = urlParams.get('ideaId');
    const platformParam = urlParams.get('platform');
    
    if (ideaParam) {
      setTopic(decodeURIComponent(ideaParam));
      toast.success('Idé lastet inn! Klar til å generere innhold.');
      if (ideaIdParam) setCurrentIdeaId(parseInt(ideaIdParam));
    } else if (topicParam) {
      setTopic(decodeURIComponent(topicParam));
      toast.success('Trend lastet inn! Klar til å generere innhold.');
    }
    
    if (platformParam) {
      const validPlatforms = ['linkedin', 'twitter', 'instagram', 'facebook'];
      if (validPlatforms.includes(platformParam)) {
        setPlatform(platformParam as any);
      }
    }
  }, []);

  // Mutations
  const generateMutation = trpc.content.generate.useMutation({
    onSuccess: (data) => {
      setGeneratedContent(data.content);
      clearDraft();
      if (currentIdeaId) {
        markIdeaAsUsed.mutate({ id: currentIdeaId });
        setCurrentIdeaId(null);
      }
      toast.success("Innhold generert!");
    },
    onError: (error) => {
      if (error.message.includes("limit")) {
        toast.error("Du har nådd grensen for gratis innlegg. Oppgrader til Pro!");
      } else {
        toast.error(error.message || "Noe gikk galt");
      }
    },
  });

  const enhanceMutation = trpc.content.enhanceIdea.useMutation({
    onSuccess: (data) => {
      setTopic(data.enhanced);
      toast.success("Idéen ble forbedret til en proff brief ✨");
    },
    onError: (e) => toast.error(e.message || "Kunne ikke forbedre idéen"),
  });

  const handleEnhanceIdea = () => {
    if (!topic.trim()) { toast.error("Skriv inn en idé først"); return; }
    enhanceMutation.mutate(buildOptions());
  };

  const improveMutation = trpc.content.improve.useMutation({
    onSuccess: (data) => {
      setGeneratedContent(data.content);
      toast.success("Innholdet ble forbedret!");
    },
    onError: () => toast.error("Kunne ikke forbedre innholdet"),
  });

  // Posts are auto-saved when generated. Navigate to posts page to see them.

  const handleGenerate = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    if (!topic.trim()) { toast.error("Vennligst skriv inn et emne"); return; }
    generateMutation.mutate(buildOptions());
  };

  const handleImprove = (type: string) => {
    if (!generatedContent) return;
    improveMutation.mutate({ content: generatedContent, improvementType: type as "grammar" | "engagement" | "clarity" | "tone", platform });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    toast.success("Kopiert til utklippstavlen!");
  };

  const handleSave = () => {
    toast.success("Innlegget er allerede lagret i Mine innlegg!");
    setLocation("/posts");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Bildet er for stort. Maks 5MB."); return; }
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await response.json();
      if (data.url) { setUploadedImage(data.url); toast.success("Bilde lastet opp!"); }
      else { toast.error("Kunne ikke laste opp bildet"); }
    } catch (error) {
      toast.error("Feil ved opplasting av bilde");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
    setGeneratedImagePrompt(null);
  };

  const handleGenerateAIImage = async () => {
    if (!topic.trim()) { toast.error("Skriv inn et emne først"); return; }
    setIsGeneratingImage(true);
    try {
      const response = await fetch("/api/trpc/content.generateImage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { topic, platform, style: imageStyle, model: imageGenerationType } }),
      });
      const data = await response.json();
      if (data.result?.data?.json?.url) {
        setUploadedImage(data.result.data.json.url);
        setGeneratedImagePrompt(data.result.data.json.prompt || topic);
        toast.success("AI-bilde generert!");
      } else { toast.error("Kunne ikke generere bilde"); }
    } catch (error) {
      toast.error("Feil ved generering av bilde");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Auth guard
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Sparkles className="h-12 w-12 text-primary mb-4" />
        <h2 className="text-2xl font-bold mb-2">Logg inn for å generere innhold</h2>
        <p className="text-muted-foreground mb-6">Du må logge inn for å bruke AI-innholdsgeneratoren</p>
        <Button onClick={() => window.location.href = getLoginUrl()}>Logg inn</Button>
      </div>
    );
  }

  const platformInfo = {
    linkedin: { icon: "💼", name: "LinkedIn", maxChars: 3000 },
    twitter: { icon: "🐦", name: "Twitter/X", maxChars: 280 },
    instagram: { icon: "📸", name: "Instagram", maxChars: 2200 },
    facebook: { icon: "👥", name: "Facebook", maxChars: 63206 },
  };

  // Active step indicator
  const activeStep = !topic.trim() ? 1 : !generatedContent ? 2 : 3;

  return (
    <div className="bg-gradient-to-b from-slate-50/80 via-background to-background dark:from-slate-950/50">
      <main className="container py-6 md:py-8 max-w-7xl">

        {/* ─── Header ─── */}
        <div className="mb-6">
          <Breadcrumb items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Generer", current: true }
          ]} className="mb-3" />
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Generer Innhold med AI</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Skriv inn emnet ditt, velg plattform og tone, og la AI lage profesjonelt innhold på sekunder.
          </p>
        </div>

        {/* ─── Progress Steps ─── */}
        <div className="mb-6 flex items-center gap-2">
          {[
            { num: 1, label: "Skriv emne" },
            { num: 2, label: "Generer" },
            { num: 3, label: "Rediger & lagre" },
          ].map((step, i) => (
            <div key={step.num} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeStep === step.num
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                  : activeStep > step.num
                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                    : "bg-muted text-muted-foreground"
              }`}>
                <span className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  activeStep === step.num
                    ? "bg-indigo-600 text-white"
                    : activeStep > step.num
                      ? "bg-green-600 text-white"
                      : "bg-muted-foreground/30 text-muted-foreground"
                }`}>
                  {activeStep > step.num ? "✓" : step.num}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </div>
              {i < 2 && <div className={`h-px w-6 ${activeStep > step.num ? "bg-green-400" : "bg-border"}`} />}
            </div>
          ))}

          {/* Auto-save indicator */}
          <div className="ml-auto">
            {topic && (
              <div className="flex items-center gap-1.5 text-xs">
                {saveDraftMutation.isPending ? (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />Lagrer...
                  </span>
                ) : draftSaved ? (
                  <span className="text-green-600 flex items-center gap-1">
                    <Cloud className="h-3 w-3" />
                    Lagret {lastSavedAt && `kl. ${lastSavedAt.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}`}
                  </span>
                ) : (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Save className="h-3 w-3" />Auto-lagring
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {postsRemaining !== null && (
          <div className="mb-4 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
            📊 Du har <strong>{postsRemaining}</strong> innlegg igjen i prøveperioden
          </div>
        )}

        {/* ─── Main 2-Column Layout ─── */}
        <div className="grid lg:grid-cols-5 gap-6 items-start">

          {/* ═══ LEFT COLUMN: Input + Settings (3/5 width) ═══ */}
          <div className="lg:col-span-3 space-y-5">

            {/* ── Preset Bar ── */}
            {(presetsQuery.data?.length ?? 0) > 0 && (
              <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-lg border bg-muted/40">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Forhåndsinnstillinger:
                </span>
                {presetsQuery.data!.map((p) => (
                  <span key={p.id} className="inline-flex items-center rounded-full border bg-background text-xs">
                    <button
                      onClick={() => applyPreset(p)}
                      className="pl-2.5 pr-1.5 py-1 hover:text-indigo-600 font-medium"
                    >
                      {p.isDefault ? "★ " : ""}{p.name}
                    </button>
                    <button
                      onClick={() => deletePresetMutation.mutate({ id: p.id })}
                      className="pr-2 pl-0.5 py-1 text-muted-foreground hover:text-destructive"
                      aria-label={`Slett ${p.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* ── Section 1: Emne (Topic) ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">1</span>
                  Hva vil du skrive om?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  id="topic"
                  placeholder="F.eks: 'Hvordan AI endrer fremtiden for markedsføring' eller 'Vi lanserer et nytt produkt som...'"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={3}
                  className="resize-none text-base"
                />
                <div className="flex items-center justify-between gap-2 mt-2">
                  <p className="text-xs text-muted-foreground">
                    Jo mer detaljert du beskriver emnet, desto bedre blir resultatet.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleEnhanceIdea}
                    disabled={enhanceMutation.isPending || !topic.trim()}
                    className="shrink-0 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300"
                    title="La AI gjøre om idéen din til en profesjonell brief"
                  >
                    {enhanceMutation.isPending ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Forbedrer...</>
                    ) : (
                      <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Forbedre idé</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ── Section 2: Platform & Tone (side by side) ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">2</span>
                  Innstillinger
                </CardTitle>
                <LinkedInStatusBadge />
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-3 gap-4">
                  {/* Platform */}
                  <div className="space-y-1.5">
                    <Label htmlFor="platform" className="text-sm font-medium">Plattform</Label>
                    <Select value={platform} onValueChange={(value: any) => setPlatform(value)}>
                      <SelectTrigger id="platform">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(platformInfo).map(([key, info]) => (
                          <SelectItem key={key} value={key}>
                            {info.icon} {info.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tone */}
                  <div className="space-y-1.5">
                    <Label htmlFor="tone" className="text-sm font-medium">Tone</Label>
                    <Select value={tone} onValueChange={(value: any) => setTone(value)}>
                      <SelectTrigger id="tone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Profesjonell</SelectItem>
                        <SelectItem value="casual">Uformell</SelectItem>
                        <SelectItem value="friendly">Vennlig</SelectItem>
                        <SelectItem value="formal">Formell</SelectItem>
                        <SelectItem value="humorous">Humoristisk</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Length */}
                  <div className="space-y-1.5">
                    <Label htmlFor="length" className="text-sm font-medium">Lengde</Label>
                    <Select value={length} onValueChange={(value: any) => setLength(value)}>
                      <SelectTrigger id="length">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short">Kort</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="long">Lang</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Keywords */}
                <div className="mt-4 space-y-1.5">
                  <Label htmlFor="keywords" className="text-sm font-medium">Nøkkelord <span className="text-muted-foreground font-normal">(valgfritt)</span></Label>
                  <Input
                    id="keywords"
                    placeholder="AI, markedsføring, innovasjon (skill med komma)"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                  />
                </div>

                {/* Voice Profile Toggle */}
                {voiceProfile?.trainingStatus === "trained" && (
                  <div className="mt-4 p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useVoiceProfile}
                        onChange={(e) => setUseVoiceProfile(e.target.checked)}
                        className="h-4 w-4 rounded border-purple-300"
                      />
                      <Mic className="h-4 w-4 text-purple-600" />
                      <div>
                        <span className="font-medium text-sm">Bruk din stemme</span>
                        <p className="text-xs text-muted-foreground">AI skriver i din personlige stil</p>
                      </div>
                    </label>
                  </div>
                )}

                {!voiceProfile?.trainingStatus && subscription?.status === "active" && (
                  <div className="mt-4 p-3 bg-muted/50 border rounded-lg flex items-center gap-3">
                    <Mic className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Tren din stemme</p>
                      <p className="text-xs text-muted-foreground">Lær AI å skrive som deg</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setLocation("/voice-training")}>Start</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Section 2b: Avanserte egenskaper ── */}
            <Card>
              <CardHeader className="pb-3">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">+</span>
                    Avanserte egenskaper
                    <span className="text-xs text-muted-foreground font-normal ml-1">(valgfritt)</span>
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">{showAdvanced ? "▲" : "▼"}</span>
                </button>
              </CardHeader>
              {showAdvanced && (
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    {/* Target Audience */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="audience" className="text-sm font-medium">Målgruppe</Label>
                      <Input
                        id="audience"
                        placeholder="F.eks: gründere, utviklere, nybakte foreldre"
                        value={targetAudience}
                        onChange={(e) => setTargetAudience(e.target.value)}
                      />
                    </div>

                    {/* Goal */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Mål</Label>
                      <Select value={goal || "none"} onValueChange={(v) => setGoal(v === "none" ? "" : v as typeof goal)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Ingen spesifikt —</SelectItem>
                          <SelectItem value="awareness">📣 Bevissthet</SelectItem>
                          <SelectItem value="engagement">💬 Engasjement</SelectItem>
                          <SelectItem value="sales">💰 Salg</SelectItem>
                          <SelectItem value="leads">🎯 Leads</SelectItem>
                          <SelectItem value="traffic">🔗 Trafikk</SelectItem>
                          <SelectItem value="community">🤝 Fellesskap</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Angle */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Vinkel</Label>
                      <Select value={angle || "none"} onValueChange={(v) => setAngle(v === "none" ? "" : v as typeof angle)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Automatisk —</SelectItem>
                          <SelectItem value="personal_story">📖 Personlig historie</SelectItem>
                          <SelectItem value="actionable_tips">✅ Konkrete tips</SelectItem>
                          <SelectItem value="contrarian_opinion">🔥 Kontroversiell mening</SelectItem>
                          <SelectItem value="case_study">📊 Case-studie</SelectItem>
                          <SelectItem value="shocking_stat">😮 Overraskende statistikk</SelectItem>
                          <SelectItem value="how_to">🛠️ Steg-for-steg</SelectItem>
                          <SelectItem value="listicle">🔢 Liste</SelectItem>
                          <SelectItem value="question">❓ Spørsmål</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* CTA */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="cta" className="text-sm font-medium">Call-to-action <span className="text-muted-foreground font-normal">(valgfritt)</span></Label>
                      <Input
                        id="cta"
                        placeholder="F.eks: Last ned guiden, Book en demo, Følg for mer"
                        value={cta}
                        onChange={(e) => setCta(e.target.value)}
                      />
                    </div>

                    {/* Language */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Språk</Label>
                      <Select value={language} onValueChange={(v) => setLanguage(v as typeof language)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no">🇳🇴 Norsk</SelectItem>
                          <SelectItem value="en">🇬🇧 Engelsk</SelectItem>
                          <SelectItem value="ar">🇸🇦 Arabisk</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Emoji usage */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Emojis</Label>
                      <Select value={emojiUsage} onValueChange={(v) => setEmojiUsage(v as typeof emojiUsage)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Ingen</SelectItem>
                          <SelectItem value="minimal">Minimalt</SelectItem>
                          <SelectItem value="moderate">Moderat</SelectItem>
                          <SelectItem value="heavy">Mye</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Hashtag count */}
                    <div className="space-y-1.5">
                      <Label htmlFor="hashtags" className="text-sm font-medium">Antall hashtags</Label>
                      <Input
                        id="hashtags"
                        type="number"
                        min={0}
                        max={30}
                        value={hashtagCount}
                        onChange={(e) => setHashtagCount(Math.max(0, Math.min(30, parseInt(e.target.value) || 0)))}
                      />
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="flex flex-wrap gap-4 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={useBullets} onChange={(e) => setUseBullets(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                      Bruk punktlister
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={closingQuestion} onChange={(e) => setClosingQuestion(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                      Avslutt med spørsmål
                    </label>
                  </div>

                  {/* Save as preset */}
                  <div className="pt-3 border-t">
                    {!showSavePreset ? (
                      <Button variant="outline" size="sm" onClick={() => setShowSavePreset(true)}>
                        <Save className="h-3.5 w-3.5 mr-1.5" />Lagre som forhåndsinnstilling
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Navn på forhåndsinnstilling"
                          value={presetName}
                          onChange={(e) => setPresetName(e.target.value)}
                          className="h-9"
                        />
                        <Button size="sm" onClick={handleSavePreset} disabled={createPresetMutation.isPending}>
                          {createPresetMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Lagre"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setShowSavePreset(false); setPresetName(""); }}>Avbryt</Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>

            {/* ── Section 3: Image (Collapsible feel) ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">3</span>
                  Bilde
                  <span className="text-xs text-muted-foreground font-normal ml-1">(valgfritt)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* AI Image Toggle */}
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="generate-ai-image"
                    checked={generateAIImage}
                    onChange={(e) => setGenerateAIImage(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="generate-ai-image" className="cursor-pointer font-medium text-sm">
                    🎨 Generer bilde med AI
                  </Label>
                </div>

                {generateAIImage && (
                  <div className="space-y-3 pl-4 border-l-2 border-indigo-200 dark:border-indigo-800">
                    {subscription?.status === "trial" ? (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">🔒 AI-bilder krever Pro</p>
                        <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">Oppgrader for å generere bilder med AI.</p>
                        <Button variant="outline" size="sm" className="w-full border-amber-300 text-amber-800 hover:bg-amber-100">
                          Oppgrader til Pro
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          {/* Style */}
                          <div className="space-y-1.5">
                            <Label className="text-xs">Bildestil</Label>
                            <Select value={imageStyle} onValueChange={(value: typeof imageStyle) => setImageStyle(value)}>
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="minimalist">🎯 Minimalistisk</SelectItem>
                                <SelectItem value="bold">💥 Modig</SelectItem>
                                <SelectItem value="professional">💼 Profesjonell</SelectItem>
                                <SelectItem value="creative">🎨 Kreativ</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Model */}
                          <div className="space-y-1.5">
                            <Label className="text-xs">AI-modell</Label>
                            <Select value={imageGenerationType} onValueChange={(value: typeof imageGenerationType) => setImageGenerationType(value)}>
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="nanoBanana">🍌 Nano Banana</SelectItem>
                                <SelectItem value="dalle">✨ DALL-E 3</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <Button
                          onClick={handleGenerateAIImage}
                          disabled={isGeneratingImage || !topic.trim()}
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          {isGeneratingImage ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Genererer bilde...</>
                          ) : (
                            <><ImageIcon className="mr-2 h-4 w-4" />Generer bilde</>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* Manual Upload */}
                {!generateAIImage && (
                  <div>
                    {!uploadedImage ? (
                      <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary transition-colors">
                        <input type="file" id="image-upload" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={isUploadingImage} />
                        <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center gap-1.5">
                          {isUploadingImage ? (
                            <><Loader2 className="h-6 w-6 text-primary animate-spin" /><p className="text-xs text-muted-foreground">Laster opp...</p></>
                          ) : (
                            <><Upload className="h-6 w-6 text-muted-foreground" /><p className="text-sm font-medium">Last opp bilde</p><p className="text-xs text-muted-foreground">PNG, JPG, GIF opptil 5MB</p></>
                          )}
                        </label>
                      </div>
                    ) : (
                      <div className="relative border rounded-lg overflow-hidden">
                        <img src={uploadedImage} alt="Uploaded" className="w-full h-40 object-cover" />
                        <button onClick={handleRemoveImage} className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full" aria-label="Fjern bilde">
                          <X className="h-4 w-4" />
                        </button>
                        {generatedImagePrompt && <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2 text-xs">🤖 AI-generert</div>}
                      </div>
                    )}
                  </div>
                )}

                {/* Show generated image */}
                {generateAIImage && uploadedImage && (
                  <div className="mt-3">
                    <div className="relative border rounded-lg overflow-hidden">
                      <img src={uploadedImage} alt="AI Generated" className="w-full h-40 object-cover" />
                      <button onClick={handleRemoveImage} className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full" aria-label="Fjern bilde">
                        <X className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-white p-2">
                        <p className="text-xs font-medium">🤖 {imageGenerationType === "dalle" ? "DALL-E 3" : "Nano Banana"}</p>
                      </div>
                    </div>
                    <Button onClick={handleGenerateAIImage} disabled={isGeneratingImage} variant="ghost" size="sm" className="w-full mt-1">
                      🔄 Regenerer bilde
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Generate Button ── */}
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !topic.trim()}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 transition-all duration-300 hover:-translate-y-0.5 text-white border-0"
              size="lg"
            >
              {generateMutation.isPending ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" />AI genererer innhold...</>
              ) : (
                <><Wand2 className="mr-2 h-5 w-5" />Generer Innhold med AI ✨</>
              )}
            </Button>

            {/* ── Generated Content Output ── */}
            {generatedContent && (
              <Card className="border-green-200 dark:border-green-800">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      Generert Innhold
                    </CardTitle>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={undo} disabled={!canUndo} title="Angre (Ctrl+Z)">
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={redo} disabled={!canRedo} title="Gjør om (Ctrl+Shift+Z)">
                        <RotateCw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Textarea
                      value={generatedContent}
                      onChange={(e) => setGeneratedContent(e.target.value)}
                      rows={10}
                      className="resize-none font-mono text-sm"
                    />
                    <Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={handleCopy}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Character Count */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {generatedContent.length} / {platformInfo[platform].maxChars} tegn
                    </span>
                    {generatedContent.length > platformInfo[platform].maxChars && (
                      <span className="text-destructive font-medium">⚠️ Over grensen!</span>
                    )}
                  </div>

                  {/* AI Content Improvement */}
                  <ContentImprovement
                    originalContent={generatedContent}
                    platform={platform}
                    tone={tone}
                    length={length}
                    onContentImproved={(improvedContent) => {
                      setGeneratedContent(improvedContent);
                      toast.success("Innholdet ble forbedret!");
                    }}
                  />

                  {/* Quick Improve Buttons */}
                  <div>
                    <Label className="text-sm mb-2 block">Hurtigforbedring:</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { type: "grammar", label: "✍️ Grammatikk" },
                        { type: "engagement", label: "🔥 Engasjement" },
                        { type: "clarity", label: "💡 Klarhet" },
                        { type: "tone", label: "🎭 Tone" },
                      ].map((item) => (
                        <Button key={item.type} variant="outline" size="sm" onClick={() => handleImprove(item.type)} disabled={improveMutation.isPending} className="text-xs">
                          {item.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button onClick={handleSave} className="flex-1" variant="default">
                      <Save className="h-4 w-4 mr-2" />Se innlegg
                    </Button>
                    <Button onClick={handleCopy} variant="outline" className="flex-1">
                      <Copy className="h-4 w-4 mr-2" />Kopier
                    </Button>
                  </div>

                  {/* Post to LinkedIn */}
                  <PostToLinkedInButton content={generatedContent} platform={platform} />
                </CardContent>
              </Card>
            )}

            {/* Live Post Preview */}
            {generatedContent && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-primary" />
                    Forhåndsvisning på {platform.charAt(0).toUpperCase() + platform.slice(1)}
                  </CardTitle>
                  <CardDescription>Slik vil innlegget ditt se ut på plattformen</CardDescription>
                </CardHeader>
                <CardContent>
                  <LivePostPreview
                    content={generatedContent}
                    platform={platform}
                    imageUrl={uploadedImage || undefined}
                  />
                </CardContent>
              </Card>
            )}

            {/* Empty State for Output */}
            {!generatedContent && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 bg-gradient-to-br from-primary/10 to-purple-500/10 rounded-2xl flex items-center justify-center mb-4">
                    <Sparkles className="h-8 w-8 text-primary/40" />
                  </div>
                  <h3 className="text-base font-semibold mb-1 text-foreground/70">Klar til å lage innhold?</h3>
                  <p className="text-muted-foreground text-sm max-w-xs">
                    Fyll ut emne og innstillinger ovenfor, og klikk "Generer" for å la AI lage profesjonelt innhold.
                  </p>
                  <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                    <span>⚡ Under 30 sek</span>
                    <span>🎯 Optimalisert</span>
                    <span>📱 Plattformtilpasset</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ═══ RIGHT COLUMN: Inspirasjon & Verktøy (2/5 width) ═══ */}
          <div className="lg:col-span-2 space-y-4">
            <div className="sticky top-4 space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                Inspirasjon & Verktøy
              </h3>

              {/* Saved Templates */}
              <SavedTemplates
                onUseTemplate={(tmpl) => {
                  setPlatform(tmpl.platform as typeof platform);
                  setTone(tmpl.tone as typeof tone);
                  setTopic(tmpl.rawInput);
                  setGeneratedContent(tmpl.generatedContent);
                  toast.success("Mal lastet inn!");
                }}
                currentContent={generatedContent || undefined}
                currentPlatform={platform}
                currentTone={tone}
                currentTopic={topic}
              />

              {/* Trending Suggestions */}
              <TrendingSuggestions
                onSelectTrend={(keyword) => {
                  setTopic(keyword);
                  toast.success(`Trending tema valgt: ${keyword}`);
                }}
              />

              {/* Trending Topics */}
              <TrendingTopicsSidebar
                platform={platform}
                onTopicSelected={(t) => {
                  setTopic(t);
                  toast.success(`Tema valgt: ${t}`);
                }}
                expertise="content marketing"
                targetAudience="professionals"
                contentStyle={tone}
              />

              {/* Content Templates (shown when topic exists) */}
              {topic && (
                <>
                  <TrendingContentTemplates
                    keyword={topic}
                    platform={platform}
                    onApplyTemplate={(content) => setGeneratedContent(content)}
                  />
                  <SmartSchedulingSuggestions
                    keyword={topic}
                    platform={platform}
                    onSchedule={(time) => toast.success(`Planlagt for ${time}`)}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}