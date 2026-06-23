/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 *
 * Shows REAL aggregated trends (Google Trends, NRK, Wikipedia, Reddit, Mastodon,
 * Social Media Today) — clickable to seed the topic field. No mock data.
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Loader2, RefreshCw, ArrowRight } from "lucide-react";
import { SkeletonCard } from "@/components/SkeletonLoader";
import { Badge } from "@/components/ui/badge";

export interface TrendingTopicsSidebarProps {
  platform: "linkedin" | "twitter" | "facebook" | "instagram";
  onTopicSelected?: (topic: string) => void;
  expertise?: string;
  targetAudience?: string;
  contentStyle?: string;
}

export function TrendingTopicsSidebar({ onTopicSelected }: TrendingTopicsSidebarProps) {
  const { data, isLoading, isFetching, refetch } = trpc.trends.getAggregatedTrends.useQuery(undefined, {
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const trends: any[] = ((data as any)?.data || []).slice(0, 8);

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
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 w-8"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <CardDescription>Ekte trender fra flere kilder — klikk for å bruke</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : trends.length > 0 ? (
          <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
            {trends.map((t, idx) => (
              <button
                key={idx}
                onClick={() => onTopicSelected?.(t.keyword)}
                className="group w-full text-left rounded-lg border p-2.5 hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium line-clamp-2">{t.keyword}</span>
                  <ArrowRight className="h-4 w-4 flex-shrink-0 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{t.source}</Badge>
                  {t.date && (
                    <span>{new Date(t.date).toLocaleDateString("no-NO", { day: "2-digit", month: "2-digit" })}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground text-center py-4">
            Ingen trender tilgjengelig akkurat nå.
          </div>
        )}

        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="w-full">
          {isFetching ? (
            <><Loader2 className="h-3 w-3 mr-2 animate-spin" />Oppdaterer...</>
          ) : (
            <><RefreshCw className="h-3 w-3 mr-2" />Oppdater trender</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
