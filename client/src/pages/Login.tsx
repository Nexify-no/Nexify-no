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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { VippsLoginButton } from "@/components/VippsLogin";
import { PennaMark } from "@/components/PennaMark";

export function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
  // 2FA challenge step
  const [challenge, setChallenge] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");

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
    const err = params.get("error");
    if (err === "auth_failed") {
      setError("Autentisering mislyktes. Prøv igjen.");
    } else if (err === "verify_failed") {
      setError("Bekreftelseslenken er ugyldig eller utløpt.");
    }
    if (params.get("verified") === "1") {
      setInfo("E-postadressen din er bekreftet. Du kan logge inn.");
    }
  }, []);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "forgot") {
        await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        // Always show a generic confirmation (no account enumeration).
        setForgotSent(true);
        setSubmitting(false);
        return;
      }
      const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login/email";
      const body =
        mode === "register"
          ? { email, password, name: name.trim() || undefined }
          : { email, password };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data && data.requires2fa === true) {
          setChallenge(data.challenge);
          setTwoFactorCode("");
          setSubmitting(false);
          return;
        }
        window.location.href = "/dashboard";
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Det oppstod en feil. Prøv igjen.");
      setSubmitting(false);
    } catch (err) {
      console.error("Email auth error:", err);
      setError("Det oppstod en feil. Prøv igjen.");
      setSubmitting(false);
    }
  };

  const handleVerify2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login/2fa", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge, code: twoFactorCode.trim() }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data && data.ok) {
          window.location.href = "/dashboard";
          return;
        }
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Det oppstod en feil. Prøv igjen.");
      setSubmitting(false);
    } catch (err) {
      console.error("2FA verify error:", err);
      setError("Det oppstod en feil. Prøv igjen.");
      setSubmitting(false);
    }
  };

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
            <PennaMark className="h-11 w-11" />
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Penna
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
            {info && (
              <Alert>
                <AlertDescription>{info}</AlertDescription>
              </Alert>
            )}

            {challenge ? (
              <form onSubmit={handleVerify2fa} className="space-y-3">
                <div className="text-center">
                  <h3 className="text-lg font-semibold">
                    Skriv inn 2FA-koden
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Enter your 2FA code
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="twofa-code">Kode</Label>
                  <Input
                    id="twofa-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={12}
                    required
                    autoFocus
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    placeholder="123456 / ab12-cd34"
                    autoComplete="one-time-code"
                    className="font-mono"
                  />
                </div>
                <Button type="submit" disabled={submitting} className="w-full h-11" size="lg">
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Vennligst vent...
                    </>
                  ) : (
                    "Bekreft"
                  )}
                </Button>
                <p className="text-sm text-center text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => {
                      setChallenge(null);
                      setTwoFactorCode("");
                      setError(null);
                    }}
                    className="text-primary underline font-medium hover:opacity-80"
                  >
                    Tilbake
                  </button>
                </p>
              </form>
            ) : (
              <>
            {/* Development Login - Only shown in development */}
            {process.env.NODE_ENV === "development" && mode !== "forgot" && (
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
                  "\u{1F680} Dev Login (Testing)"
                )}
              </Button>
            )}

            {/* Email / password / forgot form */}
            {mode === "forgot" && forgotSent ? (
              <Alert>
                <AlertDescription>
                  Hvis det finnes en konto for denne e-posten, har vi sendt en lenke for å
                  tilbakestille passordet. Sjekk innboksen din.
                </AlertDescription>
              </Alert>
            ) : (
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                {mode === "register" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Navn</Label>
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ditt navn"
                      autoComplete="name"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-post</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="deg@eksempel.no"
                    autoComplete="email"
                  />
                </div>
                {mode !== "forgot" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Passord</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={mode === "register" ? 8 : undefined}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === "register" ? "Minst 8 tegn" : "Passord"}
                      autoComplete={mode === "register" ? "new-password" : "current-password"}
                    />
                  </div>
                )}
                {mode === "login" && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setError(null);
                        setInfo(null);
                      }}
                      className="text-xs text-primary underline hover:opacity-80"
                    >
                      Glemt passord?
                    </button>
                  </div>
                )}
                <Button type="submit" disabled={submitting} className="w-full h-11" size="lg">
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Vennligst vent...
                    </>
                  ) : mode === "register" ? (
                    "Opprett konto"
                  ) : mode === "forgot" ? (
                    "Send tilbakestillingslenke"
                  ) : (
                    "Logg inn"
                  )}
                </Button>
              </form>
            )}

            {mode === "forgot" ? (
              <p className="text-sm text-center text-muted-foreground">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setForgotSent(false);
                    setError(null);
                    setInfo(null);
                  }}
                  className="text-primary underline font-medium hover:opacity-80"
                >
                  Tilbake til innlogging
                </button>
              </p>
            ) : (
              <p className="text-sm text-center text-muted-foreground">
                {mode === "register" ? "Har du allerede en konto? " : "Ny bruker? "}
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "register" ? "login" : "register");
                    setError(null);
                    setInfo(null);
                  }}
                  className="text-primary underline font-medium hover:opacity-80"
                >
                  {mode === "register" ? "Logg inn" : "Opprett konto"}
                </button>
              </p>
            )}

            {mode !== "forgot" && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-muted-foreground">eller</span>
                  </div>
                </div>

                {/* Google login - backend route: GET /api/auth/login/google */}
                <Button
                  asChild
                  variant="outline"
                  className="w-full h-12 text-base font-medium border-gray-300"
                  size="lg"
                >
                  <a href="/api/auth/login/google">
                    <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Logg inn med Google
                  </a>
                </Button>

                <VippsLoginButton className="w-full" />
              </>
            )}

              </>
            )}

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