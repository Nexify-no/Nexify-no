/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Dashboard entry point back into the first-run wizard (/kom-i-gang).
 * Shown until onboarding is completed or the card is dismissed — this is the
 * "switch to the wizard" side of the wizard/classic choice; progress is
 * preserved (the wizard auto-saves), so it resumes mid-journey.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";

const DISMISS_KEY = "penna_wizard_card_dismissed";

function readSavedStep(userId: number | undefined): number | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(`penna_wizard_v1:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { step?: number; choiceMade?: boolean };
    return parsed.choiceMade && typeof parsed.step === "number" && parsed.step > 1
      ? parsed.step
      : null;
  } catch {
    return null;
  }
}

export default function WizardResumeCard() {
  const { user, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  const { data: onboarding } = trpc.user.getOnboardingStatus.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (dismissed || !onboarding || onboarding.completed) return null;

  const savedStep = readSavedStep(user?.id);
  const no = language === "no";
  const title = savedStep
    ? no
      ? `Fortsett oppsettet — steg ${savedStep} av 6`
      : `Continue setup — step ${savedStep} of 6`
    : no
      ? "Kom i gang på 3 minutter"
      : "Get set up in 3 minutes";
  const body = savedStep
    ? no
      ? "Fremdriften din er lagret. Fortsett der du slapp."
      : "Your progress is saved. Pick up where you left off."
    : no
      ? "La veiviseren sette opp merkevaren, kanalen og de første innleggene for deg."
      : "Let the wizard set up your brand, channel and first posts for you.";

  return (
    <div className="mb-6 flex items-center gap-4 rounded-xl border border-primary/25 bg-primary/[0.04] p-4 pr-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Sparkles className="h-5 w-5 text-primary" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      <button
        type="button"
        onClick={() => setLocation("/kom-i-gang")}
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-95"
      >
        {savedStep ? (no ? "Fortsett" : "Continue") : no ? "Start veiviseren" : "Start the wizard"}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(DISMISS_KEY, "1");
          } catch {
            /* ignore */
          }
        }}
        aria-label={no ? "Skjul" : "Dismiss"}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
