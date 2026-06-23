/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Lightbulb,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Trash2,
  Edit,
  ArrowRight,
  Archive,
  Sparkles,
  Clock,
  CheckCircle,
  Linkedin,
  Twitter,
  Instagram,
  Facebook,
  TrendingUp,
  Mic,
  Users,
} from "lucide-react";

type StatusFilter = "all" | "new" | "in_progress" | "used" | "archived";

const platformIcons: Record<string, React.ReactNode> = {
  linkedin: <Linkedin className="h-4 w-4 text-blue-600" />,
  twitter: <Twitter className="h-4 w-4 text-sky-500" />,
  instagram: <Instagram className="h-4 w-4 text-pink-500" />,
  facebook: <Facebook className="h-4 w-4 text-blue-500" />,
};

const sourceIcons: Record<string, React.ReactNode> = {
  manual: <Edit className="h-3 w-3" />,
  voice: <Mic className="h-3 w-3" />,
  trend: <TrendingUp className="h-3 w-3" />,
  competitor: <Users className="h-3 w-3" />,
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  new: { label: "Ny", color: "bg-emerald-500", icon: <Sparkles className="h-3 w-3" /> },
  in_progress: { label: "Under arbeid", color: "bg-amber-500", icon: <Clock className="h-3 w-3" /> },
  used: { label: "Brukt", color: "bg-blue-500", icon: <CheckCircle className="h-3 w-3" /> },
  archived: { label: "Arkivert", color: "bg-gray-500", icon: <Archive className="h-3 w-3" /> },
};

export default function IdeaBank() {
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<{ id: number; ideaText: string; platform: string | null; tags: string[] } | null>(null);
  
  // Form state
  const [newIdeaText, setNewIdeaText] = useState("");
  const [newIdeaPlatform, setNewIdeaPlatform] = useState<string>("");
  const [newIdeaTags, setNewIdeaTags] = useState("");

  const { data: me } = trpc.auth.me.useQuery();
  const { data: subscription } = trpc.user.getSubscription.useQuery(undefined, {
    enabled: !!me,
  });
  const { data: ideas, isLoading, refetch } = trpc.ideas.list.useQuery(
    { status: statusFilter, search: searchQuery || undefined },
    { enabled: !!me }
  );
  const { data: stats } = trpc.ideas.getStats.useQuery(undefined, { enabled: !!me });

  const createIdea = trpc.ideas.create.useMutation({
    onSuccess: () => {
      refetch();
      setIsAddDialogOpen(false);
      setNewIdeaText("");
      setNewIdeaPlatform("");
      setNewIdeaTags("");
    },
  });

  const updateIdea = trpc.ideas.update.useMutation({
    onSuccess: () => {
      refetch();
      setIsEditDialogOpen(false);
      setEditingIdea(null);
    },
  });

  const deleteIdea = trpc.ideas.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const convertToPost = trpc.ideas.convertToPost.useMutation({
    onSuccess: (data) => {
      if (data.idea) {
        // Navigate to generate page with idea pre-filled
        const params = new URLSearchParams();
        params.set("idea", data.idea.ideaText);
        params.set("ideaId", data.idea.id.toString());
        if (data.idea.platform) {
          params.set("platform", data.idea.platform);
        }
        setLocation(`/generate?${params.toString()}`);
      }
    },
  });

  const isPro = subscription?.status === "active";

  const handleAddIdea = () => {
    if (!newIdeaText.trim()) return;
    
    const tags = newIdeaTags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    createIdea.mutate({
      ideaText: newIdeaText,
      platform: newIdeaPlatform as "linkedin" | "twitter" | "instagram" | "facebook" | undefined,
      tags: tags.length > 0 ? tags : undefined,
    });
  };

  const handleUpdateIdea = () => {
    if (!editingIdea || !editingIdea.ideaText.trim()) return;
    
    updateIdea.mutate({
      id: editingIdea.id,
      ideaText: editingIdea.ideaText,
      platform: editingIdea.platform as "linkedin" | "twitter" | "instagram" | "facebook" | null,
      tags: editingIdea.tags,
    });
  };

  const handleArchive = (id: number) => {
    updateIdea.mutate({ id, status: "archived" });
  };

  const handleRestore = (id: number) => {
    updateIdea.mutate({ id, status: "new" });
  };

  if (!me) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-14 w-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
            <Lightbulb className="h-6 w-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Laster idébanken...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
              <Lightbulb className="h-6 w-6 text-white" />
            </div>
            Idé-Bank
          </h1>
          <p className="text-muted-foreground mt-2">
            Lagre ideer raskt og konverter dem til innlegg når du er klar
          </p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700">
              <Plus className="h-4 w-4 mr-2" />
              Ny idé
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                Legg til ny idé
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Idé *</label>
                <Textarea
                  placeholder="Skriv din idé her... F.eks. 'Skrive om hvordan AI endrer markedsføring'"
                  value={newIdeaText}
                  onChange={(e) => setNewIdeaText(e.target.value)}
                  rows={4}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Plattform (valgfritt)</label>
                <Select value={newIdeaPlatform} onValueChange={setNewIdeaPlatform}>
                  <SelectTrigger>
                    <SelectValue placeholder="Velg plattform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="twitter">Twitter/X</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Tags (valgfritt)</label>
                <Input
                  placeholder="markedsføring, AI, tips (kommaseparert)"
                  value={newIdeaTags}
                  onChange={(e) => setNewIdeaTags(e.target.value)}
                />
              </div>
              <Button
                onClick={handleAddIdea}
                disabled={!newIdeaText.trim() || createIdea.isPending}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600"
              >
                {createIdea.isPending ? "Lagrer..." : "Lagre idé"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats?.total || 0}</p>
            <p className="text-xs text-muted-foreground">Totalt</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats?.new || 0}</p>
            <p className="text-xs text-muted-foreground">Nye</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats?.inProgress || 0}</p>
            <p className="text-xs text-muted-foreground">Under arbeid</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats?.used || 0}</p>
            <p className="text-xs text-muted-foreground">Brukt</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-600">{stats?.archived || 0}</p>
            <p className="text-xs text-muted-foreground">Arkivert</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søk i ideer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-full md:w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filtrer status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle ideer</SelectItem>
            <SelectItem value="new">Nye</SelectItem>
            <SelectItem value="in_progress">Under arbeid</SelectItem>
            <SelectItem value="used">Brukt</SelectItem>
            <SelectItem value="archived">Arkivert</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Ideas List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : ideas && ideas.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ideas.map((idea) => {
            const status = statusConfig[idea.status];
            const tags = idea.tags ? (() => { try { return JSON.parse(idea.tags!); } catch { return []; } })() : [];
            
            return (
              <Card key={idea.id} className="group hover:shadow-lg transition-all duration-300 border-l-4" style={{ borderLeftColor: status.color.replace("bg-", "") }}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`${status.color} text-white text-xs`}>
                        {status.icon}
                        <span className="ml-1">{status.label}</span>
                      </Badge>
                      {idea.platform && platformIcons[idea.platform]}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setEditingIdea({
                            id: idea.id,
                            ideaText: idea.ideaText,
                            platform: idea.platform,
                            tags: tags,
                          });
                          setIsEditDialogOpen(true);
                        }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Rediger
                        </DropdownMenuItem>
                        {idea.status !== "archived" ? (
                          <DropdownMenuItem onClick={() => handleArchive(idea.id)}>
                            <Archive className="h-4 w-4 mr-2" />
                            Arkiver
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleRestore(idea.id)}>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Gjenopprett
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => deleteIdea.mutate({ id: idea.id })}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Slett
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <p className="text-sm mb-4 line-clamp-3">{idea.ideaText}</p>

                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {tags.slice(0, 3).map((tag: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {sourceIcons[idea.source]}
                      <span>
                        {new Date(idea.createdAt).toLocaleDateString("nb-NO", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>

                    {idea.status !== "used" && idea.status !== "archived" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => convertToPost.mutate({ id: idea.id })}
                        disabled={convertToPost.isPending}
                        className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      >
                        <ArrowRight className="h-4 w-4 mr-1" />
                        Lag innlegg
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20 flex items-center justify-center mb-4">
              <Lightbulb className="h-8 w-8 text-amber-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Ingen ideer ennå</h3>
            <p className="text-muted-foreground mb-4">
              Begynn å lagre ideene dine for å aldri gå tom for innhold!
            </p>
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="bg-gradient-to-r from-amber-500 to-orange-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Legg til første idé
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-amber-500" />
              Rediger idé
            </DialogTitle>
          </DialogHeader>
          {editingIdea && (
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Idé *</label>
                <Textarea
                  value={editingIdea.ideaText}
                  onChange={(e) => setEditingIdea({ ...editingIdea, ideaText: e.target.value })}
                  rows={4}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Plattform</label>
                <Select
                  value={editingIdea.platform || ""}
                  onValueChange={(v) => setEditingIdea({ ...editingIdea, platform: v || null })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Velg plattform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="twitter">Twitter/X</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Tags</label>
                <Input
                  placeholder="markedsføring, AI, tips (kommaseparert)"
                  value={editingIdea.tags.join(", ")}
                  onChange={(e) => setEditingIdea({
                    ...editingIdea,
                    tags: e.target.value.split(",").map(t => t.trim()).filter(t => t.length > 0)
                  })}
                />
              </div>
              <Button
                onClick={handleUpdateIdea}
                disabled={!editingIdea.ideaText.trim() || updateIdea.isPending}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600"
              >
                {updateIdea.isPending ? "Lagrer..." : "Lagre endringer"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pro Feature Note */}
      {!isPro && (
        <Card className="mt-8 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-200 dark:border-purple-800">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-gradient-to-br from-purple-500 to-pink-500">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Oppgrader til Pro</h3>
                <p className="text-sm text-muted-foreground">
                  Få ubegrenset lagring av ideer og avanserte funksjoner
                </p>
              </div>
              <Button
                onClick={() => setLocation("/settings")}
                className="bg-gradient-to-r from-purple-500 to-pink-500"
              >
                Oppgrader
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}