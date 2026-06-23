/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface UserEditModalProps {
  open: boolean;
  user: any | null;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { userId: string; name?: string; email?: string; role?: string }) => Promise<void>;
}

export function UserEditModal({ open, user, onOpenChange, onSave }: UserEditModalProps) {
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    role: user?.role || "user",
  });
  const [loading, setLoading] = useState(false);

  // Update form when user changes
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        role: user.role || "user",
      });
    }
    onOpenChange(newOpen);
  };

  const handleSave = async () => {
    if (!user) return;

    // Validation
    if (!formData.email.trim()) {
      toast.error("Email is required");
      return;
    }

    if (!formData.email.includes("@")) {
      toast.error("Invalid email format");
      return;
    }

    setLoading(true);
    try {
      await onSave({
        userId: user.id,
        name: formData.name || undefined,
        email: formData.email,
        role: formData.role,
      });
      handleOpenChange(false);
    } catch (error) {
      console.error("Error saving user:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user information and permissions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="User's full name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={loading}
            />
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={loading}
            />
          </div>

          {/* Role Field */}
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => setFormData({ ...formData, role: value })}
              disabled={loading}
            >
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Administrator</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* User ID (Read-only) */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">User ID</Label>
            <div className="px-3 py-2 bg-muted rounded text-sm font-mono text-muted-foreground">
              {user?.id}
            </div>
          </div>

          {/* Created Date (Read-only) */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Created</Label>
            <div className="px-3 py-2 bg-muted rounded text-sm text-muted-foreground">
              {user?.createdAt ? new Date(user.createdAt).toLocaleString() : "—"}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}