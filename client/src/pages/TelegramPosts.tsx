/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/PageHeader";
import { PAGE_DESCRIPTIONS } from "@/lib/pageDescriptions";
import { Loader2, MessageSquare, Sparkles, Copy, Check, Save, Lightbulb, Trash2, Edit, CheckSquare, Square, Search, CopyPlus, MoreVertical, Tag, X } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Breadcrumb } from "@/components/Breadcrumb";
import { SkeletonCard } from "@/components/SkeletonLoader";

export default function TelegramPosts() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [expandedPostId, setExpandedPostId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<number | null>(null);
  const [selectedPosts, setSelectedPosts] = useState<number[]>([]);
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<{ id: number; content: string } | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [tagPostId, setTagPostId] = useState<number | null>(null);
  const [newTag, setNewTag] = useState("");
  
  // Fetch Telegram-generated posts (last 10)
  const { data: telegramPosts, isLoading, refetch } = trpc.telegram.getRecentPosts.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Fetch all available tags
  const { data: tagsData } = trpc.telegram.getAllTags.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  
  // Filter, search, sort, and filter by tags
  const filteredPosts = useMemo(() => {
    if (!telegramPosts) return [];
    
    let filtered = telegramPosts;
    
    // Filter by platform
    if (platformFilter !== "all") {
      filtered = filtered.filter((post: any) => post.platform === platformFilter);
    }

    // Filter by tag
    if (tagFilter !== "all") {
      filtered = filtered.filter((post: any) => 
        post.tags && Array.isArray(post.tags) && post.tags.includes(tagFilter)
      );
    }
    
    // Search by rawInput or generatedContent
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((post: any) => 
        post.rawInput.toLowerCase().includes(query) ||
        post.generatedContent.toLowerCase().includes(query)
      );
    }
    
    // Sort
    const sorted = [...filtered];
    switch (sortBy) {
      case "newest":
        sorted.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "oldest":
        sorted.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case "platform":
        sorted.sort((a: any, b: any) => a.platform.localeCompare(b.platform));
        break;
    }
    
    return sorted;
  }, [telegramPosts, platformFilter, tagFilter, searchQuery, sortBy]);

  // Generate 3 alternatives mutation
  const generateAlternatives = trpc.telegram.generateAlternatives.useMutation({
    onSuccess: () => {
      toast.success("3 alternativer generert!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Kunne ikke generere alternativer");
    },
  });

  // Save post mutation
  const savePost = trpc.telegram.savePost.useMutation({
    onSuccess: () => {
      toast.success("Innlegget er lagret i Mine innlegg!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Kunne ikke lagre innlegg");
    },
  });

  // Move to idea bank mutation
  const moveToIdeaBank = trpc.telegram.moveToIdeaBank.useMutation({
    onSuccess: () => {
      toast.success("Idé flyttet til Idé-Bank!");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Kunne ikke flytte til Idé-Bank");
    },
  });

  // Delete post mutation
  const deletePost = trpc.telegram.deletePost.useMutation({
    onSuccess: () => {
      toast.success("Innlegg slettet!");
      setDeleteDialogOpen(false);
      setPostToDelete(null);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Kunne ikke slette innlegg");
    },
  });

  // Bulk delete posts mutation
  const bulkDeletePosts = trpc.telegram.bulkDeletePosts.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} innlegg slettet!`);
      setSelectedPosts([]);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Kunne ikke slette innlegg");
    },
  });

  // Bulk move to idea bank mutation
  const bulkMoveToIdeaBank = trpc.telegram.bulkMoveToIdeaBank.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} ideer flyttet til Idé-Bank!`);
      setSelectedPosts([]);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Kunne ikke flytte til Idé-Bank");
    },
  });

  // Edit post mutation
  const editPost = trpc.telegram.editPost.useMutation({
    onSuccess: () => {
      toast.success("Innlegget er oppdatert!");
      setEditDialogOpen(false);
      setEditingPost(null);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Kunne ikke oppdatere innlegg");
    },
  });

  // Duplicate post mutation
  const duplicatePost = trpc.telegram.duplicatePost.useMutation({
    onSuccess: (data) => {
      toast.success("Innlegg duplisert!");
      // Open edit dialog with duplicated content
      setEditingPost({ id: data.newPostId, content: data.content });
      setEditedContent(data.content);
      setEditDialogOpen(true);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Kunne ikke duplisere innlegg");
    },
  });

  // Add tag mutation
  const addTag = trpc.telegram.addTag.useMutation({
    onSuccess: () => {
      toast.success("Tag lagt til!");
      setNewTag("");
      setTagDialogOpen(false);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Kunne ikke legge til tag");
    },
  });

  // Remove tag mutation
  const removeTag = trpc.telegram.removeTag.useMutation({
    onSuccess: () => {
      toast.success("Tag fjernet!");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Kunne ikke fjerne tag");
    },
  });

  const handleCopy = (content: string, postId: number) => {
    navigator.clipboard.writeText(content);
    setCopiedId(postId);
    toast.success("Kopiert til utklippstavle!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGenerateAlternatives = (postId: number, rawInput: string) => {
    setExpandedPostId(postId);
    generateAlternatives.mutate({ postId, rawInput });
  };

  const handleSave = (postId: number) => {
    savePost.mutate({ postId });
  };

  const handleDeleteClick = (postId: number) => {
    setPostToDelete(postId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (postToDelete) {
      deletePost.mutate({ postId: postToDelete });
    }
  };

  const handleMoveToIdeaBank = (postId: number, rawInput: string) => {
    moveToIdeaBank.mutate({ postId, rawInput });
  };

  const handleBulkDelete = () => {
    if (selectedPosts.length === 0) return;
    bulkDeletePosts.mutate({ postIds: selectedPosts });
  };

  const handleBulkMoveToIdeaBank = () => {
    if (selectedPosts.length === 0) return;
    
    const items = selectedPosts.map(postId => {
      const post = telegramPosts?.find((p: any) => p.id === postId);
      return {
        postId,
        rawInput: post?.rawInput || "",
      };
    });
    
    bulkMoveToIdeaBank.mutate({ items });
  };

  const handleEditClick = (postId: number, content: string) => {
    setEditingPost({ id: postId, content });
    setEditedContent(content);
    setEditDialogOpen(true);
  };

  const handleEditSave = () => {
    if (editingPost) {
      editPost.mutate({ postId: editingPost.id, newContent: editedContent });
    }
  };

  const handleDuplicate = (postId: number) => {
    duplicatePost.mutate({ postId });
  };

  const handleSelectPost = (postId: number, checked: boolean) => {
    if (checked) {
      setSelectedPosts([...selectedPosts, postId]);
    } else {
      setSelectedPosts(selectedPosts.filter(id => id !== postId));
    }
  };

  const handleSelectAll = () => {
    if (selectedPosts.length === filteredPosts.length) {
      setSelectedPosts([]);
    } else {
      setSelectedPosts(filteredPosts.map((post: any) => post.id));
    }
  };

  const handleAddTagClick = (postId: number) => {
    setTagPostId(postId);
    setTagDialogOpen(true);
  };

  const handleAddTagSubmit = () => {
    if (tagPostId && newTag.trim()) {
      addTag.mutate({ postId: tagPostId, tag: newTag.trim() });
    }
  };

  const handleRemoveTag = (postId: number, tag: string) => {
    removeTag.mutate({ postId, tag });
  };

  // Tag color mapping
  const getTagColor = (tag: string) => {
    const colors: Record<string, string> = {
      "viktig": "bg-red-100 text-red-800 hover:bg-red-200",
      "haster": "bg-orange-100 text-orange-800 hover:bg-orange-200",
      "utkast": "bg-gray-100 text-gray-800 hover:bg-gray-200",
      "klar": "bg-green-100 text-green-800 hover:bg-green-200",
      "planlagt": "bg-blue-100 text-blue-800 hover:bg-blue-200",
    };
    return colors[tag.toLowerCase()] || "bg-purple-100 text-purple-800 hover:bg-purple-200";
  };

  if (authLoading) {
    return (
      <div className="container py-8">
        <Breadcrumb items={[
          { label: "Dashboard", href: "/" },
          { label: "Telegram Innlegg", current: true }
        ]} className="mb-4" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Logg inn</CardTitle>
            <CardDescription>Du må være logget inn for å se Telegram-innlegg.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6">
      <Breadcrumb items={[
        { label: "Dashboard", href: "/" },
        { label: "Telegram Innlegg", current: true }
      ]} className="mb-4" />
      <PageHeader 
        title="Telegram Innlegg" 
        description={PAGE_DESCRIPTIONS.telegramPosts} 
      />

      {/* Filter and bulk actions bar */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : telegramPosts && telegramPosts.length > 0 && (
        <Card>
          <CardContent className="pt-4 sm:pt-6 space-y-3 sm:space-y-4">
            {/* Search and Sort Row */}
            <div className="flex flex-col gap-3">
              {/* Search */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Input
                  type="text"
                  placeholder="Søk i innlegg..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 min-w-0"
                />
              </div>

              {/* Sort */}
              <div className="flex items-center gap-1 sm:gap-2">
                <Label htmlFor="sort-by" className="text-xs whitespace-nowrap">Sorter:</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger id="sort-by" className="flex-1 sm:flex-none sm:w-[180px]">
                    <SelectValue placeholder="Sorter etter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Nyeste først</SelectItem>
                    <SelectItem value="oldest">Eldste først</SelectItem>
                    <SelectItem value="platform">Platform A-Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Filter and Bulk Actions Row */}
            <div className="flex flex-col gap-3">
              {/* Platform filter */}
              <div className="flex items-center gap-1 sm:gap-2">
                <Label htmlFor="platform-filter" className="text-xs whitespace-nowrap">Plattform:</Label>
                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger id="platform-filter" className="flex-1 sm:flex-none sm:w-[180px]">
                    <SelectValue placeholder="Velg plattform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="twitter">Twitter</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tag filter */}
              <div className="flex items-center gap-1 sm:gap-2">
                <Label htmlFor="tag-filter" className="text-xs whitespace-nowrap">Tag:</Label>
                <Select value={tagFilter} onValueChange={setTagFilter}>
                  <SelectTrigger id="tag-filter" className="flex-1 sm:flex-none sm:w-[180px]">
                    <SelectValue placeholder="Velg tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    {tagsData?.tags.map((tag: string) => (
                      <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Select all button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedPosts.length === filteredPosts.length ? (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Avmerk alle
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Velg alle
                  </>
                )}
              </Button>

              {/* Bulk actions */}
              {selectedPosts.length > 0 && (
                <>
                  <div className="text-sm text-muted-foreground">
                    {selectedPosts.length} valgt
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkMoveToIdeaBank}
                    disabled={bulkMoveToIdeaBank.isPending}
                  >
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Flytt valgte til Idé-Bank
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={bulkDeletePosts.isPending}
                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Slett valgte
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Posts list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !telegramPosts || telegramPosts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Ingen innlegg ennå</h3>
            <p className="text-muted-foreground mb-4">
              Send en idé til Telegram-boten for å generere ditt første innlegg!
            </p>
          </CardContent>
        </Card>
      ) : filteredPosts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Ingen resultater</h3>
            <p className="text-muted-foreground">
              Prøv å justere søket eller filtrene dine.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post: any) => (
            <Card key={post.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <Checkbox
                      checked={selectedPosts.includes(post.id)}
                      onCheckedChange={(checked) => handleSelectPost(post.id, checked as boolean)}
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="capitalize">
                          {post.platform}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: nb })}
                        </span>
                      </div>
                      
                      {/* Tags display */}
                      {post.tags && Array.isArray(post.tags) && post.tags.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {post.tags.map((tag: string) => (
                            <Badge 
                              key={tag} 
                              className={`${getTagColor(tag)} cursor-pointer`}
                              onClick={() => handleRemoveTag(post.id, tag)}
                            >
                              {tag}
                              <X className="h-3 w-3 ml-1" />
                            </Badge>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => handleAddTagClick(post.id)}
                          >
                            <Tag className="h-3 w-3 mr-1" />
                            Legg til tag
                          </Button>
                        </div>
                      )}
                      {(!post.tags || post.tags.length === 0) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => handleAddTagClick(post.id)}
                        >
                          <Tag className="h-3 w-3 mr-1" />
                          Legg til tag
                        </Button>
                      )}
                      
                      <CardTitle className="text-base">
                        Opprinnelig idé:
                      </CardTitle>
                      <CardDescription className="whitespace-pre-wrap">
                        {post.rawInput}
                      </CardDescription>
                    </div>
                  </div>

                  {/* Quick Actions Dropdown Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditClick(post.id, post.generatedContent)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Rediger
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(post.id)}>
                        <CopyPlus className="h-4 w-4 mr-2" />
                        Dupliser
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSave(post.id)}>
                        <Save className="h-4 w-4 mr-2" />
                        Lagre
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleMoveToIdeaBank(post.id, post.rawInput)}>
                        <Lightbulb className="h-4 w-4 mr-2" />
                        Til Idé-Bank
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDeleteClick(post.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Slett
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Generated content */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      Generert innlegg:
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(post.generatedContent, post.id)}
                    >
                      {copiedId === post.id ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {post.generatedContent}
                  </p>
                </div>

                {/* Generate alternatives button */}
                {expandedPostId !== post.id && (
                  <Button
                    onClick={() => handleGenerateAlternatives(post.id, post.rawInput)}
                    disabled={generateAlternatives.isPending}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    {generateAlternatives.isPending && expandedPostId === post.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Genererer...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generer 3 alternativer
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil permanent slette innlegget. Denne handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Slett
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Rediger innlegg</DialogTitle>
            <DialogDescription>
              Gjør endringer i innlegget ditt her.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-content">Innhold</Label>
              <Textarea
                id="edit-content"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                rows={10}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={handleEditSave} disabled={editPost.isPending}>
              {editPost.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Lagrer...
                </>
              ) : (
                "Lagre endringer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add tag dialog */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Legg til tag</DialogTitle>
            <DialogDescription>
              Legg til en tag for å organisere innlegget ditt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-tag">Tag navn</Label>
              <Input
                id="new-tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="f.eks. viktig, haster, utkast"
                className="mt-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTagSubmit();
                  }
                }}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Foreslåtte tags:</p>
              <div className="flex flex-wrap gap-2">
                {["viktig", "haster", "utkast", "klar", "planlagt"].map((tag) => (
                  <Badge
                    key={tag}
                    className={`${getTagColor(tag)} cursor-pointer`}
                    onClick={() => setNewTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setTagDialogOpen(false);
              setNewTag("");
            }}>
              Avbryt
            </Button>
            <Button onClick={handleAddTagSubmit} disabled={addTag.isPending || !newTag.trim()}>
              {addTag.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Legger til...
                </>
              ) : (
                "Legg til"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}