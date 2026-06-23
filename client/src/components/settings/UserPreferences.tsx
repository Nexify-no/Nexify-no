/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  Moon,
  Globe,
  Eye,
  Loader2,
} from "lucide-react";

export default function UserPreferences() {
  const { data: usagePreferences } = trpc.user.getUsagePreferences.useQuery();
  const updatePreferencesMutation = trpc.user.updateUsagePreferences.useMutation({
    onSuccess: () => {
      toast.success("Innstillinger lagret!");
    },
    onError: () => {
      toast.error("Kunne ikke lagre innstillinger");
    },
  });

  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    pushNotifications: false,
    weeklyDigest: true,
    newFeatures: true,
    theme: "light",
    language: "no",
    contentLength: "medium",
    tone: "professional",
    usagePreferences: "",
  });

  useEffect(() => {
    if (usagePreferences) {
      setPreferences((prev) => ({
        ...prev,
        usagePreferences: usagePreferences || "",
      }));
    }
  }, [usagePreferences]);

  const handleToggle = (key: keyof typeof preferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSelect = (key: keyof typeof preferences, value: string) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleTextChange = (value: string) => {
    setPreferences((prev) => ({
      ...prev,
      usagePreferences: value,
    }));
  };

  const handleSave = () => {
    updatePreferencesMutation.mutate({
      preferences: preferences.usagePreferences,
    });
  };

  return (
    <div className="space-y-6">
      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Varsler
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="text-base font-medium">E-postvarsler</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Motta e-post om viktige oppdateringer
              </p>
            </div>
            <Switch
              checked={preferences.emailNotifications}
              onCheckedChange={() => handleToggle("emailNotifications")}
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="text-base font-medium">Push-varsler</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Motta push-varsler på enheten din
              </p>
            </div>
            <Switch
              checked={preferences.pushNotifications}
              onCheckedChange={() => handleToggle("pushNotifications")}
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="text-base font-medium">Ukentlig sammendrag</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Motta ukentlig oppsummering av aktiviteten din
              </p>
            </div>
            <Switch
              checked={preferences.weeklyDigest}
              onCheckedChange={() => handleToggle("weeklyDigest")}
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="text-base font-medium">Nye funksjoner</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Bli varslet om nye funksjoner og forbedringer
              </p>
            </div>
            <Switch
              checked={preferences.newFeatures}
              onCheckedChange={() => handleToggle("newFeatures")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Display Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Visningsinnstillinger
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-base font-medium flex items-center gap-2">
              <Moon className="h-4 w-4" />
              Tema
            </Label>
            <Select value={preferences.theme} onValueChange={(value) => handleSelect("theme", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Lys</SelectItem>
                <SelectItem value="dark">Mørk</SelectItem>
                <SelectItem value="auto">Automatisk</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-base font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Språk
            </Label>
            <Select value={preferences.language} onValueChange={(value) => handleSelect("language", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">Norsk</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Content Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Innholdsinnstillinger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-base font-medium">Standard innholdslengde</Label>
            <Select value={preferences.contentLength} onValueChange={(value) => handleSelect("contentLength", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Kort (50-100 ord)</SelectItem>
                <SelectItem value="medium">Medium (100-200 ord)</SelectItem>
                <SelectItem value="long">Lang (200+ ord)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-base font-medium">Standard tone</Label>
            <Select value={preferences.tone} onValueChange={(value) => handleSelect("tone", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Profesjonell</SelectItem>
                <SelectItem value="casual">Uformell</SelectItem>
                <SelectItem value="friendly">Vennlig</SelectItem>
                <SelectItem value="humorous">Humoristisk</SelectItem>
                <SelectItem value="inspirational">Inspirerende</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Usage Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Hvordan ønsker du å bruke plattformen?</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Fortell oss hvordan du planlegger å bruke Innlegg. Dette hjelper oss å tilpasse anbefalingene dine.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="usage-preferences">Din brukshistorie</Label>
            <Textarea
              id="usage-preferences"
              placeholder="F.eks: Jeg er en markedsføringskonsulent som lager innlegg for LinkedIn og Twitter daglig. Jeg fokuserer på B2B-innhold og tankeledelse."
              value={preferences.usagePreferences}
              onChange={(e) => handleTextChange(e.target.value)}
              className="min-h-[120px]"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {preferences.usagePreferences.length}/1000 tegn
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Privacy & Data */}
      <Card>
        <CardHeader>
          <CardTitle>Personvern og data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border rounded-lg bg-blue-50">
            <p className="text-sm text-blue-900">
              Vi bruker dine data for å forbedre AI-modellen og gi deg bedre anbefalinger. Dine innlegg er aldri delt med tredjepart.
            </p>
          </div>

          <Button variant="outline" className="w-full">
            Last ned dine data
          </Button>

          <Button variant="outline" className="w-full text-red-600 hover:text-red-700">
            Slett all personlig data
          </Button>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex gap-2">
        <Button 
          className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
          onClick={handleSave}
          disabled={updatePreferencesMutation.isPending}
        >
          {updatePreferencesMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Lagre innstillinger
        </Button>
        <Button variant="outline">Avbryt</Button>
      </div>
    </div>
  );
}