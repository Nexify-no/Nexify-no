/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { 
  TrendingUp, 
  Flame, 
  Sparkles, 
  ArrowRight, 
  Search,
  RefreshCw,
  ExternalLink,
  Zap,
  Clock,
  Globe,
  Loader2
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { PAGE_DESCRIPTIONS } from "@/lib/pageDescriptions";

const _CATEGORIES = [
  { value: "all", label: "Alle kategorier" },
  { value: "tech", label: "🖥️ Teknologi" },
  { value: "business", label: "💼 Business" },
  { value: "marketing", label: "📣 Markedsføring" },
  { value: "leadership", label: "👔 Lederskap" },
  { value: "startup", label: "🚀 Startup" },
  { value: "work", label: "🏢 Arbeidsliv" },
  { value: "wellness", label: "🧘 Trivsel" }
];

const PLATFORMS = [
  { value: "all", label: "Alle plattformer" },
  { value: "linkedin", label: "💼 LinkedIn" },
  { value: "twitter", label: "🐦 Twitter/X" },
  { value: "instagram", label: "📸 Instagram" },
  { value: "facebook", label: "👥 Facebook" }
];

export default function Trends() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory] = useState("all");
  const [selectedPlatform, setSelectedPlatform] = useState("all");

  const { data: subscription } = trpc.user.getSubscription.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: trendsData, isLoading: trendsLoading, error: trendsError, refetch } = trpc.trends.getTrendingKeywords.useQuery({}, {
    enabled: isAuthenticated,
  });

  const isPro = subscription?.status === "active";

  // Parse Google Trends data
  const trendingTopics = useMemo(() => {
    if (!trendsData) return [];
    
    try {
      // New format: trendsData is an array of trends or has a data property
      const trends = Array.isArray(trendsData) ? trendsData : (trendsData.data || []);
      
      return trends.filter((trend: any) => trend).map((trend: any, index: number) => {
        const title = trend.keyword || trend.title || "Ukjent trend";
        const traffic = trend.traffic ? `${(trend.traffic / 1000).toFixed(0)}K+` : "N/A";
        const description = (trend.relatedKeywords && Array.isArray(trend.relatedKeywords)) ? trend.relatedKeywords.slice(0, 3).join(", ") : (trend.description || "Ingen beskrivelse tilgjengelig");
        
        // Calculate trend score from traffic and growth rate
        let trendScore = 70;
        if (trend.trafficGrowthRate >= 200) trendScore = 95;
        else if (trend.trafficGrowthRate >= 150) trendScore = 90;
        else if (trend.trafficGrowthRate >= 100) trendScore = 85;
        else if (trend.trafficGrowthRate >= 50) trendScore = 80;
        
        return {
          id: index + 1,
          title,
          description: `Relaterte emner: ${description}`,
          category: "all",
          source: "Google Trends",
          trendScore,
          traffic,
          growthRate: trend.trafficGrowthRate || 0,
          // A trending topic can inspire content on any platform — don't lock it to
          // two, or the Facebook/Instagram platform filter excludes every trend.
          suggestedPlatforms: ["linkedin", "twitter", "instagram", "facebook"],
          tags: (Array.isArray(trend.relatedKeywords) ? trend.relatedKeywords : []) || (Array.isArray(trend.tags) ? trend.tags : []) || [],
          activeTime: trend.activeTime,
        };
      });
    } catch (error) {
      console.error("Error parsing trends data:", error);
      return [];
    }
  }, [trendsData]);

  // Filter topics
  const filteredTopics = useMemo(() => trendingTopics.filter((topic: any) => {
    // Match if ANY word of the query appears in the title/description/tags, so a
    // multi-word search like "VM norge" still finds "vm i fotball" instead of 0.
    const q = searchQuery.trim().toLowerCase();
    const haystack = `${topic.title} ${topic.description} ${Array.isArray(topic.tags) ? topic.tags.join(" ") : ""}`.toLowerCase();
    const matchesSearch = q === "" || q.split(/\s+/).some((word) => word.length > 0 && haystack.includes(word));
    const matchesCategory = selectedCategory === "all" || topic.category === selectedCategory;
    const matchesPlatform = selectedPlatform === "all" || (Array.isArray(topic.suggestedPlatforms) && topic.suggestedPlatforms.includes(selectedPlatform));
    return matchesSearch && matchesCategory && matchesPlatform;
  }), [trendingTopics, searchQuery, selectedCategory, selectedPlatform]);

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
            <Flame className="h-6 w-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Laster trender...</p>
        </div>
      </div>
    );
  }

  const handleUseTopic = (topic: any) => {
    if (!isPro) {
      toast.error("Trend og Inspirasjon krever Pro-abonnement");
      return;
    }
    // Navigate to generate page with topic pre-filled
    const platform = Array.isArray(topic.suggestedPlatforms) && topic.suggestedPlatforms.length > 0 ? topic.suggestedPlatforms[0] : "linkedin";
    setLocation(`/generate?topic=${encodeURIComponent(topic.title)}&platform=${platform}`);
  };
  const handleRefresh = async () => {
    await refetch();
    toast.success("Oppdaterer trender...");
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-red-500";
    if (score >= 80) return "text-orange-500";
    if (score >= 70) return "text-yellow-500";
    return "text-green-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "🔥 Veldig populært";
    if (score >= 80) return "📈 Stigende";
    if (score >= 70) return "✨ Aktuelt";
    return "💡 Interessant";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <main className="container py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
              <Flame className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <PageHeader title="Trend og Inspirasjon" description={PAGE_DESCRIPTIONS.trends} />
              <p className="text-muted-foreground">
                Oppdag hva som trender akkurat nå i Norge og skap engasjerende innhold
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={trendsLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${trendsLoading ? 'animate-spin' : ''}`} />
              Oppdater
            </Button>
          </div>

          {!isPro && (
            <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 mb-6">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-800">Oppgrader til Pro for full tilgang</p>
                      <p className="text-sm text-amber-700">Se alle trender og bruk dem direkte i innholdsgenerering</p>
                    </div>
                  </div>
                  <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90">
                    Oppgrader nå
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Søk etter emner, tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <Globe className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Plattform" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(plat => (
                    <SelectItem key={plat.value} value={plat.value}>{plat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Aktive trender</p>
                  <p className="text-2xl font-bold">{trendsLoading ? '-' : filteredTopics.length}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Kilde</p>
                  <p className="text-2xl font-bold">Google Trends</p>
                </div>
                <Globe className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Oppdatert</p>
                  <p className="text-2xl font-bold">I dag</p>
                </div>
                <Clock className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Loading State */}
        {trendsLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">Henter trender fra Google...</p>
          </div>
        )}

        {/* Error State */}
        {trendsError && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 text-xl">⚠️</span>
                </div>
                <div>
                  <p className="font-medium text-red-800">Kunne ikke hente trender</p>
                  <p className="text-sm text-red-700">Prøv å oppdatere siden eller kom tilbake senere.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trending Topics Grid */}
        {!trendsLoading && !trendsError && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredTopics.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="pt-6 text-center space-y-4">
                  <p className="text-muted-foreground">
                    {searchQuery.trim()
                      ? `Ingen av dagens topp-trender matchet «${searchQuery.trim()}». Du kan lage innhold om det likevel:`
                      : "Ingen trender funnet akkurat nå. Prøv å oppdatere."}
                  </p>
                  {searchQuery.trim() && (
                    <Button onClick={() => setLocation(`/generate?topic=${encodeURIComponent(searchQuery.trim())}`)}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Lag innhold om «{searchQuery.trim()}»
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredTopics.map((topic: any) => (
                <Card key={topic.id} className="group hover:shadow-lg transition-all duration-300 hover:border-primary/50">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2 group-hover:text-primary transition-colors">
                          {topic.title}
                        </CardTitle>
                        <CardDescription className="line-clamp-2">
                          {topic.description}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="secondary" className={getScoreColor(topic.trendScore)}>
                          {getScoreLabel(topic.trendScore)}
                        </Badge>
                        {topic.traffic && (
                          <Badge variant="outline" className="text-xs">
                            {topic.traffic} søk
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Tags */}
                    {topic.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {topic.tags.slice(0, 4).map((tag: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardHeader>
                  
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Sparkles className="h-4 w-4" />
                        <span>{topic.source}</span>
                      </div>
                      
                      <div className="flex gap-2">
                        {topic.articles?.[0]?.url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(topic.articles[0].url, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Les mer
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => handleUseTopic(topic)}
                          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:opacity-90"
                        >
                          Bruk trend
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}