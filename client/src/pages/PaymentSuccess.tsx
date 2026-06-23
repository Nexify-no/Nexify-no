/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export function PaymentSuccess() {
  const [location, navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract session_id from URL
  const sessionId = new URLSearchParams(location.split("?")[1]).get("session_id");

  // Verify checkout session
  const { data: session, isLoading: sessionLoading } = trpc.payment.getCheckoutSession.useQuery(
    { sessionId: sessionId || "" },
    { enabled: !!sessionId }
  );

  useEffect(() => {
    if (!sessionLoading) {
      setIsLoading(false);
      if (!session) {
        setError("Kunne ikke verifisere betalingen. Vennligst kontakt support.");
      }
    }
  }, [session, sessionLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-lg font-medium">Verifiserer betaling...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Feil ved betaling</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => navigate("/settings/billing")} className="w-full">
              Tilbake til Fakturering
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Betaling mottatt!</CardTitle>
          <CardDescription>Takk for abonnementet ditt</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4">
            <p className="text-sm text-green-800 dark:text-green-200">
              ✓ Abonnementet ditt er aktivert og klar til bruk
            </p>
            <p className="text-sm text-green-800 dark:text-green-200 mt-2">
              ✓ Du har nå tilgang til alle Pro-funksjoner
            </p>
            <p className="text-sm text-green-800 dark:text-green-200 mt-2">
              ✓ En bekreftelses-e-post har blitt sendt til deg
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <strong>Hva nå?</strong>
            </p>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li>• Gå til Dashboard for å begynne å generere innhold</li>
              <li>• Besøk Innstillinger for å administrere abonnementet ditt</li>
              <li>• Kontakt support hvis du har spørsmål</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Button onClick={() => navigate("/dashboard")} className="w-full">
              Gå til Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/settings/billing")}
              className="w-full"
            >
              Administrer abonnement
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Sessjon-ID: {sessionId}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}