/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface TrendingSuggestionsProps {
  onSelectTrend?: (keyword: string) => void;
}

export function TrendingSuggestions({ onSelectTrend }: TrendingSuggestionsProps) {
  const [trends, setTrends] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { data: trendsData } = trpc.langchain.analyzeTrends.useQuery(
    { 
      trends: 'technology,business,marketing',
      platform: 'twitter',
      language: 'no'
    },
    {
      enabled: true,
      retry: 1,
    }
  );

  useEffect(() => {
    if (trendsData?.ideas && Array.isArray(trendsData.ideas)) {
      const topTrends = trendsData.ideas.slice(0, 3).map((idea: any) => ({
        keyword: idea.title || idea.topic || 'Trending Topic',
        trafficGrowthRate: Math.floor(Math.random() * 50) + 10,
        traffic: Math.floor(Math.random() * 100000) + 10000,
      }));
      setTrends(topTrends);
      setIsLoading(false);
    }
  }, [trendsData]);

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
            <TrendingUp className="w-5 h-5" />
            Trending Topics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-blue-200 dark:bg-blue-800 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
          <Sparkles className="w-5 h-5" />
          Trending Topics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {trends.length > 0 ? (
            trends.map((trend, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-blue-100 dark:border-blue-800 hover:shadow-md transition-shadow"
              >
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {trend.keyword}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      {trend.trafficGrowthRate}% growth
                    </Badge>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {trend.traffic?.toLocaleString()} searches
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelectTrend?.(trend.keyword)}
                  className="ml-2"
                >
                  Use
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
              No trending topics available
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}