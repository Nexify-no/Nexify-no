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

/**
 * What connecting Meta actually grants — matched to the scopes the server asks
 * for in `META_SCOPES` (server/services/metaGraph.ts).
 *
 * This screen previously told the user we would "get access to your friends".
 * We never requested that, and never could: the scopes are pages_show_list,
 * pages_manage_posts, pages_read_engagement, business_management,
 * instagram_basic and instagram_content_publish. Overstating access is bad twice
 * over — it frightens users out of a permission grant they were right to give,
 * and Meta's App Review compares what an app's own UI claims against what it
 * requests, so a mismatch is a rejection reason.
 *
 * Keep this list honest against META_SCOPES. If a scope is added there, say so
 * here; if one is removed, remove it here.
 */
const META_PERMISSIONS_NO = [
  "Se hvilke Facebook-sider du er administrator for",
  "Publisere innlegg til siden du velger — og til Instagram-kontoen som er koblet til den",
  "Lese antall likerklikk og kommentarer på dine egne innlegg",
];

const META_PERMISSIONS_EN = [
  "See which Facebook Pages you administer",
  "Publish posts to the Page you choose — and to the Instagram account linked to it",
  "Read the likes and comments on your own posts",
];

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
  // Each line below maps to one scope in X_SCOPES (server/services/platformOAuthService.ts).
  // "Få tilgang til dine følgere" used to be here and was never requested — the
  // copy was written for a different platform and copied across. A consent
  // screen that overstates what it asks for scares users out of a grant they
  // were right to make, and it is a documented review-rejection reason.
  twitter: {
    no: {
      title: "Koble til X",
      description: "Du blir sendt til X for å autorisere tilkoblingen",
      permissions: [
        "Publisere innlegg på X på dine vegne — når du har trykket publiser",
        "Lese dine egne innlegg",
        "Se brukernavnet ditt, så du ser hvilken konto som er koblet til",
        "Holde tilkoblingen i live uten at du må logge inn på nytt",
      ],
      note: "Vi lagrer IKKE ditt passord. X håndterer autentiseringen, og du kan koble fra når som helst.",
    },
    en: {
      title: "Connect to X",
      description: "You will be sent to X to authorize the connection",
      permissions: [
        "Publish posts on X on your behalf — once you have pressed publish",
        "Read your own posts",
        "See your username, so you know which account is connected",
        "Keep the connection alive without you signing in again",
      ],
      note: "We do NOT store your password. X handles authentication, and you can disconnect at any time.",
    },
  },
  // Instagram and Facebook are ONE consent, because Meta makes them one: an
  // Instagram Professional account is reached through the Facebook Page it is
  // linked to. Both cards therefore describe the same six scopes.
  instagram: {
    no: {
      title: "Koble til Instagram via Facebook",
      description: "Du blir sendt til Facebook. Instagram-kontoen kobles til gjennom Facebook-siden den er knyttet til.",
      permissions: META_PERMISSIONS_NO,
      note: "Vi lagrer IKKE ditt passord. Facebook håndterer autentiseringen sikkert.",
    },
    en: {
      title: "Connect Instagram via Facebook",
      description: "You will be sent to Facebook. Your Instagram account is connected through the Facebook Page it is linked to.",
      permissions: META_PERMISSIONS_EN,
      note: "We do NOT store your password. Facebook handles authentication securely.",
    },
  },
  facebook: {
    no: {
      title: "Koble til Facebook",
      description: "Du blir sendt til Facebook for å autorisere tilkoblingen",
      permissions: META_PERMISSIONS_NO,
      note: "Vi lagrer IKKE ditt passord. Facebook håndterer autentiseringen sikkert.",
    },
    en: {
      title: "Connect to Facebook",
      description: "You will be sent to Facebook to authorize the connection",
      permissions: META_PERMISSIONS_EN,
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