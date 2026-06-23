/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState } from "react";
import { AlertCircle, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface OAuthWarningDialogProps {
  platform: "linkedin" | "twitter" | "instagram" | "facebook";
  language: "no" | "en";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

const platformDetails = {
  linkedin: {
    no: {
      title: "Koble til LinkedIn",
      description: "Du blir sendt til LinkedIn for å autorisere tilkoblingen",
      permissions: [
        "Publisere innlegg på vegne av deg",
        "Lese din profilinfo",
        "Få tilgang til ditt nettverk",
      ],
      note: "Vi lagrer IKKE ditt passord. LinkedIn håndterer autentiseringen sikkert.",
    },
    en: {
      title: "Connect to LinkedIn",
      description: "You will be sent to LinkedIn to authorize the connection",
      permissions: [
        "Post on your behalf",
        "Read your profile information",
        "Access your network",
      ],
      note: "We do NOT store your password. LinkedIn handles authentication securely.",
    },
  },
  twitter: {
    no: {
      title: "Koble til Twitter/X",
      description: "Du blir sendt til Twitter for å autorisere tilkoblingen",
      permissions: [
        "Publisere tweets på vegne av deg",
        "Lese dine tweets",
        "Få tilgang til dine følgere",
      ],
      note: "Vi lagrer IKKE ditt passord. Twitter håndterer autentiseringen sikkert.",
    },
    en: {
      title: "Connect to Twitter/X",
      description: "You will be sent to Twitter to authorize the connection",
      permissions: [
        "Post tweets on your behalf",
        "Read your tweets",
        "Access your followers",
      ],
      note: "We do NOT store your password. Twitter handles authentication securely.",
    },
  },
  instagram: {
    no: {
      title: "Koble til Instagram",
      description: "Du blir sendt til Instagram for å autorisere tilkoblingen",
      permissions: [
        "Publisere innlegg på vegne av deg",
        "Lese dine innlegg",
        "Få tilgang til dine følgere",
      ],
      note: "Vi lagrer IKKE ditt passord. Instagram håndterer autentiseringen sikkert.",
    },
    en: {
      title: "Connect to Instagram",
      description: "You will be sent to Instagram to authorize the connection",
      permissions: [
        "Post on your behalf",
        "Read your posts",
        "Access your followers",
      ],
      note: "We do NOT store your password. Instagram handles authentication securely.",
    },
  },
  facebook: {
    no: {
      title: "Koble til Facebook",
      description: "Du blir sendt til Facebook for å autorisere tilkoblingen",
      permissions: [
        "Publisere innlegg på vegne av deg",
        "Lese dine innlegg",
        "Få tilgang til dine venner",
      ],
      note: "Vi lagrer IKKE ditt passord. Facebook håndterer autentiseringen sikkert.",
    },
    en: {
      title: "Connect to Facebook",
      description: "You will be sent to Facebook to authorize the connection",
      permissions: [
        "Post on your behalf",
        "Read your posts",
        "Access your friends",
      ],
      note: "We do NOT store your password. Facebook handles authentication securely.",
    },
  },
};

export function OAuthWarningDialog({
  platform,
  language,
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: OAuthWarningDialogProps) {
  const [understood, setUnderstood] = useState(false);
  const details = platformDetails[platform][language];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            {details.title}
          </DialogTitle>
          <DialogDescription>{details.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Security Notice */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100 font-semibold mb-2">
              🔒 {language === "no" ? "Sikkerhetsinformasjon" : "Security Information"}
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200">{details.note}</p>
          </div>

          {/* Permissions */}
          <div>
            <p className="font-semibold text-sm mb-3">
              {language === "no" ? "Vi vil få tilgang til:" : "We will have access to:"}
            </p>
            <ul className="space-y-2">
              {details.permissions.map((permission, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>{permission}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Control Notice */}
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4">
            <p className="text-sm text-green-900 dark:text-green-100">
              {language === "no"
                ? "✅ Du kan når som helst koble fra eller tilbakekalle tilgang i Innstillinger"
                : "✅ You can disconnect or revoke access anytime in Settings"}
            </p>
          </div>

          {/* Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="understand"
              checked={understood}
              onCheckedChange={(checked) => setUnderstood(checked as boolean)}
            />
            <Label htmlFor="understand" className="text-sm cursor-pointer">
              {language === "no"
                ? "Jeg forstår og godtar betingelsene"
                : "I understand and accept the terms"}
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {language === "no" ? "Avbryt" : "Cancel"}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!understood || isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                {language === "no" ? "Kobler til..." : "Connecting..."}
              </>
            ) : (
              <>
                {language === "no" ? "Koble til" : "Connect"}
                <ExternalLink className="h-4 w-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}