/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Lightbulb, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { SkeletonCard } from "@/components/SkeletonLoader";
import { Badge } from "@/components/ui/badge";

export interface TrendingTopicsSidebarProps {
  platform: "linkedin" | "twitter" | "facebook" | "instagram";
  onTopicSelected?: (topic: string) => void;
  expertise?: string;
  targetAudience?: string;
  contentStyle?: string;
}

export function TrendingTopicsSidebar({
  platform,
  onTopicSelected,
  expertise = "general",
  targetAudience = "general audience",
  contentStyle = "professional",
}: TrendingTopicsSidebarProps) {
  const [trendingKeywords, setTrendingKeywords] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);

  // Fetch trending topics
  const analyzeTrendsQuery = trpc.langchain.analyzeTrends.useQuery(
    {
      trends: trendingKeywords,
      platform,
      expertise,
      targetAudience,
      contentStyle,
    },
    {
      enabled: false, // Manual trigger only
    }
  );

  // Initial load
  useEffect(() => {
    if (!trendingKeywords) {
      handleRefreshTrends();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefreshTrends = async () => {
    setRefreshing(true);
    // Trending keywords relevant to Norwegian market
    const defaultTrends = [
      "AI i digital markedsføring",
      "Produktivitetsforbedring",
      "Digital transformasjon",
      "Innholdsstrategier",
      "Dataanalyse",
      "Kunstig intelligens",
      "Innholdsmarkedsføring",
      "Sosiale medier",
    ].join(", ");

    setTrendingKeywords(defaultTrends);

    try {
      // Refetch with new trends
      await analyzeTrendsQuery.refetch();
      toast.success("Trendende emner er oppdatert!");
    } catch (error: any) {
      toast.error(error.message || "Kunne ikke hente trendende emner");
    } finally {
      setRefreshing(false);
    }
  };

  const ideas = analyzeTrendsQuery.data?.ideas || [];

  return (
    <Card className="border-primary/20 h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>Trendende emner</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefreshTrends}
            disabled={refreshing || analyzeTrendsQuery.isLoading}
            className="h-8 w-8"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                refreshing || analyzeTrendsQuery.isLoading ? "animate-spin" : ""
              }`}
            />
          </Button>
        </div>
        <CardDescription>
          Innholdsideer inspirert av trendende emner
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Trending Keywords */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Trendende nøkkelord:</p>
          <div className="flex flex-wrap gap-1">
            {trendingKeywords
              .split(",")
              .slice(0, 5)
              .map((keyword, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {keyword.trim()}
                </Badge>
              ))}
          </div>
        </div>

        {/* Content Ideas */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Innholdsideer:</p>
          {analyzeTrendsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : ideas && ideas.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {ideas.slice(0, 5).map((idea: any, idx: number) => {
                // analyzeTrends returns objects { topic, contentIdeas }, not a
                // `title` string — rendering the raw object crashed React with
                // "Objects are not valid as a React child".
                const label =
                  typeof idea === "string"
                    ? idea
                    : idea?.topic || idea?.title || idea?.idea || "";
                return (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => onTopicSelected?.(label)}
                    className="w-full justify-start text-left h-auto py-2 px-2 whitespace-normal text-xs"
                  >
                    <Lightbulb className="h-3 w-3 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{label}</span>
                  </Button>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-4">
              Ingen ideer tilgjengelig for øyeblikket
            </div>
          )}
        </div>

        {/* Refresh Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshTrends}
          disabled={refreshing || analyzeTrendsQuery.isLoading}
          className="w-full"
        >
          {refreshing || analyzeTrendsQuery.isLoading ? (
            <>
              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
              Oppdaterer...
            </>
          ) : (
            <>
              <RefreshCw className="h-3 w-3 mr-2" />
              Oppdater ideer
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}