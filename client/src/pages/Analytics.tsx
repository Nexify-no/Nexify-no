/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Breadcrumb } from "@/components/Breadcrumb";
import { SkeletonCard } from "@/components/SkeletonLoader";
import { PageHeader } from "@/components/PageHeader";
import { PAGE_DESCRIPTIONS } from "@/lib/pageDescriptions";
import { TrendingUp, BarChart3, Clock, Zap, Download } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export function Analytics() {
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [selectedPlatform, setSelectedPlatform] = useState<"linkedin" | "twitter" | "facebook" | "instagram" | "all">("all");

  // Fetch analytics data
  const summaryQuery = trpc.analytics.getSummary.useQuery({
    startDate,
    endDate,
  });

  const engagementMetricsQuery = trpc.analytics.getEngagementMetrics.useQuery({
    startDate,
    endDate,
    platform: selectedPlatform !== "all" ? selectedPlatform : undefined,
  });

  const platformPerformanceQuery = trpc.analytics.getPlatformPerformance.useQuery({
    startDate,
    endDate,
  });

  const bestPostingTimesQuery = trpc.analytics.getBestPostingTimes.useQuery({
    startDate,
    endDate,
    platform: selectedPlatform !== "all" ? selectedPlatform : undefined,
  });

  const engagementTrendQuery = trpc.analytics.getEngagementTrend.useQuery({
    startDate,
    endDate,
    platform: selectedPlatform !== "all" ? selectedPlatform : undefined,
  });

  const topPostsQuery = trpc.analytics.getTopPosts.useQuery({
    startDate,
    endDate,
    platform: selectedPlatform !== "all" ? selectedPlatform : undefined,
    limit: 10,
  });

  // Format data for charts
  const platformChartData = useMemo(() => {
    return platformPerformanceQuery.data?.platformData || [];
  }, [platformPerformanceQuery.data]);

  const trendChartData = useMemo(() => {
    return engagementTrendQuery.data?.trendData || [];
  }, [engagementTrendQuery.data]);

  const heatmapData = useMemo(() => {
    const data = bestPostingTimesQuery.data?.heatmapData || [];
    // Transform to grid format (7 days x 24 hours)
    const grid: any[] = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const point = data.find((d) => d.day === day && d.hour === hour);
        grid.push({
          day,
          hour,
          engagement: point?.engagement || 0,
          x: hour,
          y: day,
        });
      }
    }
    return grid;
  }, [bestPostingTimesQuery.data]);

  const isLoading =
    summaryQuery.isLoading ||
    engagementMetricsQuery.isLoading ||
    platformPerformanceQuery.isLoading ||
    bestPostingTimesQuery.isLoading ||
    engagementTrendQuery.isLoading;

  const handleExportPDF = () => {
    toast.info("PDF export coming soon!");
  };

  const handleExportCSV = () => {
    toast.info("CSV export coming soon!");
  };

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="flex items-start justify-between gap-6 px-4 py-8">
        <div className="flex-1">
          <PageHeader
            title="Analytics"
            description={PAGE_DESCRIPTIONS.analytics || "Track your content performance and engagement metrics"}
          />
        </div>

      </div>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Breadcrumb */}
        <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Analytics" }]} />

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Filter Analytics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <input
                  type="date"
                  value={startDate.toISOString().split("T")[0]}
                  onChange={(e) => setStartDate(new Date(e.target.value))}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <input
                  type="date"
                  value={endDate.toISOString().split("T")[0]}
                  onChange={(e) => setEndDate(new Date(e.target.value))}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Platform</label>
                <Select value={selectedPlatform} onValueChange={(value: any) => setSelectedPlatform(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Platforms</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="twitter">Twitter</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleExportPDF} variant="outline" size="sm" className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
                <Button onClick={handleExportCSV} variant="outline" size="sm" className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summaryQuery.data?.totalPosts || 0}</div>
                  <p className="text-xs text-muted-foreground">Published posts</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Engagement</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summaryQuery.data?.totalEngagement || 0}</div>
                  <p className="text-xs text-muted-foreground">Likes, comments, shares</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Impressions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{(summaryQuery.data?.totalImpressions || 0).toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Total views</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Avg Engagement</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summaryQuery.data?.averageEngagement || 0}</div>
                  <p className="text-xs text-muted-foreground">Per post</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summaryQuery.data?.engagementRate || 0}%</div>
                  <p className="text-xs text-muted-foreground">Engagement/Impressions</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Engagement Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Engagement Trend
              </CardTitle>
              <CardDescription>Engagement over time</CardDescription>
            </CardHeader>
            <CardContent>
              {engagementTrendQuery.isLoading ? (
                <SkeletonCard />
              ) : trendChartData.length > 0 ? (
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="engagement"
                        stroke="#3b82f6"
                        name="Engagement"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="impressions"
                        stroke="#10b981"
                        name="Impressions"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-300 text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Platform Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Platform Performance
              </CardTitle>
              <CardDescription>Engagement by platform</CardDescription>
            </CardHeader>
            <CardContent>
              {platformPerformanceQuery.isLoading ? (
                <SkeletonCard />
              ) : platformChartData.length > 0 ? (
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={platformChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="platform" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="totalEngagement" fill="#3b82f6" name="Total Engagement" />
                      <Bar dataKey="postCount" fill="#10b981" name="Posts" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-300 text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Best Posting Times */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Best Posting Times
            </CardTitle>
            <CardDescription>Heatmap of engagement by day and hour</CardDescription>
          </CardHeader>
          <CardContent>
            {bestPostingTimesQuery.isLoading ? (
              <SkeletonCard />
            ) : heatmapData.length > 0 ? (
              <div className="overflow-x-auto">
                <div className="inline-block">
                  <div className="flex gap-1 mb-2">
                    <div className="w-12" />
                    {Array.from({ length: 24 }).map((_, i) => (
                      <div key={i} className="w-8 text-center text-xs font-medium">
                        {i}
                      </div>
                    ))}
                  </div>
                  {Array.from({ length: 7 }).map((_, day) => (
                    <div key={day} className="flex gap-1 mb-1">
                      <div className="w-12 text-xs font-medium flex items-center">{dayLabels[day]}</div>
                      {Array.from({ length: 24 }).map((_, hour) => {
                        const point = heatmapData.find((d) => d.day === day && d.hour === hour);
                        const engagement = point?.engagement || 0;
                        const maxEngagement = Math.max(...heatmapData.map((d) => d.engagement || 0), 1);
                        const intensity = engagement / maxEngagement;
                        return (
                          <div
                            key={`${day}-${hour}`}
                            className="w-8 h-8 rounded border border-border"
                            style={{
                              backgroundColor: `rgba(59, 130, 246, ${intensity * 0.8})`,
                            }}
                            title={`Day ${day}, Hour ${hour}: ${engagement} engagement`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Posts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Top Performing Posts
            </CardTitle>
            <CardDescription>Your best performing content</CardDescription>
          </CardHeader>
          <CardContent>
            {topPostsQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : topPostsQuery.data?.topPosts && topPostsQuery.data.topPosts.length > 0 ? (
              <div className="space-y-2">
                {topPostsQuery.data.topPosts.map((post, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">Post #{post.postId}</p>
                      <p className="text-xs text-muted-foreground">
                        {post.platform} • Published at {post.hourOfDay}:00
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{post.engagement} engagement</p>
                      <p className="text-xs text-muted-foreground">{post.impressions} impressions</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                No posts available
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}