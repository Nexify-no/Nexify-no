/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useEffect, useState } from "react";
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
  onSave: (data: { userId: string; name?: string; role?: string }) => Promise<void>;
}

export function UserEditModal({ open, user, onOpenChange, onSave }: UserEditModalProps) {
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    role: user?.role || "user",
  });
  const [loading, setLoading] = useState(false);

  /**
   * Load the selected user into the form whenever the dialog opens on them.
   *
   * This has to be an effect. The previous version seeded the form only inside
   * `handleOpenChange`, but the parent opens the dialog by setting its own state
   * (`setEditModalOpen(true)`) — `onOpenChange` never fires on the way IN. So the
   * form kept the values from the very first render, when `user` was still null:
   * `{ name: "", email: "", role: "user" }`.
   *
   * The consequence was not cosmetic. Opening this dialog on an ADMIN and pressing
   * Save submitted `role: "user"` — silently demoting them, with a success toast.
   * With no last-admin guard on the server, the only admin could lock themselves
   * out of the product in two clicks.
   */
  useEffect(() => {
    if (open && user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        role: user.role || "user",
      });
    }
  }, [open, user]);

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const handleSave = async () => {
    if (!user) return;

    if (!formData.name.trim()) {
      toast.error("Navn kan ikke være tomt");
      return;
    }

    setLoading(true);
    try {
      // Email is NOT sent. The server has no field for it, on purpose:
      // email/password login resolves the account by email, so an unverified
      // admin-side change would be an account-takeover primitive. The field
      // below is read-only for the same reason — collecting a value the save
      // silently drops, and then reporting success, is the exact bug this
      // dialog already had once.
      await onSave({
        userId: user.id,
        name: formData.name.trim(),
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

          {/* Email — shown, never editable here. */}
          <div className="space-y-2">
            <Label htmlFor="email">E-post</Label>
            <div className="px-3 py-2 bg-muted rounded text-sm text-muted-foreground">
              {user?.email || "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              E-post kan ikke endres herfra: den er selve påloggingsidentiteten for
              e-post/passord-kontoer. En endring må gå gjennom verifisering.
            </p>
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