/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Target, Plus, Trash2, ExternalLink, TrendingUp, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { PAGE_DESCRIPTIONS } from "@/lib/pageDescriptions";

export default function CompetitorRadar() {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<"linkedin" | "twitter" | "instagram" | "facebook">("linkedin");
  const [profileUrl, setProfileUrl] = useState("");


  const { data: competitors, refetch } = trpc.competitors.list.useQuery();
  const { data: subscription } = trpc.user.getSubscription.useQuery();

  const addMutation = trpc.competitors.add.useMutation({
    onSuccess: () => {
      toast.success("Konkurrent lagt til!");
      setName("");
      setProfileUrl("");

      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Kunne ikke legge til konkurrent");
    },
  });

  const toggleMutation = trpc.competitors.toggle.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const deleteMutation = trpc.competitors.delete.useMutation({
    onSuccess: () => {
      toast.success("Konkurrent slettet");
      refetch();
    },
  });

  const isPro = subscription?.status === "active";

  const handleAdd = () => {
    if (!name.trim() || !profileUrl.trim()) {
      toast.error("Fyll inn navn og profil-URL");
      return;
    }
    addMutation.mutate({ name, platform, profileUrl });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <main className="container py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
              <Target className="h-6 w-6 text-white" />
            </div>
            <div>
              <PageHeader title="Konkurrent-Radar" description={PAGE_DESCRIPTIONS.competitorRadar} />
              <p className="text-muted-foreground">
                Følg med på konkurrentenes innhold og strategi
              </p>
            </div>
          </div>

          {!isPro && (
            <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200 mb-6">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Target className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="font-medium text-red-800">Konkurrent-Radar krever Pro-abonnement</p>
                      <p className="text-sm text-red-700">Oppgrader for å følge med på konkurrentene dine</p>
                    </div>
                  </div>
                  <Button className="bg-gradient-to-r from-red-500 to-orange-500 hover:opacity-90">
                    Oppgrader nå
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Add Competitor Form */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Legg til konkurrent</CardTitle>
                <CardDescription>Spor konkurrentens aktivitet</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>Navn</Label>
                    <Input
                      placeholder="Konkurrent AS"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={!isPro || addMutation.isPending}
                    />
                  </div>

                  <div>
                    <Label>Plattform</Label>
                    <Select value={platform} onValueChange={(v: any) => setPlatform(v)} disabled={!isPro}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="linkedin">💼 LinkedIn</SelectItem>
                        <SelectItem value="twitter">🐦 Twitter</SelectItem>
                        <SelectItem value="instagram">📸 Instagram</SelectItem>
                        <SelectItem value="facebook">👥 Facebook</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Profil-URL</Label>
                    <Input
                      placeholder="https://linkedin.com/in/..."
                      value={profileUrl}
                      onChange={(e) => setProfileUrl(e.target.value)}
                      disabled={!isPro || addMutation.isPending}
                    />
                  </div>



                  <Button
                    onClick={handleAdd}
                    disabled={!isPro || addMutation.isPending}
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {addMutation.isPending ? "Legger til..." : "Legg til"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Competitors List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Dine konkurrenter ({competitors?.length || 0})</CardTitle>
                <CardDescription>Administrer hvem du følger med på</CardDescription>
              </CardHeader>
              <CardContent>
                {!competitors || competitors.length === 0 ? (
                  <div className="text-center py-12">
                    <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-2">Ingen konkurrenter lagt til ennå</p>
                    <p className="text-sm text-muted-foreground">Legg til konkurrenter for å følge med på deres aktivitet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {competitors.map((competitor: any) => (
                      <div
                        key={competitor.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium">{competitor.name}</h3>
                            <Badge variant={competitor.isActive ? "default" : "secondary"}>
                              {competitor.platform}
                            </Badge>
                            {!competitor.isActive && (
                              <Badge variant="outline">Pauset</Badge>
                            )}
                          </div>

                          <a
                            href={competitor.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                          >
                            Besøk profil <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleMutation.mutate({ id: competitor.id })}
                          >
                            {competitor.isActive ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Slett ${competitor.name}?`)) {
                                deleteMutation.mutate({ id: competitor.id });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Insights */}
            {competitors && competitors.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-base">📊 Innsikt</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                        <p className="text-sm font-medium text-blue-900">Mest aktive</p>
                      </div>
                      <p className="text-xs text-blue-700">Kommer snart: Automatisk sporing av innlegg</p>
                    </div>

                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="h-4 w-4 text-green-600" />
                        <p className="text-sm font-medium text-green-900">Beste innhold</p>
                      </div>
                      <p className="text-xs text-green-700">Kommer snart: Analyse av høyt engasjement</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}