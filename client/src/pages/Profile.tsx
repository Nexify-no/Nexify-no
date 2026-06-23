/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Camera, Loader2, Save, User, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";

export default function Profile() {
  const { user, loading: authLoading, isAuthenticated, refresh } = useAuth();
  const [name, setName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [avatarMime, setAvatarMime] = useState<"image/jpeg" | "image/png" | "image/webp" | "image/gif">("image/jpeg");
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize name from user data
  const [nameInitialized, setNameInitialized] = useState(false);
  if (user && !nameInitialized) {
    setName(user.name || "");
    setNameInitialized(true);
  }

  const updateProfileMutation = trpc.user.updateProfile.useMutation();
  const uploadAvatarMutation = trpc.user.uploadAvatar.useMutation();
  const utils = trpc.useUtils();

  // Redirect if not authenticated
  if (!authLoading && !isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Bildet er for stort. Maks 5MB.");
      return;
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast.error("Ugyldig filtype. Bruk JPEG, PNG, WebP eller GIF.");
      return;
    }

    setAvatarMime(file.type as typeof avatarMime);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setAvatarPreview(result);
      // Extract base64 data (remove data:image/...;base64, prefix)
      const base64 = result.split(",")[1];
      setAvatarBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      // Upload avatar if changed
      let newAvatarUrl: string | undefined;
      if (avatarBase64) {
        const result = await uploadAvatarMutation.mutateAsync({
          base64: avatarBase64,
          mimeType: avatarMime,
        });
        newAvatarUrl = result.url;
      }

      // Update profile name (and avatar URL if uploaded)
      const updateData: { name?: string; avatarUrl?: string | null } = {};
      if (name.trim() !== (user.name || "")) {
        updateData.name = name.trim();
      }
      if (newAvatarUrl) {
        updateData.avatarUrl = newAvatarUrl;
      }

      if (Object.keys(updateData).length > 0) {
        await updateProfileMutation.mutateAsync(updateData);
      }

      // Refresh user data
      await utils.auth.me.invalidate();
      await refresh();

      toast.success("Profilen er oppdatert!");
      setAvatarBase64(null);
      setAvatarPreview(null);
    } catch (err) {
      console.error("Failed to update profile:", err);
      toast.error("Kunne ikke oppdatere profilen. Prøv igjen.");
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const currentAvatarUrl = avatarPreview || user?.avatarUrl || null;
  const hasChanges =
    name.trim() !== (user?.name || "") || avatarBase64 !== null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back button */}
        <div>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
            <Link href="/settings">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Tilbake til innstillinger
            </Link>
          </Button>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Min profil</h1>
          <p className="text-muted-foreground mt-1">
            Oppdater navn og profilbilde
          </p>
        </div>

        {/* Profile Card */}
        <Card className="border-0 shadow-sm bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-base">Profilinformasjon</CardTitle>
            <CardDescription>
              Dette vises til andre brukere og i appen din
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar Section */}
            <div className="flex items-center gap-6">
              <div className="relative">
                <Avatar className="w-20 h-20 ring-2 ring-primary/20">
                  <AvatarImage src={currentAvatarUrl || undefined} alt={user?.name || "User"} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white text-xl font-semibold">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-white flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
                  title="Endre profilbilde"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
              <div>
                <p className="font-medium text-foreground">{user?.name || "Ingen navn"}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  Endre profilbilde
                </button>
              </div>
            </div>

            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Fullt navn
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ditt navn"
                  className="pl-9"
                  maxLength={100}
                />
              </div>
            </div>

            {/* Email (read-only) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">E-postadresse</Label>
              <Input
                value={user?.email || ""}
                readOnly
                disabled
                className="bg-muted/50 text-muted-foreground cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">
                E-postadressen kan ikke endres (styrt av Google-kontoen din)
              </p>
            </div>

            {/* Login Method */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Innloggingsmetode</Label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 border">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span className="text-sm text-muted-foreground">Google</span>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Lagrer...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Lagre endringer
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card className="border-0 shadow-sm bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-base">Kontoinformasjon</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Bruker-ID</span>
              <span className="text-sm font-mono text-foreground">#{user?.id}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Rolle</span>
              <span className="text-sm font-medium capitalize text-foreground">{user?.role}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">Opprettet</span>
              <span className="text-sm text-foreground">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("nb-NO") : "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}