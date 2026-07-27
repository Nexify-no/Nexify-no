/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * System configuration — read-only, and truthful.
 *
 * This page used to be entirely decorative. It rendered a password field for an
 * OpenAI API key, a "Test" button and a "Save Settings" button; both handlers
 * contained nothing but a `toast.info()`, and the blue card underneath claimed
 * "These settings are stored securely" and "API keys are encrypted". Nothing was
 * stored, tested or encrypted. The page made no network call of any kind.
 *
 * The security reasoning in the old comments was correct — a provider key must
 * never travel through the browser, and never sit in localStorage — so the answer
 * is not to make the form work. It is to stop showing a form for something the
 * browser must not touch, and instead answer the question an admin actually has:
 * *which integrations are live on this deployment right now?*
 *
 * The server returns booleans only. No key, or fragment of one, is ever sent here.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Settings as SettingsIcon } from "lucide-react";

function StatusRow({ label, ok, note }: { label: string; ok: boolean; note?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b last:border-b-0">
      <div>
        <p className="font-medium text-sm">{label}</p>
        {note && <p className="text-xs text-muted-foreground mt-0.5">{note}</p>}
      </div>
      <Badge
        variant={ok ? "secondary" : "outline"}
        className={ok ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200" : ""}
      >
        {ok ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
        {ok ? "Konfigurert" : "Mangler"}
      </Badge>
    </div>
  );
}

export default function AdminSettings() {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  useLocation();
  const isAdmin = user?.role === "admin";

  const { data: cfg, isLoading } = trpc.system.getConfigStatus.useQuery(undefined, {
    enabled: Boolean(isAdmin),
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }
  if (!isAdmin) {
    // Render a message rather than calling setLocation() during render — a state
    // update in the render body warns in React and can loop with wouter. This is
    // the pattern MemberMonitoring already uses.
    return (
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-bold mb-2">Ingen tilgang</h1>
        <p className="text-muted-foreground">Denne siden er kun for administratorer.</p>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <SettingsIcon className="h-7 w-7" />
          Systemkonfigurasjon
        </h1>
        <p className="text-muted-foreground mt-2">
          Hva som faktisk er koblet opp på denne serveren. Skrivebeskyttet.
        </p>
      </div>

      {isLoading || !cfg ? (
        <p className="text-sm text-muted-foreground">Laster …</p>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Integrasjoner</CardTitle>
              <CardDescription>
                Settes med miljøvariabler på serveren — aldri fra nettleseren.
              </CardDescription>
            </CardHeader>
            <CardContent className="py-0">
              <StatusRow label="Database" ok={cfg.database} note="DATABASE_URL" />
              <StatusRow
                label="E-post (SendGrid)"
                ok={cfg.email}
                note="SENDGRID_API_KEY — uten denne kan ingen e-post sendes fra admin"
              />
              <StatusRow label="OpenAI" ok={cfg.openai} note="OPENAI_API_KEY / BUILT_IN_FORGE_API_KEY" />
              <StatusRow label="Stripe" ok={cfg.stripe} note="STRIPE_SECRET_KEY" />
              <StatusRow label="Sentry" ok={cfg.sentry} note="SENTRY_DSN" />
              <StatusRow label="Redis" ok={cfg.redis} note="REDIS_URL — valgfritt" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Funksjonsflagg</CardTitle>
              <CardDescription>Uavhengige av hverandre.</CardDescription>
            </CardHeader>
            <CardContent className="py-0">
              <StatusRow label="Multi-merkevare" ok={cfg.featureMultiBrand} note="FEATURE_MULTI_BRAND" />
              <StatusRow label="Enkel innholdsplan" ok={cfg.featureEnkelPlan} note="FEATURE_ENKEL_PLAN" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Miljø</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Modus:</span>{" "}
                <span className="font-medium">{cfg.isProduction ? "Produksjon" : "Utvikling"}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Innholdsmodell:</span>{" "}
                <span className="font-medium">{cfg.contentModel}</span>
              </p>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Denne siden viser bare <em>om</em> en nøkkel finnes — aldri verdien. For å endre noe her
            må miljøvariabelen settes på serveren og appen startes på nytt. En API-nøkkel skal aldri
            gå gjennom nettleseren.
          </p>
        </div>
      )}
    </div>
  );
}
