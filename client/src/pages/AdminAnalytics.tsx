/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AdminGateScreen, useAdminGate } from "@/components/AdminGate";
import { Users, TrendingUp, DollarSign, Activity } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PAGE_DESCRIPTIONS } from "@/lib/pageDescriptions";

export default function AdminAnalytics() {
  const { state: gate, isAdmin, retry } = useAdminGate();
  const { data: stats, isLoading } = trpc.system.getAdminStats.useQuery(undefined, {
    enabled: isAdmin,
  });

  // This used to call `setLocation()` in the render body — a router state update
  // during render, which React warns about and which can loop with wouter.
  if (gate !== "ok") {
    return <AdminGateScreen state={gate} onRetry={retry} />;
  }

  if (isLoading) {
    return (
      <div className="container py-8">
        <PageHeader title="Admin Analytics" description={PAGE_DESCRIPTIONS.analytics} />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent className="animate-pulse">
                <div className="h-8 bg-muted rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Totalt Brukere",
      value: stats?.totalUsers || 0,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Pro Abonnenter",
      value: stats?.proSubscribers || 0,
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Månedlig Inntekt",
      value: `${stats?.monthlyRevenue || 0} NOK`,
      icon: DollarSign,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Innlegg Generert",
      value: stats?.totalPosts || 0,
      icon: Activity,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">📊 Admin Analytics</h1>
        <p className="text-muted-foreground">
          Oversikt over plattformens ytelse og brukerstatistikk
        </p>
      </div>

      {/* MRR is now computed from each subscription's own plan row. It used to
          charge every active subscription at the Pro price and could never detect
          yearly billing, so this figure was "active subscriptions × Pro price".
          Anything we cannot price is reported instead of being guessed at. */}
      {(stats?.unpricedSubscriptions ?? 0) > 0 && (
        <div className="mb-6 p-4 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-900 dark:bg-amber-950/20 dark:border-amber-900 dark:text-amber-100">
          {stats?.unpricedSubscriptions} aktive abonnement mangler plan eller pris, og er
          <strong> ikke</strong> regnet med i inntekten over.
        </div>
      )}

      {stats?.subscriptionsByTier && stats.subscriptionsByTier.length > 0 && (
        <Card className="mb-8">
          <CardHeader><CardTitle>Aktive abonnement per plan</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {stats.subscriptionsByTier.map((t) => (
                <div key={t.plan} className="px-4 py-2 rounded-lg border">
                  <span className="text-sm text-muted-foreground">{t.plan}</span>
                  <span className="ml-3 font-semibold">{t.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle>Nylige Abonnementer</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recentSubscriptions && stats.recentSubscriptions.length > 0 ? (
            <div className="space-y-4">
              {stats.recentSubscriptions.map((sub: any) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{sub.userName}</p>
                    <p className="text-sm text-muted-foreground">{sub.userEmail}</p>
                  </div>
                  <div className="text-right">
                    {/* The plan name. This column used to render
                        `subscriptions.status`, so every row said "active". */}
                    <p className="font-medium text-green-600">{sub.plan ?? "Uten plan"}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(sub.createdAt).toLocaleDateString("nb-NO")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Ingen abonnementer ennå
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}