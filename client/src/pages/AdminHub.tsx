/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { AdminGateScreen, useAdminGate } from "@/components/AdminGate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  BarChart3,
  Settings,

  MessageSquare,
  TrendingUp,
  CreditCard,
  Zap,
  Clock,
  Activity,
  Mail,
} from "lucide-react";

interface AdminFeature {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  badge?: string;
  badgeColor?: string;
}

export function AdminHub() {
  const { state: gate, isAdmin, retry } = useAdminGate();
  const [, setLocation] = useLocation();

  // Real numbers. These four cards were hardcoded zeros under a
  // `// TODO: Fetch real admin statistics from trpc.admin.getStats when available`
  // — and `admin.getStats` never existed. The data was one route away the whole
  // time: system.getAdminStats and support.getStats are both real queries.
  //
  // "Active sessions" is deliberately gone rather than shown as 0: nothing in
  // this product counts live sessions, so any number here would be invented.
  // Users active in the last 30 days is a real figure, so that is what it says.
  const { data: sysStats } = trpc.system.getAdminStats.useQuery(undefined, { enabled: isAdmin });
  const { data: userStats } = trpc.admin.getUserStats.useQuery(undefined, { enabled: isAdmin });
  const { data: ticketStats } = trpc.support.getStats.useQuery(undefined, { enabled: isAdmin });

  const displayStats = {
    totalUsers: sysStats?.totalUsers ?? 0,
    openTickets: ticketStats?.open ?? 0,
    activeUsers30d: userStats?.activeUsers ?? 0,
    monthlyRevenue: sysStats?.monthlyRevenue ?? 0,
  };

  const adminFeatures: AdminFeature[] = [
    {
      id: "users",
      title: "Users Management",
      description: "Manage users, roles, and permissions",
      icon: <Users className="w-6 h-6" />,
      path: "/admin/users",
      color: "bg-blue-50 border-blue-200",
      badge: displayStats.totalUsers?.toString() || "0",
      badgeColor: "bg-blue-100 text-blue-800",
    },
    {
      id: "dashboard",
      title: "Analytics Dashboard",
      description: "View platform statistics and metrics",
      icon: <BarChart3 className="w-6 h-6" />,
      path: "/admin/dashboard",
      color: "bg-purple-50 border-purple-200",
      badge: "Live",
      badgeColor: "bg-purple-100 text-purple-800",
    },
    {
      id: "support",
      title: "Support Tickets",
      description: "Manage customer support tickets",
      icon: <MessageSquare className="w-6 h-6" />,
      path: "/admin/support",
      color: "bg-green-50 border-green-200",
      badge: displayStats.openTickets?.toString() || "0",
      badgeColor: "bg-green-100 text-green-800",
    },
    {
      id: "monitoring",
      title: "System Monitoring",
      description: "Monitor system health and performance",
      icon: <Activity className="w-6 h-6" />,
      path: "/admin/monitoring",
      color: "bg-orange-50 border-orange-200",
      badge: "Active",
      badgeColor: "bg-orange-100 text-orange-800",
    },
    // The "Security Settings" (/admin/security) and "Payment Management"
    // (/admin/payments) tiles used to live here. Neither route is declared in
    // App.tsx, so both landed on the 404 page. A tile that goes nowhere is worse
    // than a missing tile — it reads as a feature that is broken rather than one
    // that was never built. Revenue and subscriptions live on /admin/analytics.
    {
      id: "revenue",
      title: "Inntekt og abonnement",
      description: "MRR, aktive abonnement per plan",
      icon: <CreditCard className="w-6 h-6" />,
      path: "/admin/analytics",
      color: "bg-emerald-50 border-emerald-200",
      badge: displayStats.monthlyRevenue ? `${displayStats.monthlyRevenue} kr/mnd` : "0 kr",
      badgeColor: "bg-emerald-100 text-emerald-800",
    },
    {
      id: "trends",
      title: "Trends & Analytics",
      description: "Track trending content and keywords",
      icon: <TrendingUp className="w-6 h-6" />,
      path: "/trends",
      color: "bg-indigo-50 border-indigo-200",
      badge: "New",
      badgeColor: "bg-indigo-100 text-indigo-800",
    },
    {
      id: "email",
      title: "E-post og maler",
      description: "Send til medlemmer, styr automatiske e-poster, rediger teksten",
      icon: <Mail className="w-6 h-6" />,
      path: "/admin/epost",
      color: "bg-blue-50 border-blue-200",
      badge: "E-post",
      badgeColor: "bg-blue-100 text-blue-800",
    },
    {
      id: "settings",
      title: "System Settings",
      description: "Configure system-wide settings",
      icon: <Settings className="w-6 h-6" />,
      path: "/settings",
      color: "bg-slate-50 border-slate-200",
      badge: "Config",
      badgeColor: "bg-slate-100 text-slate-800",
    },
  ];

  if (gate !== "ok") {
    return <AdminGateScreen state={gate} onRetry={retry} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">Admin Hub</h1>
          <p className="text-slate-600 mt-2">Welcome back! Manage all platform features from here.</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Users</p>
                  <p className="text-3xl font-bold mt-1">{displayStats.totalUsers || 0}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Open Tickets</p>
                  <p className="text-3xl font-bold mt-1">{displayStats.openTickets || 0}</p>
                </div>
                <MessageSquare className="w-8 h-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  {/* Not "Active Sessions" — nothing in this product counts live
                      sessions, so that card could only ever have shown a made-up
                      number. Users signed in within 30 days is real. */}
                  <p className="text-sm text-gray-600">Aktive brukere (30 d)</p>
                  <p className="text-3xl font-bold mt-1">{displayStats.activeUsers30d}</p>
                </div>
                <Activity className="w-8 h-8 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  {/* Kroner per month, not dollars total. The old card rendered
                      a hardcoded 0 with a $ in front of it. */}
                  <p className="text-sm text-gray-600">Inntekt per måned</p>
                  <p className="text-3xl font-bold mt-1">{displayStats.monthlyRevenue} kr</p>
                </div>
                <CreditCard className="w-8 h-8 text-emerald-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {adminFeatures.map((feature) => (
            <Card
              key={feature.id}
              className={`${feature.color} border-2 hover:shadow-lg transition-all cursor-pointer`}
              onClick={() => setLocation(feature.path)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {feature.description}
                    </CardDescription>
                  </div>
                  <div className="text-2xl opacity-70">{feature.icon}</div>
                </div>
              </CardHeader>
              <CardContent>
                {feature.badge && (
                  <Badge className={`${feature.badgeColor} text-xs`}>
                    {feature.badge}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* This was three hardcoded lines of JSX — "New user registered /
                  2 hours ago", "Payment received / 1 day ago" — that never
                  changed, for any deployment, ever. There is no platform-wide
                  activity feed behind it. Per-user activity IS real
                  (admin.getUserActivity), so point at that instead of inventing
                  a feed. */}
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Det finnes ingen plattformdekkende aktivitetsstrøm ennå. Aktivitet per bruker er
                  reell og ligger på brukersiden.
                </p>
                <Button
                  variant="outline"
                  className="w-full mt-3"
                  onClick={() => setLocation("/admin/users")}
                >
                  Åpne brukere
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* System Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* "Operational / Healthy / Active" were literal strings behind no
                  health check at all — they would have read green through a total
                  outage. The only honest signal available here is whether this
                  page's own queries came back, so that is what is shown. */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Database (denne siden)</span>
                  <Badge className={sysStats ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}>
                    {sysStats ? "Svarer" : "Laster …"}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500">
                  Ingen ekte helsesjekk er koblet til ennå. Statusen over sier bare om spørringene
                  på denne siden kom tilbake.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Help Section */}
        <Card className="mt-8 bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-800 mb-4">
              Access documentation, support resources, and admin guides to manage your platform effectively.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1">
                Documentation
              </Button>
              <Button variant="outline" className="flex-1">
                Support
              </Button>
              <Button variant="outline" className="flex-1">
                API Docs
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}