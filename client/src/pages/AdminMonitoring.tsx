/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, TrendingUp, AlertCircle, Activity } from "lucide-react";

interface SystemMetrics {
  totalRequests: number;
  totalAlerts: number;
  criticalAlerts: number;
  averageResponseTime: number;
  errorRate: number;
  uniqueUsers: number;
}

interface Alert {
  id?: string;
  userId: number;
  type: "high_usage" | "spike_detected" | "abuse_suspected" | "limit_exceeded";
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  timestamp: string;
  timeAgo?: string;
}

export default function AdminMonitoring() {
  const { user } = useAuth();
  const [, navigate] = useRouter() as any;
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    if (!user || (user as any).role !== "admin") {
    navigate("/");
    return;
  }   fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [user, navigate]);

  async function fetchData() {
    try {
      setLoading(true);

      // Fetch system metrics
      const metricsRes = await fetch("/api/admin/monitoring/system");
      if (!metricsRes.ok) throw new Error("Failed to fetch metrics");
      const metricsData = await metricsRes.json();
      setMetrics(metricsData);

      // Fetch alerts
      const alertsRes = await fetch("/api/admin/monitoring/alerts?limit=50");
      if (!alertsRes.ok) throw new Error("Failed to fetch alerts");
      const alertsData = await alertsRes.json();
      setAlerts(alertsData);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error("[AdminMonitoring] Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 border-red-300 text-red-900";
      case "high":
        return "bg-orange-100 border-orange-300 text-orange-900";
      case "medium":
        return "bg-yellow-100 border-yellow-300 text-yellow-900";
      default:
        return "bg-blue-100 border-blue-300 text-blue-900";
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "spike_detected":
        return <TrendingUp className="w-4 h-4" />;
      case "abuse_suspected":
        return <AlertTriangle className="w-4 h-4" />;
      case "limit_exceeded":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  if (!user || (user as any).role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Monitoring Dashboard</h1>
          <Button onClick={fetchData} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {error && (
          <Alert className="mb-6 border-red-300 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* System Metrics */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalRequests.toLocaleString()}</div>
                <p className="text-xs text-gray-500">Last 24 hours</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Unique Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.uniqueUsers}</div>
                <p className="text-xs text-gray-500">Active users</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Avg Response Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.averageResponseTime.toFixed(0)}ms</div>
                <p className="text-xs text-gray-500">Average</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Error Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.errorRate.toFixed(1)}%</div>
                <p className="text-xs text-gray-500">Failed requests</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalAlerts}</div>
                <p className="text-xs text-gray-500">All time</p>
              </CardContent>
            </Card>

            <Card className={metrics.criticalAlerts > 0 ? "border-red-300 bg-red-50" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Critical Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${metrics.criticalAlerts > 0 ? "text-red-600" : ""}`}>
                  {metrics.criticalAlerts}
                </div>
                <p className="text-xs text-gray-500">Urgent</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Alerts Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Recent Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No alerts</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold">Time</th>
                      <th className="text-left py-3 px-4 font-semibold">User ID</th>
                      <th className="text-left py-3 px-4 font-semibold">Type</th>
                      <th className="text-left py-3 px-4 font-semibold">Severity</th>
                      <th className="text-left py-3 px-4 font-semibold">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((alert, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-600">{alert.timeAgo || "Just now"}</td>
                        <td className="py-3 px-4 font-mono text-gray-700">{alert.userId}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {getAlertIcon(alert.type)}
                            <span className="capitalize">{alert.type.replace(/_/g, " ")}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${getSeverityColor(alert.severity)}`}
                          >
                            {alert.severity.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-700 max-w-md truncate">{alert.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}