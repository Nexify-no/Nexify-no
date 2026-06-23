/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "wouter";

export default function OpenAIConsentBanner() {
  const { language } = useLanguage();
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

  if (!isVisible) return null;

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
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom-5">
      <Card className="max-w-4xl mx-auto border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/90 backdrop-blur-sm shadow-2xl">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                <AlertCircle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100 mb-2">
                {content.title}
              </h3>
              <p className="text-sm text-orange-800 dark:text-orange-200 mb-2 leading-relaxed">
                {content.description}
              </p>
              <p className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-3">
                {content.ownership}
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-300 mb-4">
                {content.learnMore}{" "}
                <Link href="/privacy">
                  <a className="underline hover:text-orange-900 dark:hover:text-orange-100">
                    {content.privacyPolicy}
                  </a>
                </Link>
              </p>
              
              <div className="flex gap-3">
                <Button 
                  onClick={handleAccept}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                  disabled={updateConsentMutation.isPending}
                >
                  {content.accept}
                </Button>
                <Button 
                  onClick={handleDecline}
                  variant="outline"
                  className="border-orange-300 dark:border-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/50"
                  disabled={updateConsentMutation.isPending}
                >
                  {content.decline}
                </Button>
              </div>
            </div>
            
            <button
              onClick={() => setIsVisible(false)}
              className="flex-shrink-0 text-orange-600 dark:text-orange-400 hover:text-orange-900 dark:hover:text-orange-100 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}