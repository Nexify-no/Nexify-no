/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Copy, Zap, Trash2, Star, FileText, Plus, Search, Sparkles } from "lucide-react";
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

  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    if (!searchQuery.trim()) return posts;
    return posts.filter(post => 
      post.generatedContent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.rawInput?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [posts, searchQuery]);

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
    </div>
  );
}