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
import { buildBrandExamples } from "@/lib/brandExamples";
import { ScheduleDialog } from "@/components/ScheduleDialog";
import { takeEditorHandoff, setAbTestHandoff } from "@/lib/editorHandoff";
import { createGenerationGuard } from "@/lib/generationGuard";
import { Copy, Loader2, Sparkles, Wand2, Upload, X, Image as ImageIcon, Mic, Flame, Save, Cloud } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { Linkedin, Facebook, Instagram, CheckCircle2, AlertCircle, ExternalLink, RotateCcw, RotateCw, Calendar } from "lucide-react";
import { Link } from "wouter";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ContentImprovement } from "@/components/ContentImprovement";
import { TrendingTopicsSidebar } from "@/components/TrendingTopicsSidebar";
import { LivePostPreview } from "@/components/LivePostPreview";
import { SavedTemplates } from "@/components/SavedTemplates";
import { TrendingContentTemplates } from "@/components/TrendingContentTemplates";
import { SmartSchedulingSuggestions } from "@/components/SmartSchedulingSuggestions";
import { isSchedulable, schedulingUnavailableReason } from "@/lib/schedulablePlatforms";

/** Convert a suggestion like "Tuesday 8:00 AM" to the next matching Date. */
function nextOccurrenceFromLabel(timeStr: string): Date | null {
  const days: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const m = timeStr.trim().match(/^(\w+)\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return null;
  const targetDow = days[m[1].toLowerCase()];
  if (targetDow === undefined) return null;
  let hour = parseInt(m[2], 10);
  const min = parseInt(m[3], 10);
  const ampm = (m[4] || "").toUpperCase();
  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  const now = new Date();
  const d = new Date(now);
  d.setHours(hour, min, 0, 0);
  let diff = (targetDow - now.getDay() + 7) % 7;
  if (diff === 0 && d.getTime() <= now.getTime()) diff = 7;
  d.setDate(now.getDate() + diff);
  return d;
}

/* ─── LinkedIn Sub-Components ─── */

function PostToLinkedInButton({ content, postId }: { content: string; platform: string; postId?: number }) {
  const { data: connectionStatus } = trpc.linkedin.getConnectionStatus.useQuery();
  const postMutation = trpc.linkedin.createPost.useMutation({
    onSuccess: () => { toast.success("Publisert til LinkedIn!"); },
    onError: (error) => { toast.error(error.message || "Kunne ikke publisere til LinkedIn"); },
  });

  if (!connectionStatus?.connected) {
    return (
      <Link href="/settings">
        <Button
          variant="outline"
          className="w-full border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400"
        >
          <Linkedin className="h-4 w-4 mr-2" />
          Koble til LinkedIn for å publisere
        </Button>
      </Link>
    );
  }

  const handlePost = () => {
    if (!content.trim()) { toast.error("Innholdet kan ikke være tomt"); return; }
    postMutation.mutate({ content, postId: postId ?? undefined });
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
      <Link href="/settings">
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
  const [mobileTab, setMobileTab] = useState<"skriv" | "resultat">("skriv"); // mobile-only: Skriv vs Resultat
  // MB4: a date picked in the calendar survives generation and is used by Planlegg.
  const [carriedScheduledAt, setCarriedScheduledAt] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [platform, setPlatform] = useState<"linkedin" | "twitter" | "instagram" | "facebook">("linkedin");
  const [tone, setTone] = useState<"professional" | "casual" | "friendly" | "formal" | "humorous">("professional");
  const [savedPostId, setSavedPostId] = useState<number | null>(null);
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
  const [createMode, setCreateMode] = useState<"dna" | "write">("write");
  const brandProfileQuery = trpc.brand.get.useQuery();

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
  // Request-identity guard: every user-initiated generation gets a fresh id so
  // late/out-of-order responses (text or image) can never overwrite a newer one.
  const genGuardRef = useRef(createGenerationGuard());
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
  const [generateAIImage, setGenerateAIImage] = useState(true); // always attach an image to a post by default
  const [imageGenerationType, setImageGenerationType] = useState<"dalle" | "nanoBanana">("nanoBanana"); // GPT Image disabled — FLUX only
  const [imageStyle, setImageStyle] = useState<"minimalist" | "bold" | "professional" | "creative">("professional");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImagePrompt, setGeneratedImagePrompt] = useState<string | null>(null);
  // MB4: the post text the current AI image was generated for. When the user edits
  // the text afterwards the image may no longer match — we say so and offer a refresh.
  const [imageForContent, setImageForContent] = useState<string | null>(null);

  const { data: subscription } = trpc.user.getSubscription.useQuery();
  // View mode (simple = one guided screen; advanced = full studio). Saved per account.
  const viewModeQuery = trpc.user.getViewMode.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  // MB3: which platforms this brand can actually publish to (empty when multi-brand is off).
  const socialFlags = trpc.brands.flags.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const destinationsQuery = trpc.social.destinations.useQuery(undefined, {
    enabled: socialFlags.data?.enabled === true,
    staleTime: 60 * 1000,
  });
  const setViewModeMutation = trpc.user.setViewMode.useMutation({
    onSuccess: (d) => {
      try { window.localStorage.setItem("penna-view-mode", d.viewMode); } catch { /* ignore */ }
      void viewModeQuery.refetch();
    },
  });

  // State for idea tracking
  const [currentIdeaId, setCurrentIdeaId] = useState<number | null>(null);
  const markIdeaAsUsed = trpc.ideas.markAsUsed.useMutation();

  // Auto-save draft functionality
  const [draftSaved, setDraftSaved] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const fromUrlRef = useRef(false);
  const hasRestoredRef = useRef(false); // draft restore must run at most once
  const userTypedRef = useRef(false);   // never overwrite/merge once the user types
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { data: existingDraft } = trpc.drafts.get.useQuery({ pageType: "generate" });
  const saveDraftMutation = trpc.drafts.save.useMutation({
    onSuccess: () => { setDraftSaved(true); setLastSavedAt(new Date()); },
  });
  const deleteDraftMutation = trpc.drafts.delete.useMutation();

  // Restore draft on load
  useEffect(() => {
    // Restore deterministically: at most once, only into an untouched empty field,
    // and never when the user has started typing or arrived from Trends/Idébank.
    // (existingDraft can change reference on refetch — the refs stop a re-insert.)
    if (hasRestoredRef.current || userTypedRef.current || fromUrlRef.current) return;
    if (existingDraft && !topic) {
      hasRestoredRef.current = true;
      try {
        const formData = JSON.parse(existingDraft.formData);
        if (formData.topic) setTopic(formData.topic);
        if (formData.platform) setPlatform(formData.platform);
        if (formData.tone) setTone(formData.tone);
        if (formData.length) setLength(formData.length);
        if (formData.keywords) setKeywords(formData.keywords);
        if (formData.useVoiceProfile !== undefined) setUseVoiceProfile(formData.useVoiceProfile);
        if (formData.imageStyle) setImageStyle(formData.imageStyle);
        toast.info("Utkast gjenopprettet", { duration: 2000 });
      } catch (e) {
        console.error("Failed to parse draft", e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingDraft]);

  // Auto-save with debounce
  const lastSavedFormDataRef = useRef<string>("");
  const autoSaveDraft = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (!topic.trim()) return;
      const formData = JSON.stringify({ topic, platform, tone, length, keywords, useVoiceProfile, generateAIImage, imageStyle });
      // Skip if nothing changed since the last save. Without this guard the auto-save
      // loops: each save flips draftSaved and changes the mutation object ref, which
      // re-runs the trigger effect and fires another save ~every 1.5s -> 429 rate-limit
      // -> "Unable to transform response from server".
      if (formData === lastSavedFormDataRef.current) return;
      lastSavedFormDataRef.current = formData;
      saveDraftMutation.mutate({ pageType: "generate", formData, title: topic.substring(0, 50) || "Utkast" });
    }, 1500);
    // saveDraftMutation intentionally excluded from deps: its ref changes on every
    // mutation state transition, which would recreate this callback and spin the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, platform, tone, length, keywords, useVoiceProfile, generateAIImage, imageStyle]);

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

  // Handle in-app handoff (Gjenbruk / A/B winner) + URL parameters (Trends / Idea Bank)
  useEffect(() => {
    // In-app handoff is passed via memory (never the URL) so full post content
    // never leaks into browser history or server logs. It also keeps the editor
    // in sync — loading the content and platform instead of a stale autosaved draft.
    const handoff = takeEditorHandoff();
    if (handoff) {
      fromUrlRef.current = true;
      clearDraft();
      if (handoff.platform) {
        const validPlatforms = ['linkedin', 'twitter', 'instagram', 'facebook'];
        const p = String(handoff.platform).toLowerCase();
        if (validPlatforms.includes(p)) setPlatform(p as any);
      }
      if (handoff.scheduledAt) setCarriedScheduledAt(handoff.scheduledAt);
      if (handoff.topic) setTopic(handoff.topic);
      if (handoff.content) {
        setGeneratedContent(handoff.content);
        setMobileTab("resultat");
      }
      toast.success(handoff.source === "repurpose" ? "Gjenbrukt innhold lastet inn!" : "Innhold lastet inn!");
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const topicParam = urlParams.get('topic');
    const ideaParam = urlParams.get('idea');
    const ideaIdParam = urlParams.get('ideaId');
    const platformParam = urlParams.get('platform');
    if (topicParam || ideaParam) { fromUrlRef.current = true; clearDraft(); }
    
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
    onMutate: () => ({ genId: genGuardRef.current.current }),
    onSuccess: (data, _vars, ctx) => {
      // Drop a stale/late response that no longer matches the active generation.
      if (ctx && !genGuardRef.current.isCurrent(ctx.genId)) return;
      setGeneratedContent(data.content);
      setMobileTab("resultat");
      setSavedPostId((data as any).postId ?? null);
      clearDraft();
      if (currentIdeaId) {
        markIdeaAsUsed.mutate({ id: currentIdeaId });
        setCurrentIdeaId(null);
      }
      toast.success("Innhold generert!");
      // One-click flow: if "Generer bilde med AI" is enabled, generate the image
      // right after the text (Pro only), attached to the freshly-created post.
      // Runs in the background so it never blocks showing the generated text.
      // The image is bound to THIS generation's id so a newer generation drops it.
      if (generateAIImage && subscription?.status !== "trial") {
        void runImageGeneration((data as any).postId ?? null, ctx?.genId ?? genGuardRef.current.current);
      }
    },
    onError: (error, _vars, ctx) => {
      if (ctx && !genGuardRef.current.isCurrent(ctx.genId)) return;
      // The server sends a clear Norwegian message (e.g. monthly limit reached).
      toast.error(error.message || "Noe gikk galt");
    },
  });

  const scheduleMutation = trpc.scheduling.schedulePost.useMutation({
    onSuccess: () => toast.success("Innlegget er planlagt! \u2705"),
    onError: (e) => toast.error(e.message || "Kunne ikke planlegge innlegget"),
  });

  const dalleImageMutation = trpc.content.generateImageDallE.useMutation();
  const nanoImageMutation = trpc.content.generateImageNanoBanana.useMutation();
  // Best-effort: persist a later-generated image onto the already-saved post.
  const attachImageMutation = trpc.content.attachImage.useMutation();
  // Claims a post's image slot for a new attempt so late/superseded image
  // responses are rejected by the server.
  const setImageGeneratingMutation = trpc.content.setImageGenerating.useMutation();

  const handleSchedule = (timeLabel: string) => {
    if (!savedPostId) {
      toast.error("Generer innlegget f\u00f8rst, s\u00e5 kan du planlegge det");
      return;
    }
    const when = nextOccurrenceFromLabel(timeLabel);
    if (!when) {
      toast.error("Kunne ikke tolke tidspunktet");
      return;
    }
    if (!isSchedulable(platform)) {
      toast.error(schedulingUnavailableReason(platform));
      return;
    }
    scheduleMutation.mutate({
      postId: savedPostId,
      platform,
      scheduledFor: when,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  };

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
    onMutate: () => ({ genId: genGuardRef.current.current }),
    onSuccess: (data, _vars, ctx) => {
      if (ctx && !genGuardRef.current.isCurrent(ctx.genId)) return;
      setGeneratedContent(data.content);
      toast.success("Innholdet ble forbedret!");
    },
    onError: (_e, _vars, ctx) => {
      if (ctx && !genGuardRef.current.isCurrent(ctx.genId)) return;
      toast.error("Kunne ikke forbedre innholdet");
    },
  });

  // Posts are auto-saved when generated. Navigate to posts page to see them.

  const handleGenerate = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    if (!topic.trim()) { toast.error("Vennligst skriv inn et emne"); return; }
    // Begin a new generation: invalidates any in-flight request and clears
    // artifacts from the previous one so nothing bleeds into this post.
    genGuardRef.current.start();
    setGeneratedContent("");
    setSavedPostId(null);
    // An AI-generated image (marked by its prompt) belongs to the previous post
    // -> drop it. A fresh user upload (no prompt) is kept and forwarded.
    const carryImage = generatedImagePrompt ? undefined : (uploadedImage || undefined);
    if (generatedImagePrompt) { setUploadedImage(null); setGeneratedImagePrompt(null); setImageForContent(null); }
    generateMutation.mutate({ ...buildOptions(), imageUrl: carryImage });
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

  const runImageGeneration = async (postIdOverride?: number | null, genId: number = genGuardRef.current.current) => {
    if (!topic.trim()) { toast.error("Skriv inn et emne f\u00f8rst"); return; }
    setIsGeneratingImage(true);
    // Each attempt gets a unique id and CLAIMS the post's image slot, so a rapid
    // re-click supersedes the previous attempt and its late response is rejected.
    const imageGenId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    const pid = postIdOverride ?? savedPostId;
    try {
      if (pid) {
        try { await setImageGeneratingMutation.mutateAsync({ postId: pid, generationId: imageGenId }); } catch { /* non-fatal */ }
      }
      const mutation = imageGenerationType === "dalle" ? dalleImageMutation : nanoImageMutation;
      const res = await mutation.mutateAsync({ topic, platform, tone, keywords: [] });
      // A newer generation started while this image was rendering -> discard it
      // so it never attaches to or displays on the wrong post.
      if (!genGuardRef.current.isCurrent(genId)) return;
      if (res?.url) {
        setUploadedImage(res.url);
        setGeneratedImagePrompt(res.prompt || topic);
        setImageForContent(generatedContent || topic);
        // Attach with THIS attempt's id; the server rejects it if a newer attempt
        // has since claimed the slot, so the wrong image never sticks to a post.
        if (pid) {
          attachImageMutation.mutate({ postId: pid, imageUrl: res.url, generationId: imageGenId });
        }
        toast.success("AI-bilde generert!");
      } else {
        toast.error("Kunne ikke generere bilde");
      }
    } catch (error: any) {
      const msg = String(error?.message || "");
      const code = error?.data?.code || error?.shape?.data?.code;
      const isBusy =
        code === "TOO_MANY_REQUESTS" ||
        /too many|for mange|opptatt|rate.?limit|429/i.test(msg);
      const isUnparsable = /not valid json|unexpected token|unable to transform|transform response/i.test(msg);
      if (isBusy || isUnparsable) {
        toast.error("Bildegenerering er opptatt \u2014 pr\u00f8v igjen om litt.");
      } else {
        toast.error(msg && msg.length < 160 ? msg : "Feil ved generering av bilde. Pr\u00f8v igjen.");
      }
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGenerateAIImage = () => runImageGeneration();

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
  // ── Enkel (simple) mode: one calm, guided screen. Few choices — the Merkehjerne
  //    (brand DNA) and smart defaults do the rest. Reuses the same generate/image
  //    handlers as the full studio, so nothing behaves differently under the hood. ──
  const simpleMode =
    (viewModeQuery.data ??
      ((typeof window !== "undefined" && window.localStorage.getItem("penna-view-mode") === "simple")
        ? "simple"
        : "advanced")) === "simple";
  if (simpleMode) {
    const busy = generateMutation.isPending;
    const brandName = brandProfileQuery.data?.companyName ?? "";
    // MB3: only offer platforms this brand is actually connected to. When the
    // multi-brand flag is off we keep the previous behaviour (all three shown).
    const ALL_PICKS = [
      { id: "linkedin" as const, label: "LinkedIn", Icon: Linkedin },
      { id: "facebook" as const, label: "Facebook", Icon: Facebook },
      { id: "instagram" as const, label: "Instagram", Icon: Instagram },
    ];
    // PR #82: while the destinations are still loading we know NOTHING about what
    // this brand can publish to. Falling back to ALL_PICKS meant the three
    // platforms flashed up, the user clicked one, and it vanished a moment later
    // when the real answer arrived — or worse, stayed selected and failed at
    // publish time. Show nothing until we know; keep the old behaviour only when
    // multi-brand is genuinely off.
    // Key off the queries' own loading state, not isSuccess:
    //  - while socialFlags itself is in flight, `data` is undefined, so
    //    `!== true` was TRUE and all three chips still flashed up on first paint;
    //  - isSuccess never becomes true on error, so a 500 (or the FORBIDDEN when
    //    multi-brand is off for this account) left the page stuck on
    //    "Henter kanalene …" forever with nothing selectable.
    const flagsSettled = !socialFlags.isLoading;
    const multiBrandOn = socialFlags.data?.enabled === true;
    const destinationsKnown = flagsSettled && (!multiBrandOn || !destinationsQuery.isLoading);
    // On error we know nothing about this brand's channels. Offering all three
    // would invite a publish that fails; offering none would be a dead end. Fall
    // back to all three and let the server refuse with a real message.
    const connected = destinationsQuery.isError
      ? null
      : destinationsQuery.data?.platforms?.filter((p) => p.connected).map((p) => p.platform) ?? null;
    const platformPicks = !destinationsKnown
      ? []
      : connected
        ? ALL_PICKS.filter((p) => connected.includes(p.id))
        : ALL_PICKS;
    const destinationName =
      destinationsQuery.data?.platforms?.find((p) => p.platform === platform && p.connected)?.destinationName ?? null;
    // MB3: examples come from the ACTIVE brand's Merkehjerne, never hard-coded.
    const examples = buildBrandExamples(brandProfileQuery.data ?? null);
    // Alt text for the generated image (a11y) + "text changed since the image" check.
    const imageAlt = generatedContent
      ? `Illustrasjon til innlegget: ${generatedContent.replace(/\s+/g, " ").trim().slice(0, 120)}`
      : "Illustrasjonsbilde til innlegget";
    const imageMayMismatch =
      !!uploadedImage && !!generatedImagePrompt && !!imageForContent && imageForContent !== generatedContent;

    const startOver = () => {
      genGuardRef.current.start();
      setGeneratedContent("");
      setTopic("");
      setUploadedImage(null);
      setGeneratedImagePrompt(null);
      setSavedPostId(null);
    };
    return (
      <main className="container max-w-2xl py-6 sm:py-10 px-4">
        <div className="flex items-start gap-3 mb-6">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 grid place-items-center shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Lag et innlegg</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {brandName
                ? `Fortell hva du vil dele — Penna bruker Merkehjernen til ${brandName} og skriver et ferdig innlegg.`
                : "Fortell hva du vil dele, så skriver Penna et ferdig innlegg for deg."}
            </p>
          </div>
        </div>

        {!generatedContent ? (
          <Card>
            <CardContent className="p-5 sm:p-6 space-y-6">
              <div className="space-y-2">
                <Label className="text-base font-semibold">Hva vil du dele?</Label>
                <Textarea
                  rows={5}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={busy}
                  placeholder="F.eks. «Vi har lansert en ny ballongpakke for bursdager» – skriv kort hva som er spesielt."
                  className="text-base resize-none"
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  {examples.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setTopic(ex)}
                      disabled={busy}
                      className="text-xs rounded-full border px-3 py-1.5 text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Hvor skal det deles?</Label>
                {!destinationsKnown && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Henter kanalene til merkevaren …
                  </p>
                )}
                {destinationsKnown && platformPicks.length === 0 && (
                  <p className="text-xs text-amber-600">
                    Ingen kanaler er koblet til denne merkevaren ennå. Du kan fortsatt lage innlegget
                    og publisere det senere — eller{" "}
                    <button
                      type="button"
                      onClick={() => setLocation("/settings/platforms")}
                      className="font-medium underline underline-offset-2"
                    >
                      koble til en konto
                    </button>
                    .
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {platformPicks.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPlatform(id)}
                      disabled={busy}
                      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                        platform === id ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
                {destinationName && (
                  <p className="text-xs text-muted-foreground">Publiseres som <span className="font-medium">{destinationName}</span></p>
                )}
              </div>

              {carriedScheduledAt && (
                <div className="flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-3.5 text-sm">
                  <Calendar className="h-4 w-4 text-primary" />
                  Planlegges til {new Date(carriedScheduledAt).toLocaleDateString("nb-NO")} — du bekrefter tidspunktet etterpå
                </div>
              )}
              <div className="flex items-center gap-2.5 rounded-xl border bg-muted/30 p-3.5 text-sm text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
                Et passende bilde lages automatisk med innlegget
              </div>

              <Button size="lg" className="w-full h-12 text-base" onClick={handleGenerate} disabled={busy || !topic.trim()}>
                {busy ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Lager innlegget …
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Lag innlegg
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={() => setViewModeMutation.mutate({ viewMode: "advanced" })}
                disabled={setViewModeMutation.isPending}
                className="mx-auto block text-xs text-muted-foreground hover:text-primary"
              >
                Vis flere valg
              </button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                Ferdig! Lagret i «Mine innlegg».
              </div>
              {uploadedImage && (
                <>
                  <img src={uploadedImage} alt={imageAlt} className="w-full rounded-xl border" />
                  {imageMayMismatch && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                      <span className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                        Du har endret teksten — bildet passer kanskje ikke lenger.
                      </span>
                      <Button size="sm" variant="outline" onClick={handleGenerateAIImage} disabled={isGeneratingImage}>
                        {isGeneratingImage
                          ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Oppdaterer …</>
                          : <>Oppdater bilde</>}
                      </Button>
                    </div>
                  )}
                </>
              )}
              {isGeneratingImage && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Lager bilde …
                </div>
              )}
              <Textarea
                rows={10}
                value={generatedContent}
                onChange={(e) => setGeneratedContent(e.target.value)}
                className="text-base leading-relaxed resize-none"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Button className="h-11" onClick={handleCopy}>
                  <Copy className="h-4 w-4 mr-2" />
                  Kopier tekst
                </Button>
                <Button variant="outline" className="h-11" onClick={handleGenerate} disabled={busy}>
                  <RotateCw className={`h-4 w-4 mr-2 ${busy ? "animate-spin" : ""}`} />
                  Lag på nytt
                </Button>
                <Button variant="outline" className="h-11" onClick={() => setLocation("/posts")}>
                  Se mine innlegg
                </Button>
                <Button variant="outline" className="h-11" onClick={() => setScheduleOpen(true)} disabled={!savedPostId}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Planlegg
                </Button>
                <Button variant="ghost" className="h-11" onClick={startOver}>
                  Skriv nytt
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        <ScheduleDialog
          open={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          postId={savedPostId}
          platform={platform}
          content={generatedContent}
          imageUrl={uploadedImage}
          defaultDate={carriedScheduledAt}
        />
      </main>
    );
  }

  const activeStep = !topic.trim() ? 1 : !generatedContent ? 2 : 3;

  return (
    <div className="bg-gradient-to-b from-slate-50/80 via-background to-background dark:from-slate-950/50">
      <main className="container py-6 md:py-8 max-w-7xl">

        {/* ─── Lag innlegg: velg metode ─── */}
        <div className="mb-6">
          <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1 gap-1">
            <button
              type="button"
              onClick={() => setCreateMode("dna")}
              className={"px-4 h-9 rounded-lg text-sm font-medium transition-colors " + (createMode === "dna" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              Fra Merkehjerne (DNA)
            </button>
            <button
              type="button"
              onClick={() => setCreateMode("write")}
              className={"px-4 h-9 rounded-lg text-sm font-medium transition-colors " + (createMode === "write" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              Skriv selv + trender
            </button>
          </div>

          {createMode === "dna" && (
            <div className="mt-4 rounded-xl border border-primary/20 bg-card p-4">
              {brandProfileQuery.data && brandProfileQuery.data.status === "ready" ? (
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Innlegg bygges på din Merkehjerne ({brandProfileQuery.data.companyName}). Velg en idé for å starte:</p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(brandProfileQuery.data.contentIdeas ?? []).slice(0, 12).map((idea, index) => (
                      <button
                        key={`${idea.title}-${index}`}
                        type="button"
                        onClick={() => {
                          setTopic(`${idea.title}\n\nVinkel: ${idea.angle}`);
                          if (idea.platform) setPlatform(idea.platform);
                          setCreateMode("write");
                        }}
                        className="text-left rounded-lg border border-border p-3 hover:border-primary/40 hover:bg-muted/40 transition-colors"
                      >
                        <span className="text-xs font-medium text-primary">{idea.pillar}</span>
                        <span className="block font-medium text-sm mt-1">{idea.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-3">Bygg din Merkehjerne først — lim inn nettstedet ditt, så leser Penna det og lager innhold basert på bedriften din.</p>
                  <a href="/merkehjerne" className="inline-flex items-center h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Bygg Merkehjerne</a>
                </div>
              )}
            </div>
          )}
        </div>

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
            {/* Mobile tab switcher (Skriv / Resultat). On lg+ both halves show stacked. */}
            <div className="lg:hidden grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg sticky top-2 z-20">
              <button type="button" onClick={() => setMobileTab("skriv")} className={`py-2 rounded-md text-sm font-medium transition-colors ${mobileTab === "skriv" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>✍️ Skriv</button>
              <button type="button" onClick={() => setMobileTab("resultat")} className={`py-2 rounded-md text-sm font-medium transition-colors ${mobileTab === "resultat" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>👁️ Resultat</button>
            </div>
            <div className={`space-y-5 ${mobileTab === "resultat" ? "hidden lg:block" : ""}`}>

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
                      className="inline-flex items-center justify-center min-h-[24px] min-w-[24px] px-1.5 py-1 text-muted-foreground hover:text-destructive"
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
                  onChange={(e) => { userTypedRef.current = true; setTopic(e.target.value); }}
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
                    {subscription?.status === "trial" && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">✨ 2 gratis AI-bilder</p>
                        <p className="text-xs text-amber-700 dark:text-amber-400">Gratis-planen inkluderer 2 gratis AI-bilder (engangs). Oppgrader til Pro for flere.</p>
                      </div>
                    )}
                    {(
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                                <SelectItem value="nanoBanana">⚡ FLUX (rask, rimelig)</SelectItem>
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
                        <p className="text-xs font-medium">🤖 {imageGenerationType === "dalle" ? "OpenAI (GPT Image)" : "FLUX"}</p>
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

            </div>
            <div className={`space-y-5 ${mobileTab === "skriv" ? "hidden lg:block" : ""}`}>
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                  <PostToLinkedInButton content={generatedContent} platform={platform} postId={savedPostId ?? undefined} />

                  {/* Schedule this post — jumps to the Smart Scheduling panel */}
                  <Button
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() =>
                      document
                        .getElementById("smart-scheduling")
                        ?.scrollIntoView({ behavior: "smooth", block: "center" })
                    }
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Planlegg innlegg
                  </Button>

                  {/* Run A/B test on this content */}
                  <Button
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => {
                      // Pass via memory, not the URL, so the full post body never
                      // leaks into browser history or server logs.
                      setAbTestHandoff({ body: generatedContent, platform, postId: savedPostId ?? undefined });
                      setLocation("/ab-testing");
                    }}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Kjør A/B-test
                  </Button>
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
                  <div id="smart-scheduling">
                    <SmartSchedulingSuggestions
                      keyword={topic}
                      platform={platform}
                      onSchedule={handleSchedule}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
