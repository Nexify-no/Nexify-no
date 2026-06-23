/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Eye, Heart, MessageCircle } from 'lucide-react';


interface TrendingMetric {
  keyword: string;
  engagement: number;
  reach: number;
  conversions: number;
  trend: 'up' | 'down' | 'stable';
}

interface TrendingAnalyticsWidgetProps {
  isLoading?: boolean;
  metrics?: TrendingMetric[];
}

export function TrendingAnalyticsWidget({
  isLoading = false,
  metrics = [
    { keyword: 'AI Content', engagement: 8.5, reach: 12400, conversions: 340, trend: 'up' },
    { keyword: 'Digital Marketing', engagement: 6.2, reach: 9800, conversions: 280, trend: 'up' },
    { keyword: 'Social Media', engagement: 5.8, reach: 8200, conversions: 210, trend: 'stable' },
  ],
}: TrendingAnalyticsWidgetProps) {
  if (isLoading) {
    return <div className="h-80 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />;
  }

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
          <TrendingUp className="w-5 h-5" />
          Trending Topics Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {metrics.map((metric, index) => (
            <div
              key={index}
              className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-blue-100 dark:border-blue-800"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                    {metric.keyword}
                  </h4>
                  <div className="flex gap-3 mt-2 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      Engagement: {metric.engagement}%
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Reach: {metric.reach.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    metric.trend === 'up'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : metric.trend === 'down'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                  }`}
                >
                  {metric.trend === 'up' ? '📈' : metric.trend === 'down' ? '📉' : '➡️'}{' '}
                  {metric.trend}
                </div>
              </div>

              {/* Metrics Bar */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded">
                  <div className="flex items-center gap-1 mb-1">
                    <Eye className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs text-slate-600 dark:text-slate-300">Reach</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {(metric.reach / 1000).toFixed(1)}K
                  </p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded">
                  <div className="flex items-center gap-1 mb-1">
                    <Heart className="w-3 h-3 text-red-600 dark:text-red-400" />
                    <span className="text-xs text-slate-600 dark:text-slate-300">Engagement</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {metric.engagement}%
                  </p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded">
                  <div className="flex items-center gap-1 mb-1">
                    <MessageCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                    <span className="text-xs text-slate-600 dark:text-slate-300">Conversions</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {metric.conversions}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}