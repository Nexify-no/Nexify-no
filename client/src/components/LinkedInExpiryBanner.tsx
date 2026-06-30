/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Warns when the user's LinkedIn access token is about to expire (or has).
 * LinkedIn member tokens last ~60 days and do NOT auto-refresh, so auto-posting
 * silently stops unless the user reconnects. Renders nothing when there is no
 * connection or it is comfortably valid (> 7 days left).
 */
export function LinkedInExpiryBanner() {
  const { data } = trpc.linkedin.getConnectionStatus.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const [dismissed, setDismissed] = useState(false);

  // No connection at all (no expiry) → nothing to warn about.
  if (dismissed || !data?.expiresAt) return null;

  const days = Math.ceil((new Date(data.expiresAt).getTime() - Date.now()) / 86_400_000);
  const expired = !data.connected; // getConnectionStatus reports connected=false once expired
  if (!expired && days > 7) return null;

  const no = language === "no";
  const title = expired
    ? (no ? "LinkedIn-tilkoblingen din er utløpt" : "Your LinkedIn connection has expired")
    : (no
        ? `LinkedIn-tilkoblingen utløper om ${days} ${days === 1 ? "dag" : "dager"}`
        : `Your LinkedIn connection expires in ${days} ${days === 1 ? "day" : "days"}`);
  const body = no
    ? "Koble til på nytt for at automatisk publisering til LinkedIn skal fortsette å virke."
    : "Reconnect so automatic publishing to LinkedIn keeps working.";

  const tone = expired
    ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
    : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300";

  return (
    <div className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${tone}`}>
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span><strong>{title}.</strong> {body}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant={expired ? "destructive" : "default"} onClick={() => setLocation("/innstillinger")}>
          {no ? "Koble til på nytt" : "Reconnect"}
        </Button>
        <button onClick={() => setDismissed(true)} aria-label={no ? "Lukk" : "Dismiss"} className="px-1 opacity-60 hover:opacity-100">✕</button>
      </div>
    </div>
  );
}

export default LinkedInExpiryBanner;
