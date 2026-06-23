/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SkeletonCard } from "@/components/SkeletonLoader";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Users, Activity, TrendingUp, AlertCircle } from "lucide-react";
import { MemberDetailModal } from "@/components/MemberDetailModal";
import { MemberFilters, MemberFiltersState } from "@/components/MemberFilters";
import { BulkMemberActions } from "@/components/BulkMemberActions";
import { Checkbox } from "@/components/ui/checkbox";

export default function MemberMonitoring() {
  // All hooks MUST be called at the top level, before any conditional returns
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  useLocation();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [, setFilters] = useState<MemberFiltersState | null>(null);

  // Fetch members list - always called
  const { data: membersData, isLoading: membersLoading } = trpc.memberMonitoring.getMembersList.useQuery({
    page,
    limit,
    sortBy: "lastActive",
  });

  // Fetch consumption stats - always called
  const { data: statsData, isLoading: statsLoading } = trpc.memberMonitoring.getConsumptionStats.useQuery();

  // Check if user is admin
  const isAdmin = user?.role === "admin";

  // Now we can have conditional returns
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex flex-col items-center gap-4"><div className="h-14 w-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div><p className="text-sm text-muted-foreground animate-pulse">Laster...</p></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <main className="container py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Member Monitoring</h1>
            <p className="text-muted-foreground mt-2">Track member activity and consumption</p>
          </div>

          <Card className="mt-8 border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-6 w-6 text-red-600" />
                <div>
                  <p className="font-semibold text-red-900 dark:text-red-100">Access Denied</p>
                  <p className="text-sm text-red-800 dark:text-red-200">Only administrators can access this page.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <main className="container py-8">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <span className="text-foreground">Member Monitoring</span>
          </BreadcrumbItem>
        </Breadcrumb>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">Member Monitoring</h1>
          <p className="text-muted-foreground mt-2">Track member activity and resource consumption</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          {statsLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Members</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsData?.reduce((sum, stat) => sum + (stat.memberCount || 0), 0) || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Active members in system</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Posts Generated</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsData?.reduce((sum, stat) => sum + (stat.totalPosts || 0), 0) || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Across all members</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Posts/Member</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsData && statsData.length > 0
                      ? Math.round(
                          statsData.reduce((sum, stat) => sum + (stat.totalPosts || 0), 0) /
                            statsData.reduce((sum, stat) => sum + (stat.memberCount || 0), 0)
                        )
                      : 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Average consumption</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Filters */}
        <MemberFilters
          onFiltersChange={setFilters}
          onReset={() => setFilters(null)}
        />

        {/* Bulk Actions */}
        <BulkMemberActions
          selectedCount={selectedMembers.size}
          onSelectAll={(checked) => {
            if (checked && membersData?.members) {
              const newSelected = new Set(selectedMembers);
              membersData.members.forEach((m) => newSelected.add(m.id.toString()));
              setSelectedMembers(newSelected);
            } else {
              setSelectedMembers(new Set());
            }
          }}
          isAllSelected={selectedMembers.size === (membersData?.members.length || 0) && (membersData?.members.length || 0) > 0}
        />

        {/* Members Table */}
        <Card>
          <CardHeader>
            <CardTitle>Members List</CardTitle>
            <CardDescription>View and manage all members in the system</CardDescription>
          </CardHeader>
          <CardContent>
            {membersLoading ? (
              <div className="space-y-2">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium w-12">
                          <Checkbox
                            checked={selectedMembers.size === (membersData?.members.length || 0) && (membersData?.members.length || 0) > 0}
                            onCheckedChange={(checked) => {
                              if (checked && membersData?.members) {
                                const newSelected = new Set(selectedMembers);
                                membersData.members.forEach((m) => newSelected.add(m.id.toString()));
                                setSelectedMembers(newSelected);
                              } else {
                                setSelectedMembers(new Set());
                              }
                            }}
                          />
                        </th>
                        <th className="text-left py-3 px-4 font-medium">Name</th>
                        <th className="text-left py-3 px-4 font-medium">Email</th>
                        <th className="text-left py-3 px-4 font-medium">Joined</th>
                        <th className="text-left py-3 px-4 font-medium">Last Active</th>
                        <th className="text-left py-3 px-4 font-medium">Role</th>
                        <th className="text-left py-3 px-4 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {membersData?.members.map((member) => (
                        <tr key={member.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4 w-12">
                            <Checkbox
                              checked={selectedMembers.has(member.id.toString())}
                              onCheckedChange={(checked) => {
                                const newSelected = new Set(selectedMembers);
                                if (checked) {
                                  newSelected.add(member.id.toString());
                                } else {
                                  newSelected.delete(member.id.toString());
                                }
                                setSelectedMembers(newSelected);
                              }}
                            />
                          </td>
                          <td className="py-3 px-4">{member.name || "N/A"}</td>
                          <td className="py-3 px-4">{member.email}</td>
                          <td className="py-3 px-4">
                            {new Date(member.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            {new Date(member.lastSignedIn).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              member.role === "admin"
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
                            }`}>
                              {member.role}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedMemberId(member.id.toString());
                                setIsDetailModalOpen(true);
                              }}
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-muted-foreground">
                    Page {membersData?.page} of {membersData?.pages} ({membersData?.total} total members)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(Math.max(1, page - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === membersData?.pages}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-8 bg-blue-50 dark:bg-blue-950/20 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900 dark:text-blue-100">ℹ️ Member Monitoring Info</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
            <p>• Monitor member activity and resource consumption in real-time</p>
            <p>• Track posts generated, API usage, and subscription status</p>
            <p>• Identify inactive members and high-consumption accounts</p>
            <p>• Only administrators can access this monitoring dashboard</p>
          </CardContent>
        </Card>
        {/* Member Detail Modal */}
        {selectedMemberId && (
          <MemberDetailModal
            memberId={selectedMemberId}
            memberName={membersData?.members.find((m) => m.id.toString() === selectedMemberId)?.name || "Member"}
            isOpen={isDetailModalOpen}
            onClose={() => setIsDetailModalOpen(false)}
          />
        )}
      </main>
    </div>
  );
}