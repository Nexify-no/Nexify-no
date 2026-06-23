/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Mail, Shield, Ban } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface BulkMemberActionsProps {
  selectedCount: number;
  onSelectAll: (checked: boolean) => void;
  isAllSelected: boolean;
}

type ActionType = "notification" | "role" | "suspend" | null;

export function BulkMemberActions({
  selectedCount,
  onSelectAll,
  isAllSelected,
}: BulkMemberActionsProps) {
  const [actionType, setActionType] = useState<ActionType>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAction = async (type: ActionType) => {
    setActionType(type);
    setIsDialogOpen(true);
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      switch (actionType) {
        case "notification":
          if (!notificationMessage.trim()) {
            toast.error("Please enter a notification message");
            return;
          }
          // TODO: Call bulk notification API
          toast.success(`Notification sent to ${selectedCount} members`);
          break;

        case "role":
          // TODO: Call bulk role update API
          toast.success(`Updated role to ${newRole} for ${selectedCount} members`);
          break;

        case "suspend":
          // TODO: Call bulk suspend API
          toast.success(`Suspended ${selectedCount} members`);
          break;
      }

      setIsDialogOpen(false);
      setNotificationMessage("");
      setNewRole("user");
      setActionType(null);
    } catch (error) {
      toast.error("Failed to perform bulk action");
    } finally {
      setIsProcessing(false);
    }
  };

  if (selectedCount === 0) {
    return null;
  }

  return (
    <>
      <Card className="border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-900 dark:text-orange-100">
            <AlertTriangle className="h-5 w-5" />
            Bulk Actions ({selectedCount} selected)
          </CardTitle>
          <CardDescription>
            Perform actions on multiple members at once
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Select All Checkbox */}
          <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-900 rounded-lg border">
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={onSelectAll}
              id="select-all"
            />
            <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
              Select all members on this page
            </label>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              onClick={() => handleAction("notification")}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
              disabled={selectedCount === 0 || isProcessing}
            >
              <Mail className="h-4 w-4" />
              Send Notification
            </Button>

            <Button
              onClick={() => handleAction("role")}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
              disabled={selectedCount === 0 || isProcessing}
            >
              <Shield className="h-4 w-4" />
              Update Role
            </Button>

            <Button
              onClick={() => handleAction("suspend")}
              className="gap-2 bg-red-600 hover:bg-red-700"
              disabled={selectedCount === 0 || isProcessing}
            >
              <Ban className="h-4 w-4" />
              Suspend Accounts
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            ⚠️ These actions will be applied to all {selectedCount} selected members
          </p>
        </CardContent>
      </Card>

      {/* Action Dialogs */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "notification" && "Send Notification"}
              {actionType === "role" && "Update Member Roles"}
              {actionType === "suspend" && "Suspend Accounts"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "notification" && `Send a notification to ${selectedCount} members`}
              {actionType === "role" && `Update role for ${selectedCount} members`}
              {actionType === "suspend" && `Suspend ${selectedCount} member accounts`}
            </DialogDescription>
          </DialogHeader>

          {/* Notification Dialog */}
          {actionType === "notification" && (
            <div className="space-y-4">
              <Textarea
                placeholder="Enter your notification message..."
                value={notificationMessage}
                onChange={(e) => setNotificationMessage(e.target.value)}
                className="min-h-[120px]"
              />
              <p className="text-xs text-muted-foreground">
                This message will be sent to all {selectedCount} selected members
              </p>
            </div>
          )}

          {/* Role Update Dialog */}
          {actionType === "role" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">New Role</label>
                <Select value={newRole} onValueChange={(value: any) => setNewRole(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                All {selectedCount} selected members will be assigned the {newRole} role
              </p>
            </div>
          )}

          {/* Suspend Dialog */}
          {actionType === "suspend" && (
            <div className="space-y-4">
              <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                <p className="text-sm text-red-900 dark:text-red-100">
                  ⚠️ This action will suspend {selectedCount} member accounts. They will not be able to access the platform until reactivated.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Are you sure you want to proceed?
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isProcessing}
              className={
                actionType === "suspend"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }
            >
              {isProcessing ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}