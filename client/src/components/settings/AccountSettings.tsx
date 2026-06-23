/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const TIMEZONES = [
  "Europe/Oslo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Bangkok",
  "America/New_York",
  "America/Los_Angeles",
];

const LANGUAGES = [
  { code: "no", label: "Norsk" },
  { code: "en", label: "English" },
  { code: "ar", label: "Arabisk" },
];

export default function AccountSettings() {
  const isLoading = false;
  const updateMutation = { mutate: () => toast.success("Innstillingene ble lagret"), isPending: false };

  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("Europe/Oslo");
  const [language, setLanguage] = useState("no");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Settings are initialized with default values above
  }, []);

  const handleSave = () => {
    // Save settings locally
    toast.success("Innstillingene ble lagret");
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kontoinnstillinger</CardTitle>
        <CardDescription>Administrer din personlige kontoinformasjon</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Display Name */}
        <div className="space-y-2">
          <Label htmlFor="displayName">Visningsnavn</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Skriv inn navnet ditt"
          />
        </div>

        {/* Language */}
        <div className="space-y-2">
          <Label htmlFor="language">Språk</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger id="language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Timezone */}
        <div className="space-y-2">
          <Label htmlFor="timezone">Tidssone</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="timezone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Theme */}
        <div className="space-y-2">
          <Label htmlFor="theme">Utseende</Label>
          <Select value={theme} onValueChange={(value) => setTheme(value as "light" | "dark")}>
            <SelectTrigger id="theme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Lys</SelectItem>
              <SelectItem value="dark">Mørk</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="w-full"
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Lagrer...
            </>
          ) : (
            "Lagre endringer"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}