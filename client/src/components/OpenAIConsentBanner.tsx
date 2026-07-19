/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, CheckCircle2, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link, useLocation } from "wouter";

export default function OpenAIConsentBanner() {
  const { language } = useLanguage();
  const [location] = useLocation();
  const [isVisible, setIsVisible] = useState(false);

  const { data: preferences } = trpc.user.getPreference.useQuery();
  const updateConsentMutation = trpc.user.updateOpenAIConsent.useMutation({
    onSuccess: () => {
      setIsVisible(false);
    }
  });

  useEffect(() => {
    // Show banner if user hasn't been asked for consent yet (openaiConsent === 0)
    if (preferences && preferences.openaiConsent === 0) {
      setIsVisible(true);
    }
  }, [preferences]);

  const handleAccept = () => {
    updateConsentMutation.mutate({ consent: 1 }); // 1 = accepted
  };

  const handleDecline = () => {
    updateConsentMutation.mutate({ consent: 2 }); // 2 = declined
  };

  // The first-run wizard (one task per screen, fixed bottom CTA) handles the
  // OpenAI disclosure itself in its step-1 microcopy — this z-50 bottom banner
  // would cover the wizard's primary button and add competing choices.
  if (!isVisible || location === "/kom-i-gang" || location === "/onboarding") return null;

  const norwegianContent = {
    title: "Vi bruker OpenAI for innholdsgenerering",
    description: "For å generere høykvalitets innhold, sender vi tekstforespørslene dine til OpenAI (USA) for AI-behandling. OpenAI er sertifisert under EU-US Data Privacy Framework og lagrer ikke dataene dine permanent etter behandling (30-dagers oppbevaring for sikkerhet).",
    ownership: "Du eier 100% av innholdet som genereres.",
    learnMore: "Les mer i vår",
    privacyPolicy: "personvernerklæring",
    accept: "Jeg godtar",
    decline: "Avslå"
  };

  const englishContent = {
    title: "We use OpenAI for content generation",
    description: "To generate high-quality content, we send your text requests to OpenAI (USA) for AI processing. OpenAI is certified under the EU-US Data Privacy Framework and does not permanently store your data after processing (30-day retention for security).",
    ownership: "You own 100% of the content generated.",
    learnMore: "Learn more in our",
    privacyPolicy: "privacy policy",
    accept: "I Accept",
    decline: "Decline"
  };

  const content = language === "no" ? norwegianContent : englishContent;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 sm:p-6 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-xl animate-in slide-in-from-bottom-5 fade-in duration-300">
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 shadow-2xl ring-1 ring-black/5 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95">
          {/* Brand accent bar */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600" />

          <button
            onClick={() => setIsVisible(false)}
            className="absolute right-3 top-3 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-purple-500/20">
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>

              <div className="flex-1 pr-4">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                  {content.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {content.description}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl bg-zinc-50 px-3.5 py-2.5 dark:bg-zinc-800/60">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                {content.ownership}
              </span>
            </div>

            <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
              {content.learnMore}{" "}
              <Link href="/privacy">
                <a className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400">
                  {content.privacyPolicy}
                </a>
              </Link>
            </p>

            <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <Button
                onClick={handleDecline}
                variant="ghost"
                className="text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                disabled={updateConsentMutation.isPending}
              >
                {content.decline}
              </Button>
              <Button
                onClick={handleAccept}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-purple-500/20 transition-all hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg"
                disabled={updateConsentMutation.isPending}
              >
                {content.accept}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
