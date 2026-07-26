/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Copy, Zap, Trash2, Star, FileText, Plus, Search, Sparkles, Send, Loader2, Pencil, Image as ImageIcon, CalendarClock } from "lucide-react";
import { ScheduleDialog } from "@/components/ScheduleDialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { Breadcrumb } from "@/components/Breadcrumb";
import { SkeletonCard } from "@/components/SkeletonLoader";

export default function Posts() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { t, language } = useLanguage();
  const [, setLocation] = useLocation();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [exampleTitle, setExampleTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPost, setExpandedPost] = useState<number | null>(null);
  const [publishPostId, setPublishPostId] = useState<number | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [imageOnly, setImageOnly] = useState(false);
  const [editPostId, setEditPostId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [imagingPostId, setImagingPostId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: posts, isLoading } = trpc.content.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const deleteMutation = trpc.content.delete.useMutation({
    onSuccess: () => {
      utils.content.list.invalidate();
      toast.success(t("postDeleted"));
    },
    onError: (error) => {
      toast.error(error.message || t("errorGeneral"));
    },
  });
  
  const saveExampleMutation = trpc.examples.save.useMutation({
    onSuccess: () => {
      toast.success(language === "no" ? "Eksempel lagret!" : "Example saved!");
      setSaveDialogOpen(false);
      setExampleTitle("");
      setSelectedPostId(null);
    },
    onError: (error) => {
      toast.error(error.message || t("errorGeneral"));
    },
  });

  const publishMutation = trpc.platform.publishToSpecific.useMutation({
    onSuccess: (r) => {
      // PR #82: the procedure's outer catch RESOLVES with { success: false }, so
      // a server-side refusal arrived here — not in onError — and neither count
      // was set. The user clicked Publiser and got no feedback whatsoever.
      if (r.success === false) {
        toast.error(r.error || (language === "no" ? "Publisering mislyktes" : "Publishing failed"));
        setPublishPostId(null);
        return;
      }
      if ((r.successCount ?? 0) > 0) {
        toast.success(language === "no" ? `Publisert til ${r.successCount} plattform(er)` : `Published to ${r.successCount} platform(s)`);
      }
      if ((r.failureCount ?? 0) > 0) {
        const errs = (r.results || []).filter((x) => !x.success).map((x) => `${x.platform}: ${x.error || "feil"}`).join(", ");
        toast.error((language === "no" ? "Noen feilet: " : "Some failed: ") + errs);
      }
      utils.content.list.invalidate();
      setPublishPostId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.content.update.useMutation({
    onSuccess: () => {
      utils.content.list.invalidate();
      toast.success(language === "no" ? "Innlegg oppdatert" : "Post updated");
      setEditPostId(null);
    },
    onError: (e) => toast.error(e.message),
  });
  // PR #81: schedule a draft straight from "Mine innlegg" — previously the only
  // way in was the calendar, so a draft you were already looking at could not be
  // planned without navigating away and finding it again.
  const [schedulePost, setSchedulePost] = useState<{
    id: number;
    platform: "linkedin" | "twitter" | "instagram" | "facebook";
    content: string;
    imageUrl?: string | null;
  } | null>(null);

  const genImageMutation = trpc.content.generateImageNanoBanana.useMutation();
  const attachImageMutation = trpc.content.attachImage.useMutation();

  const openEdit = (post: any) => {
    setEditPostId(post.id);
    setEditContent(post.generatedContent || "");
  };
  const saveEdit = () => {
    if (editPostId != null) updateMutation.mutate({ postId: editPostId, content: editContent });
  };
  const generateImageForPost = async (post: any) => {
    setImagingPostId(post.id);
    try {
      const res = await genImageMutation.mutateAsync({
        topic: (post.rawInput || post.generatedContent || "").slice(0, 200),
        platform: (post.platform || "linkedin"),
        tone: (post.tone || "professional"),
        keywords: [],
      });
      if (res?.url) {
        // attachImage only persists hosted (https) URLs; a data: URL means object
        // storage failed, so report honestly instead of a false "image added".
        const att = await attachImageMutation.mutateAsync({ postId: post.id, imageUrl: res.url });
        if ((att as any)?.success) {
          utils.content.list.invalidate();
          toast.success(language === "no" ? "Bilde lagt til" : "Image added");
        } else {
          console.warn("[image] not saved:", (att as any)?.reason);
          toast.error(language === "no"
            ? "Bildet ble laget, men kunne ikke lagres akkurat nå. Prøv igjen senere."
            : "Image was created but could not be saved right now. Try again later.");
        }
      } else {
        toast.error(language === "no" ? "Kunne ikke generere bilde" : "Could not generate image");
      }
    } catch (e: any) {
      const msg = String(e?.message || "");
      toast.error(
        /opptatt|too many|rate|429|transform/i.test(msg)
          ? (language === "no" ? "Bildegenerering er opptatt — prøv igjen om litt." : "Image generation busy — try again.")
          : (language === "no" ? "Feil ved bildegenerering." : "Image generation failed.")
      );
    } finally {
      setImagingPostId(null);
    }
  };

  const openPublishDialog = (post: { id: number; platform: string }) => {
    setPublishPostId(post.id);
    setSelectedPlatforms([post.platform]);
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  const handlePublish = (post: { generatedContent: string; imageUrl?: string | null; rawInput?: string | null }) => {
    if (selectedPlatforms.length === 0) {
      toast.error(language === "no" ? "Velg minst én plattform" : "Select at least one platform");
      return;
    }
    publishMutation.mutate({
      platforms: selectedPlatforms,
      content: post.generatedContent,
      imageUrl: post.imageUrl || undefined,
      title: post.rawInput?.slice(0, 80),
      postId: publishPostId ?? undefined,
    });
  };

  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    const q = searchQuery.trim().toLowerCase();
    const list = posts.filter((post: any) => {
      const matchesSearch =
        !q ||
        post.generatedContent?.toLowerCase().includes(q) ||
        post.rawInput?.toLowerCase().includes(q);
      const matchesPlatform = platformFilter === "all" || post.platform === platformFilter;
      const matchesStatus = statusFilter === "all" || post.status === statusFilter;
      const matchesImage = !imageOnly || !!post.imageUrl;
      return matchesSearch && matchesPlatform && matchesStatus && matchesImage;
    });
    return [...list].sort((a: any, b: any) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return sortBy === "newest" ? tb - ta : ta - tb;
    });
  }, [posts, searchQuery, platformFilter, statusFilter, imageOnly, sortBy]);

  if (authLoading || !isAuthenticated) {
    if (!authLoading && !isAuthenticated) {
      window.location.href = getLoginUrl();
      return null;
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-14 w-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
            <Zap className="h-6 w-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Laster innlegg...</p>
        </div>
      </div>
    );
  }

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success(t("copiedSuccess"));
  };

  const handleSaveAsExample = (postId: number) => {
    setSelectedPostId(postId);
    setSaveDialogOpen(true);
  };
  
  const handleSaveExample = () => {
    if (!selectedPostId || !exampleTitle.trim()) return;
    saveExampleMutation.mutate({ postId: selectedPostId, title: exampleTitle });
  };

  const handleDelete = (postId: number) => {
    if (window.confirm(language === "no" ? "Er du sikker på at du vil slette dette innlegget?" : "Are you sure you want to delete this post?")) {
      deleteMutation.mutate({ postId });
    }
  };

  const getPlatformConfig = (platform: string) => {
    const configs: Record<string, { icon: string; color: string; bg: string }> = {
      linkedin: { icon: "in", color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/40" },
      twitter: { icon: "𝕏", color: "text-slate-900 dark:text-slate-100", bg: "bg-slate-100 dark:bg-slate-800" },
      instagram: { icon: "ig", color: "text-pink-600", bg: "bg-pink-100 dark:bg-pink-900/40" },
      facebook: { icon: "fb", color: "text-blue-700", bg: "bg-blue-100 dark:bg-blue-900/40" }
    };
    return configs[platform] || { icon: "?", color: "text-slate-600", bg: "bg-slate-100" };
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/80 via-background to-background dark:from-slate-950/50">
      <main className="container py-6 md:py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-6 page-enter">
          <Breadcrumb items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: language === "no" ? "Mine Innlegg" : "My Posts", current: true }
          ]} className="mb-3" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-white" />
                </div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                  {language === "no" ? "Mine Innlegg" : "My Posts"}
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                {isLoading ? (language === "no" ? "Laster..." : "Loading...") : `${posts?.length || 0} ${language === "no" ? "innlegg generert" : "posts generated"}`}
              </p>
            </div>
            <Button 
              onClick={() => setLocation("/generate")}
              className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 text-white border-0"
            >
              <Plus className="h-4 w-4" />
              {language === "no" ? "Nytt innlegg" : "New Post"}
            </Button>
          </div>
        </div>

        {/* Search */}
        {posts && posts.length > 0 && (
          <div className="mb-5 page-enter" style={{ animationDelay: '0.1s' }}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={language === "no" ? "Søk i innlegg..." : "Search posts..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>
        )}

        {/* Filters & sorting */}
        {posts && posts.length > 0 && (
          <div className="mb-5 flex flex-col gap-2.5 page-enter" style={{ animationDelay: '0.12s' }}>
            {/* Platform chips with counts */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { v: "all", label: language === "no" ? "Alle" : "All" },
                { v: "linkedin", label: "LinkedIn" },
                { v: "twitter", label: "Twitter/X" },
                { v: "instagram", label: "Instagram" },
                { v: "facebook", label: "Facebook" },
              ].map((opt) => {
                const count = opt.v === "all" ? posts.length : posts.filter((pp: any) => pp.platform === opt.v).length;
                if (opt.v !== "all" && count === 0) return null;
                const active = platformFilter === opt.v;
                return (
                  <button
                    key={opt.v}
                    onClick={() => setPlatformFilter(opt.v)}
                    aria-pressed={active}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${active ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                  >
                    {opt.label} <span className="opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
            {/* Status + image + sort */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { v: "all", label: language === "no" ? "Alle statuser" : "All statuses" },
                { v: "draft", label: language === "no" ? "Utkast" : "Draft" },
                { v: "published", label: language === "no" ? "Publisert" : "Published" },
                { v: "scheduled", label: language === "no" ? "Planlagt" : "Scheduled" },
              ].map((opt) => {
                const active = statusFilter === opt.v;
                return (
                  <button
                    key={opt.v}
                    onClick={() => setStatusFilter(opt.v)}
                    aria-pressed={active}
                    className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${active ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setImageOnly((v) => !v)}
                  aria-pressed={imageOnly}
                  className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${imageOnly ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                >
                  {language === "no" ? "Med bilde" : "With image"}
                </button>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
                  aria-label={language === "no" ? "Sorter" : "Sort"}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
                >
                  <option value="newest">{language === "no" ? "Nyeste først" : "Newest first"}</option>
                  <option value="oldest">{language === "no" ? "Eldste først" : "Oldest first"}</option>
                </select>
              </div>
            </div>
            {filteredPosts.length !== posts.length && (
              <p className="text-xs text-muted-foreground">
                {language === "no" ? `Viser ${filteredPosts.length} av ${posts.length}` : `Showing ${filteredPosts.length} of ${posts.length}`}
                {" · "}
                <button
                  onClick={() => { setPlatformFilter("all"); setStatusFilter("all"); setImageOnly(false); setSearchQuery(""); }}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {language === "no" ? "Nullstill filtre" : "Reset filters"}
                </button>
              </p>
            )}
          </div>
        )}

        {/* Posts List */}
        <div className="page-enter" style={{ animationDelay: '0.15s' }}>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : filteredPosts && filteredPosts.length > 0 ? (
            <div className="space-y-3">
              {filteredPosts.map((post) => {
                const platformConfig = getPlatformConfig(post.platform);
                const isExpanded = expandedPost === post.id;
                return (
                  <div 
                    key={post.id} 
                    className="group rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700"
                  >
                    <div className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Platform Icon */}
                        <div className={`h-10 w-10 rounded-xl ${platformConfig.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          <span className={`text-xs font-bold ${platformConfig.color} uppercase`}>
                            {platformConfig.icon}
                          </span>
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 capitalize">
                              {post.platform}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-400 capitalize">
                              {post.tone}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(post.createdAt).toLocaleDateString(language === "no" ? "nb-NO" : "en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                          
                          {post.rawInput && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 italic">
                              {post.rawInput.length > 80 ? post.rawInput.substring(0, 80) + "..." : post.rawInput}
                            </p>
                          )}

                          <div 
                            className={`text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed ${!isExpanded ? 'line-clamp-3' : ''}`}
                          >
                            {post.generatedContent}
                          </div>

                          {post.imageUrl && (
                            <img
                              src={post.imageUrl}
                              alt={language === "no" ? "Generert bilde for innlegget" : "Generated image for the post"}
                              loading="lazy"
                              className={`mt-3 rounded-lg border border-slate-200 dark:border-slate-700 w-full object-cover ${isExpanded ? 'max-h-96' : 'max-h-40'}`}
                            />
                          )}
                          
                          {post.generatedContent.length > 200 && (
                            <button 
                              onClick={() => setExpandedPost(isExpanded ? null : post.id)}
                              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mt-1.5 font-medium transition-colors"
                            >
                              {isExpanded 
                                ? (language === "no" ? "Vis mindre" : "Show less") 
                                : (language === "no" ? "Vis mer" : "Show more")}
                            </button>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
                          {post.status === "draft" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSchedulePost({
                                id: post.id,
                                platform: post.platform,
                                content: post.generatedContent,
                                imageUrl: post.imageUrl ?? null,
                              })}
                              title={language === "no" ? "Planlegg" : "Schedule"}
                              aria-label={language === "no" ? "Planlegg innlegg" : "Schedule post"}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/30"
                            >
                              <CalendarClock className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => openPublishDialog(post)}
                            title={language === "no" ? "Publiser" : "Publish"}
                            aria-label={language === "no" ? "Publiser innlegg" : "Publish post"}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(post)}
                            title={language === "no" ? "Rediger" : "Edit"}
                            aria-label={language === "no" ? "Rediger innlegg" : "Edit post"}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => generateImageForPost(post)}
                            disabled={imagingPostId === post.id}
                            title={language === "no" ? "Generer bilde" : "Generate image"}
                            aria-label={language === "no" ? "Generer bilde" : "Generate image"}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-fuchsia-600 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/30"
                          >
                            {imagingPostId === post.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleCopy(post.generatedContent)}
                            title={language === "no" ? "Kopier" : "Copy"}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleSaveAsExample(post.id)}
                            title={language === "no" ? "Lagre som eksempel" : "Save as example"}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                          >
                            <Star className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDelete(post.id)}
                            disabled={deleteMutation.isPending}
                            title={language === "no" ? "Slett" : "Delete"}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : posts && posts.length > 0 ? (
            <div className="text-center py-16">
              <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                {language === "no" ? "Ingen resultater" : "No results"}
              </h3>
              <p className="text-xs text-slate-400">
                {language === "no" ? "Prøv et annet søkeord" : "Try a different search term"}
              </p>
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="h-20 w-20 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Sparkles className="h-10 w-10 text-indigo-500/50" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{language === "no" ? "Ingen innlegg ennå" : "No posts yet"}</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                {language === "no" 
                  ? "Du har ikke generert noe innhold ennå. Klikk på knappen nedenfor for å lage ditt første profesjonelle innlegg!"
                  : "You haven't generated any content yet. Click the button below to create your first professional post!"}
              </p>
              <Button 
                size="lg" 
                onClick={() => setLocation("/generate")}
                className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white border-0 shadow-lg shadow-indigo-500/25"
              >
                <Sparkles className="h-5 w-5" />
                {language === "no" ? "Lag ditt første innlegg" : "Create Your First Post"}
              </Button>
            </div>
          )}
        </div>
      </main>
      
      {/* Publish Dialog */}
      <Dialog open={publishPostId !== null} onOpenChange={(open) => { if (!open) setPublishPostId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === "no" ? "Publiser innlegg" : "Publish post"}
            </DialogTitle>
            <DialogDescription>
              {language === "no"
                ? "Velg hvilke plattformer innlegget skal publiseres til."
                : "Choose which platforms to publish this post to."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-2">
              {(["linkedin", "twitter", "instagram", "facebook"] as const).map((p) => {
                const active = selectedPlatforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    role="checkbox"
                    aria-checked={active}
                    aria-label={p}
                    onClick={() => togglePlatform(p)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium capitalize transition-all ${
                      active
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    {p}
                    <span className={`h-4 w-4 rounded-full border flex items-center justify-center ${active ? "border-emerald-500 bg-emerald-500" : "border-slate-300 dark:border-slate-600"}`}>
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {language === "no"
                ? "Koble til kontoer under Innstillinger → Plattformer"
                : "Connect accounts under Settings → Platforms"}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishPostId(null)}>
              {language === "no" ? "Avbryt" : "Cancel"}
            </Button>
            <Button
              onClick={() => {
                const post = posts?.find((x) => x.id === publishPostId);
                if (post) handlePublish(post);
              }}
              disabled={publishMutation.isPending || selectedPlatforms.length === 0}
              className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0"
            >
              {publishMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> {language === "no" ? "Publiserer..." : "Publishing..."}</>
              ) : (
                <><Send className="h-4 w-4" /> {language === "no" ? "Publiser" : "Publish"}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit post dialog */}
      <Dialog open={editPostId !== null} onOpenChange={(open) => { if (!open) setEditPostId(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{language === "no" ? "Rediger innlegg" : "Edit post"}</DialogTitle>
            <DialogDescription>
              {language === "no" ? "Gjør endringer og lagre. Klar til å publisere etterpå." : "Make changes and save. Ready to publish afterwards."}
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={14}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPostId(null)}>
              {language === "no" ? "Avbryt" : "Cancel"}
            </Button>
            <Button onClick={saveEdit} disabled={updateMutation.isPending || !editContent.trim()}>
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {language === "no" ? "Lagre" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save as Example Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === "no" ? "Lagre som eksempel" : "Save as Example"}
            </DialogTitle>
            <DialogDescription>
              {language === "no"
                ? "Gi eksempelet et navn slik at du enkelt kan finne det igjen senere."
                : "Give the example a name so you can easily find it later."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                {language === "no" ? "Eksempelnavn" : "Example Name"}
              </Label>
              <Input
                id="title"
                placeholder={language === "no" ? "F.eks: Produktlansering" : "e.g: Product Launch"}
                value={exampleTitle}
                onChange={(e) => setExampleTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && exampleTitle.trim()) {
                    handleSaveExample();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              {language === "no" ? "Avbryt" : "Cancel"}
            </Button>
            <Button 
              onClick={handleSaveExample} 
              disabled={!exampleTitle.trim() || saveExampleMutation.isPending}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-0"
            >
              {saveExampleMutation.isPending 
                ? (language === "no" ? "Lagrer..." : "Saving...") 
                : (language === "no" ? "Lagre" : "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PR #81: schedule the draft you are looking at, without leaving the page.
          On success the post becomes status='scheduled' with a real
          posts.scheduledFor, so it shows up in /kalender straight away. */}
      <ScheduleDialog
        open={schedulePost != null}
        onClose={() => setSchedulePost(null)}
        postId={schedulePost?.id ?? null}
        platform={schedulePost?.platform ?? "linkedin"}
        content={schedulePost?.content ?? ""}
        imageUrl={schedulePost?.imageUrl ?? null}
        onScheduled={() => setSchedulePost(null)}
      />
    </div>
  );
}
