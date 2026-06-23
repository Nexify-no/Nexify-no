/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Cookie, Settings } from "lucide-react";
import { Link } from "wouter";

// Export function to reopen cookie settings
export function reopenCookieSettings() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('cookie-consent');
    window.dispatchEvent(new Event('cookieConsentReset'));
  }
}

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState({
    necessary: true, // Always true, cannot be disabled
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      setShowBanner(true);
    } else {
      try {
        const saved = JSON.parse(consent);
        setPreferences(saved);
      } catch {
        setShowBanner(true);
      }
    }

    // Listen for reset event
    const handleReset = () => {
      setShowBanner(true);
      setShowSettings(false);
      setPreferences({
        necessary: true,
        analytics: false,
        marketing: false,
      });
    };
    window.addEventListener('cookieConsentReset', handleReset);
    return () => window.removeEventListener('cookieConsentReset', handleReset);
  }, []);

  const handleAcceptAll = () => {
    const allAccepted = {
      necessary: true,
      analytics: true,
      marketing: true,
    };
    localStorage.setItem("cookie-consent", JSON.stringify(allAccepted));
    setPreferences(allAccepted);
    setShowBanner(false);
  };

  const handleRejectAll = () => {
    const onlyNecessary = {
      necessary: true,
      analytics: false,
      marketing: false,
    };
    localStorage.setItem("cookie-consent", JSON.stringify(onlyNecessary));
    setPreferences(onlyNecessary);
    setShowBanner(false);
  };

  const handleSavePreferences = () => {
    localStorage.setItem("cookie-consent", JSON.stringify(preferences));
    setShowBanner(false);
    setShowSettings(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-black/50 backdrop-blur-sm">
      <Card className="max-w-4xl mx-auto p-6 shadow-2xl">
        {!showSettings ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Cookie className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-lg mb-2">Vi bruker informasjonskapsler</h3>
                  <p className="text-sm text-muted-foreground">
                    Vi bruker informasjonskapsler for å forbedre din opplevelse på nettstedet vårt. 
                    Nødvendige informasjonskapsler er alltid aktivert, men du kan velge å akseptere eller 
                    avvise valgfrie informasjonskapsler. Les mer i vår{" "}
                    <Link href="/cookie-policy" className="text-primary hover:underline">
                      informasjonskapselretningslinjer
                    </Link>{" "}
                    og{" "}
                    <Link href="/privacy-policy" className="text-primary hover:underline">
                      personvernregler
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleAcceptAll} className="flex-1 sm:flex-none">
                Godta alle
              </Button>
              <Button onClick={handleRejectAll} variant="outline" className="flex-1 sm:flex-none">
                Avvis valgfrie
              </Button>
              <Button
                onClick={() => setShowSettings(true)}
                variant="ghost"
                className="flex-1 sm:flex-none"
              >
                <Settings className="h-4 w-4 mr-2" />
                Innstillinger
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Informasjonskapselinnstillinger</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* Necessary Cookies */}
              <div className="flex items-start justify-between gap-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex-1">
                  <div className="font-medium mb-1">Nødvendige informasjonskapsler</div>
                  <p className="text-sm text-muted-foreground">
                    Disse informasjonskapslene er nødvendige for at nettstedet skal fungere og kan ikke deaktiveres. 
                    De brukes til autentisering, sikkerhet og grunnleggende funksjonalitet.
                  </p>
                </div>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-muted-foreground">Alltid aktiv</span>
                </div>
              </div>

              {/* Analytics Cookies */}
              <div className="flex items-start justify-between gap-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium mb-1">Analyse-informasjonskapsler</div>
                  <p className="text-sm text-muted-foreground">
                    Disse informasjonskapslene hjelper oss å forstå hvordan besøkende bruker nettstedet vårt, 
                    slik at vi kan forbedre brukeropplevelsen.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.analytics}
                    onChange={(e) =>
                      setPreferences({ ...preferences, analytics: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {/* Marketing Cookies */}
              <div className="flex items-start justify-between gap-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium mb-1">Markedsførings-informasjonskapsler</div>
                  <p className="text-sm text-muted-foreground">
                    Disse informasjonskapslene brukes til å vise deg relevante annonser og 
                    markedsføringsinnhold basert på dine interesser.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.marketing}
                    onChange={(e) =>
                      setPreferences({ ...preferences, marketing: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleSavePreferences} className="flex-1">
                Lagre innstillinger
              </Button>
              <Button onClick={() => setShowSettings(false)} variant="outline" className="flex-1">
                Avbryt
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}