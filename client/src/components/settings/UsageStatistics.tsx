/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  FileText,
  Target,
  Clock,
} from "lucide-react";

export default function UsageStatistics() {
  const { data: stats, isLoading } = trpc.user.getStatistics.useQuery();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const platformUsage = stats?.platformDistribution?.map((p) => ({
    name: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
    value: p.count,
    percentage: Math.round((p.count / (stats?.totalPosts || 1)) * 100),
  })) || [];

  const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b"];

  return (
    <div className="space-y-6">
      {/* Usage Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Innlegg denne måneden
                </p>
                <p className="text-3xl font-bold">{stats?.monthlyPosts || 0}</p>
                <p className="text-xs text-green-600 mt-1">av {stats?.subscription?.trialPostsLimit || 2}</p>
              </div>
              <FileText className="h-10 w-10 text-primary opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Totalt innlegg
                </p>
                <p className="text-3xl font-bold">{stats?.totalPosts || 0}</p>
                <p className="text-xs text-green-600 mt-1">alle tider</p>
              </div>
              <Target className="h-10 w-10 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Lagrede eksempler
                </p>
                <p className="text-3xl font-bold">{stats?.savedExamples || 0}</p>
                <p className="text-xs text-green-600 mt-1">favoritter</p>
              </div>
              <TrendingUp className="h-10 w-10 text-purple-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  AI Coach chatter
                </p>
                <p className="text-3xl font-bold">{stats?.aiCoachInteractions || 0}</p>
                <p className="text-xs text-green-600 mt-1">interaksjoner</p>
              </div>
              <Clock className="h-10 w-10 text-orange-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Month Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Denne månedens bruk</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Innlegg</span>
                <span className="text-sm text-muted-foreground">
                  {stats?.monthlyPosts || 0} / {stats?.subscription?.trialPostsLimit || 2}
                </span>
              </div>
              <Progress 
                value={(stats?.monthlyPosts || 0) / (stats?.subscription?.trialPostsLimit || 2) * 100} 
                className="h-2" 
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">AI Coach Chat</span>
                <span className="text-sm text-muted-foreground">
                  Ubegrenset
                </span>
              </div>
              <Badge className="bg-green-100 text-green-800">Aktiv</Badge>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Lagrede eksempler</span>
                <span className="text-sm text-muted-foreground">
                  Ubegrenset
                </span>
              </div>
              <Badge className="bg-green-100 text-green-800">Aktiv</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform Distribution */}
      {platformUsage.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Plattformfordeling</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {platformUsage.map((platform) => (
                  <div key={platform.name}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{platform.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {platform.value} ({platform.percentage}%)
                      </span>
                    </div>
                    <Progress value={platform.percentage} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Plattformfordeling (Pie)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={platformUsage}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name} ${percentage}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {platformUsage.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}