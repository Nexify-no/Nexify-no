/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2, Zap } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { VippsLoginButton } from "@/components/VippsLogin";

export function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already logged in via tRPC
  const { data: user, isLoading: authLoading } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!authLoading && user) {
      window.location.href = "/dashboard";
    }
  }, [user, authLoading]);

  // Check for error in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "auth_failed") {
      setError("Autentisering mislyktes. Prøv igjen.");
    }
  }, []);

  const handleDevLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Development login - creates test user session
      const response = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        window.location.href = "/dashboard";
      } else {
        setError("Dev login failed");
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Dev login error:", err);
      setError("Det oppstod en feil. Prøv igjen.");
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2.5 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Innlegg
            </span>
          </div>
          <p className="text-muted-foreground text-sm">
            Din AI-drevet innholdsassistent for sosiale medier
          </p>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">Velkommen tilbake</CardTitle>
            <CardDescription>
              Logg inn for å fortsette
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Development Login - Only shown in development */}
            {process.env.NODE_ENV === "development" && (
              <Button
                onClick={handleDevLogin}
                disabled={isLoading}
                variant="default"
                className="w-full h-12 text-base font-medium"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                    Kobler til...
                  </>
                ) : (
                  "🚀 Dev Login (Testing)"
                )}
              </Button>
            )}

            <VippsLoginButton className="w-full" />

            <div className="text-xs text-center text-muted-foreground">
              <p>
                Ved å logge inn godtar du våre{" "}
                <a href="/terms" className="underline hover:text-foreground transition-colors">
                  vilkår
                </a>{" "}
                og{" "}
                <a href="/privacy" className="underline hover:text-foreground transition-colors">
                  personvern
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Ny bruker? Bruk Vipps for å opprette konto
        </p>
      </div>
    </div>
  );
}