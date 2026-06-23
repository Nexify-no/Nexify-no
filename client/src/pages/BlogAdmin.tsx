/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Edit, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { TipTapEditor } from "@/components/TipTapEditor";
import { ImageUpload } from "@/components/ImageUpload";

export default function BlogAdmin() {
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<"tips" | "guides" | "news" | "case-studies">("tips");
  const [tags, setTags] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [readingTime, setReadingTime] = useState(5);
  const [imageUrl, setImageUrl] = useState("");
  const [published, setPublished] = useState(1);

  const { data: posts, isLoading, refetch } = trpc.blog.adminList.useQuery();

  const createMutation = trpc.blog.create.useMutation({
    onSuccess: () => {
      toast.success("Artikkel opprettet!");
      resetForm();
      setIsDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Kunne ikke opprette artikkel");
    },
  });

  const updateMutation = trpc.blog.update.useMutation({
    onSuccess: () => {
      toast.success("Artikkel oppdatert!");
      resetForm();
      setIsDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Kunne ikke oppdatere artikkel");
    },
  });

  const deleteMutation = trpc.blog.delete.useMutation({
    onSuccess: () => {
      toast.success("Artikkel slettet!");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Kunne ikke slette artikkel");
    },
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

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Ingen tilgang</CardTitle>
            <CardDescription>Du har ikke tilgang til denne siden.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/dashboard")}>Tilbake til Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const resetForm = () => {
    setTitle("");
    setSlug("");
    setExcerpt("");
    setContent("");
    setCategory("tips");
    setTags("");
    setAuthorName("");
    setReadingTime(5);
    setImageUrl("");
    setPublished(1);
    setEditingPost(null);
  };

  const handleEdit = (post: any) => {
    setEditingPost(post);
    setTitle(post.title);
    setSlug(post.slug);
    setExcerpt(post.excerpt);
    setContent(post.content);
    setCategory(post.category);
    setTags(post.tags || "");
    setAuthorName(post.authorName);
    setReadingTime(post.readingTime);
    setImageUrl(post.imageUrl || "");
    setPublished(post.published);
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!title || !slug || !excerpt || !content || !authorName) {
      toast.error("Vennligst fyll ut alle obligatoriske felt");
      return;
    }

    if (editingPost) {
      updateMutation.mutate({
        id: editingPost.id,
        title,
        slug,
        excerpt,
        content,
        category,
        tags: tags || undefined,
        imageUrl: imageUrl || undefined,
        published,
      });
    } else {
      createMutation.mutate({
        title,
        slug,
        excerpt,
        content,
        category,
        tags,
        authorName,
        readingTime,
        imageUrl: imageUrl || undefined,
        published,
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Er du sikker på at du vil slette denne artikkelen?")) {
      deleteMutation.mutate({ id });
    }
  };

  const togglePublished = (post: any) => {
    updateMutation.mutate({
      id: post.id,
      published: post.published === 1 ? 0 : 1,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <main className="container py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Blogg Administrasjon</h1>
            <p className="text-muted-foreground">Administrer bloggartikler</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="mr-2 h-5 w-5" />
                Ny Artikkel
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPost ? "Rediger Artikkel" : "Ny Artikkel"}</DialogTitle>
                <DialogDescription>
                  Fyll ut skjemaet for å {editingPost ? "oppdatere" : "opprette"} en bloggartikkel
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Tittel *</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Artikkeltittel"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug *</Label>
                    <Input
                      id="slug"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="artikkel-slug"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="excerpt">Sammendrag *</Label>
                  <Input
                    id="excerpt"
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    placeholder="Kort beskrivelse av artikkelen"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Innhold * (Rich Text Editor)</Label>
                  <TipTapEditor
                    content={content}
                    onChange={setContent}
                    placeholder="Skriv artikkelen din her... Bruk verktøylinjen for formatering."
                  />
                  <p className="text-xs text-muted-foreground">
                    Tips: Bruk verktøylinjen for å formatere tekst, legge til overskrifter, lister, lenker og bilder.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Hovedbilde</Label>
                  <ImageUpload
                    value={imageUrl}
                    onChange={setImageUrl}
                    onRemove={() => setImageUrl("")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Last opp et hovedbilde for artikkelen. Maksimal størrelse: 5MB.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Kategori *</Label>
                    <Select value={category} onValueChange={(value: any) => setCategory(value)}>
                      <SelectTrigger id="category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tips">Tips</SelectItem>
                        <SelectItem value="guides">Guider</SelectItem>
                        <SelectItem value="news">Nyheter</SelectItem>
                        <SelectItem value="case-studies">Case Studies</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tags">Tags</Label>
                    <Input
                      id="tags"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="AI, LinkedIn, Markedsføring"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="authorName">Forfatter *</Label>
                    <Input
                      id="authorName"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      placeholder="Navn på forfatter"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="readingTime">Lesetid (min) *</Label>
                    <Input
                      id="readingTime"
                      type="number"
                      value={readingTime}
                      onChange={(e) => setReadingTime(Number(e.target.value))}
                      min="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="published">Status *</Label>
                    <Select value={String(published)} onValueChange={(value) => setPublished(Number(value))}>
                      <SelectTrigger id="published">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Publisert</SelectItem>
                        <SelectItem value="0">Utkast</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}>
                    Avbryt
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingPost ? "Oppdater" : "Opprett"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4"><div className="h-14 w-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div><p className="text-sm text-muted-foreground animate-pulse">Laster...</p></div>
          </div>
        ) : posts && posts.length > 0 ? (
          <div className="grid gap-4">
            {posts.map((post: any) => (
              <Card key={post.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {post.title}
                        {post.published === 0 && (
                          <span className="text-xs font-normal px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
                            Utkast
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {post.excerpt}
                      </CardDescription>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span>📁 {post.category}</span>
                        <span>👤 {post.authorName}</span>
                        <span>⏱️ {post.readingTime} min</span>
                        <span>📅 {new Date(post.createdAt).toLocaleDateString("no-NO")}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => togglePublished(post)}
                        title={post.published === 1 ? "Skjul" : "Publiser"}
                      >
                        {post.published === 1 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEdit(post)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDelete(post.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">Ingen artikler ennå</p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Opprett din første artikkel
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}