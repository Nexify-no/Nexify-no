/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, LogIn, LogOut, Edit2, Trash2, Eye } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface ActivityLogProps {
  open: boolean;
  userId: string | null;
  userName?: string;
  onOpenChange: (open: boolean) => void;
}

export function ActivityLog({ open, userId, userName, onOpenChange }: ActivityLogProps) {
  const [page, setPage] = useState(1);

  const { data: activities, isLoading } = trpc.admin.getUserActivity.useQuery(
    { userId: userId || "", page, limit: 20 },
    { enabled: !!userId && open }
  );

  if (!userId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Activity Log</DialogTitle>
          <DialogDescription>
            Activity history for {userName || "user"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : activities && activities.data.length > 0 ? (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Activity Type</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.data.map((activity: any) => (
                    <TableRow key={activity.id}>
                      <TableCell className="font-medium text-sm">
                        {new Date(activity.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {activity.type === "login" && <LogIn className="h-4 w-4 text-green-600" />}
                          {activity.type === "logout" && <LogOut className="h-4 w-4 text-blue-600" />}
                          {activity.type === "edit" && <Edit2 className="h-4 w-4 text-orange-600" />}
                          {activity.type === "delete" && <Trash2 className="h-4 w-4 text-red-600" />}
                          {activity.type === "view" && <Eye className="h-4 w-4 text-purple-600" />}
                          <span className="capitalize text-sm">{activity.type}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {activity.description || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {activity.ipAddress || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={activity.success ? "default" : "destructive"}>
                          {activity.success ? "Success" : "Failed"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {activities.pagination.pages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <div className="text-sm text-muted-foreground">
                  Page {page} of {activities.pagination.pages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(activities.pagination.pages, page + 1))}
                  disabled={page === activities.pagination.pages}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No activity found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}