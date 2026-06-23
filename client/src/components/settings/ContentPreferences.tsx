/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ContentPreferences() {
  const isLoading = false;
  const updateMutation = { mutate: () => toast.success("Innholdsinnstillinger lagret"), isPending: false };

  const [defaultTone, setDefaultTone] = useState("professional");
  const [defaultPlatform, setDefaultPlatform] = useState("linkedin");
  const [contentLength, setContentLength] = useState<"short" | "medium" | "long">("medium");
  const [hashtagStyle, setHashtagStyle] = useState<"minimal" | "moderate" | "aggressive">("moderate");
  const [ctaStyle, setCtaStyle] = useState<"casual" | "professional" | "urgent">("professional");
  const [emojiUsage, setEmojiUsage] = useState<"none" | "minimal" | "moderate" | "heavy">("moderate");

  useEffect(() => {
    // Settings are initialized with default values above
  }, []);

  const handleSave = () => {
    toast.success("Innholdsinnstillinger lagret");
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
        <CardTitle>Innholdsinnstillinger</CardTitle>
        <CardDescription>Definer hvordan innholdet ditt skal genereres</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Default Tone */}
        <div className="space-y-2">
          <Label htmlFor="defaultTone">Standard tone</Label>
          <Select value={defaultTone} onValueChange={setDefaultTone}>
            <SelectTrigger id="defaultTone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="professional">Profesjonell</SelectItem>
              <SelectItem value="friendly">Vennlig</SelectItem>
              <SelectItem value="casual">Uformell</SelectItem>
              <SelectItem value="humorous">Humoristisk</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Default Platform */}
        <div className="space-y-2">
          <Label htmlFor="defaultPlatform">Standard plattform</Label>
          <Select value={defaultPlatform} onValueChange={setDefaultPlatform}>
            <SelectTrigger id="defaultPlatform">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
              <SelectItem value="twitter">Twitter</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content Length */}
        <div className="space-y-2">
          <Label htmlFor="contentLength">Innholdslengde</Label>
          <Select value={contentLength} onValueChange={(value: any) => setContentLength(value)}>
            <SelectTrigger id="contentLength">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="short">Kort (50-100 ord)</SelectItem>
              <SelectItem value="medium">Medium (100-200 ord)</SelectItem>
              <SelectItem value="long">Lang (200+ ord)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Hashtag Style */}
        <div className="space-y-2">
          <Label htmlFor="hashtagStyle">Hashtag-stil</Label>
          <Select value={hashtagStyle} onValueChange={(value: any) => setHashtagStyle(value)}>
            <SelectTrigger id="hashtagStyle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minimal">Få (1-3 hashtags)</SelectItem>
              <SelectItem value="moderate">Moderat (3-5 hashtags)</SelectItem>
              <SelectItem value="aggressive">Mange (5+ hashtags)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* CTA Style */}
        <div className="space-y-2">
          <Label htmlFor="ctaStyle">Handlingsoppfordring (CTA)</Label>
          <Select value={ctaStyle} onValueChange={(value: any) => setCtaStyle(value)}>
            <SelectTrigger id="ctaStyle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="casual">Uformell ("Del din mening")</SelectItem>
              <SelectItem value="professional">Profesjonell ("Vi setter pris på din tilbakemelding")</SelectItem>
              <SelectItem value="urgent">Presserende ("Ikke gå glipp av denne muligheten")</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Emoji Usage */}
        <div className="space-y-2">
          <Label htmlFor="emojiUsage">Emoji-bruk</Label>
          <Select value={emojiUsage} onValueChange={(value: any) => setEmojiUsage(value)}>
            <SelectTrigger id="emojiUsage">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ingen emojier</SelectItem>
              <SelectItem value="minimal">Få (1-2 emojier)</SelectItem>
              <SelectItem value="moderate">Moderat (2-4 emojier)</SelectItem>
              <SelectItem value="heavy">Mange (4+ emojier)</SelectItem>
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