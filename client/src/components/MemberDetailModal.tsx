/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SkeletonCard } from "@/components/SkeletonLoader";
import { Zap, CreditCard, Shield } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface MemberDetailModalProps {
  memberId: string;
  memberName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function MemberDetailModal({
  memberId,
  memberName,
  isOpen,
  onClose,
}: MemberDetailModalProps) {
  const { data: consumptionData, isLoading } = trpc.memberMonitoring.getMemberConsumption.useQuery(
    { userId: memberId },
    { enabled: isOpen }
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Member Details: {memberName}
          </DialogTitle>
          <DialogDescription>
            View member usage statistics and subscription information
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : consumptionData ? (
          <div className="space-y-6">
            {/* Usage Statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Usage Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">API Usage</p>
                    <p className="text-lg font-semibold">{consumptionData.consumption.used}</p>
                    <div className="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{
                          width: `${consumptionData.consumption.percentageUsed}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {consumptionData.consumption.used} / {consumptionData.consumption.quota} quota
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Remaining Quota</p>
                    <p className="text-lg font-semibold">{consumptionData.consumption.remaining}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.round((consumptionData.consumption.remaining / consumptionData.consumption.quota) * 100)}% available
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Subscription Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Subscription
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge className={consumptionData.subscription.status === 'active' ? 'bg-green-600' : 'bg-gray-600'}>
                      {consumptionData.subscription.status.charAt(0).toUpperCase() + consumptionData.subscription.status.slice(1)}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">User Name</span>
                    <span className="font-medium">{consumptionData.user.name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Email</span>
                    <span className="font-medium text-sm">{consumptionData.user.email}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700">
                Send Notification
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}