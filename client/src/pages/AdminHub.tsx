/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  BarChart3,
  Settings,
  Shield,
  MessageSquare,
  TrendingUp,
  CreditCard,
  AlertCircle,
  Zap,
  Clock,
  Activity,
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
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect if not admin
  useEffect(() => {
    if (user && (user as any).role !== "admin") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  // TODO: Fetch real admin statistics from trpc.admin.getStats when available

  // Admin statistics (static for now)
  const displayStats = {
    totalUsers: 0,
    openTickets: 0,
    activeSessions: 0,
    totalRevenue: 0,
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
    {
      id: "security",
      title: "Security Settings",
      description: "Manage security policies and access",
      icon: <Shield className="w-6 h-6" />,
      path: "/admin/security",
      color: "bg-red-50 border-red-200",
      badge: "Secure",
      badgeColor: "bg-red-100 text-red-800",
    },
    {
      id: "payments",
      title: "Payment Management",
      description: "View payments and billing information",
      icon: <CreditCard className="w-6 h-6" />,
      path: "/admin/payments",
      color: "bg-emerald-50 border-emerald-200",
      badge: displayStats.totalRevenue ? `$${displayStats.totalRevenue}` : "0",
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

  if (!user || (user as any).role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-gray-600 mt-2">You don't have permission to access this page</p>
        </div>
      </div>
    );
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
                  <p className="text-sm text-gray-600">Active Sessions</p>
                  <p className="text-3xl font-bold mt-1">{displayStats.activeSessions || 0}</p>
                </div>
                <Activity className="w-8 h-8 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-3xl font-bold mt-1">${displayStats.totalRevenue || 0}</p>
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
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">New user registered</span>
                  <span className="text-xs text-gray-500">2 hours ago</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Support ticket created</span>
                  <span className="text-xs text-gray-500">4 hours ago</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Payment received</span>
                  <span className="text-xs text-gray-500">1 day ago</span>
                </div>
                <Button variant="outline" className="w-full mt-3">
                  View All Activity
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
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">API Status</span>
                  <Badge className="bg-green-100 text-green-800">Operational</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Database</span>
                  <Badge className="bg-green-100 text-green-800">Healthy</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Cache</span>
                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                </div>
                <Button variant="outline" className="w-full mt-3">
                  View Monitoring
                </Button>
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