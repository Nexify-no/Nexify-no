/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cookie, Info, Settings, Shield } from "lucide-react";

export default function CookiePolicy() {
  useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8">
          <Cookie className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-center mb-4">Informasjonskapselpolicy</h1>
          <p className="text-center text-muted-foreground">
            Sist oppdatert: {new Date().toLocaleDateString('nb-NO', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Hva er informasjonskapsler?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Informasjonskapsler (cookies) er små tekstfiler som lagres på enheten din når du besøker et nettsted. De brukes til å huske preferanser, forbedre brukeropplevelsen og analysere hvordan tjenesten brukes.
            </p>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-semibold mb-2">Hvorfor bruker vi informasjonskapsler?</p>
              <p className="text-sm text-muted-foreground">
                Vi bruker informasjonskapsler for å gjøre Nexify AI-tjenesten bedre, sikrere og mer personlig tilpasset for deg.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cookie className="h-5 w-5" />
              Typer informasjonskapsler vi bruker
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  1. Nødvendige informasjonskapsler
                </h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Disse er essensielle for at tjenesten skal fungere. De kan ikke deaktiveres.
                </p>
                <div className="bg-white dark:bg-gray-900 p-3 rounded mt-2">
                  <p className="text-xs font-mono mb-1">session_token</p>
                  <p className="text-xs text-muted-foreground">Formål: Autentisering og innlogging</p>
                  <p className="text-xs text-muted-foreground">Varighet: Økt (slettes ved utlogging)</p>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  2. Funksjonelle informasjonskapsler
                </h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Disse husker dine valg og preferanser for å forbedre opplevelsen.
                </p>
                <div className="space-y-2 mt-2">
                  <div className="bg-white dark:bg-gray-900 p-3 rounded">
                    <p className="text-xs font-mono mb-1">language_preference</p>
                    <p className="text-xs text-muted-foreground">Formål: Lagrer språkvalg (Norsk/Engelsk)</p>
                    <p className="text-xs text-muted-foreground">Varighet: 1 år</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded">
                    <p className="text-xs font-mono mb-1">theme_preference</p>
                    <p className="text-xs text-muted-foreground">Formål: Lagrer tema (lys/mørk modus)</p>
                    <p className="text-xs text-muted-foreground">Varighet: 1 år</p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 p-4 rounded-lg">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  3. Analytiske informasjonskapsler
                </h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Disse hjelper oss å forstå hvordan tjenesten brukes, slik at vi kan forbedre den.
                </p>
                <div className="space-y-2 mt-2">
                  <div className="bg-white dark:bg-gray-900 p-3 rounded">
                    <p className="text-xs font-mono mb-1">_analytics_session</p>
                    <p className="text-xs text-muted-foreground">Formål: Spore brukerøkter og sidevisninger</p>
                    <p className="text-xs text-muted-foreground">Varighet: 30 minutter</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded">
                    <p className="text-xs font-mono mb-1">_analytics_user</p>
                    <p className="text-xs text-muted-foreground">Formål: Identifisere unike brukere (anonymisert)</p>
                    <p className="text-xs text-muted-foreground">Varighet: 2 år</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Tredjepartsinformasjonskapsler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Vi bruker også informasjonskapsler fra tredjeparter for å levere tjenesten:
            </p>
            <div className="space-y-3">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">OpenAI</h4>
                <p className="text-sm text-muted-foreground">
                  For AI-innholdsgenerering. OpenAI kan sette informasjonskapsler for å forbedre tjenesten.
                </p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Vipps</h4>
                <p className="text-sm text-muted-foreground">
                  For betalingsbehandling. Vipps setter informasjonskapsler for sikker betaling.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Administrere informasjonskapsler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Nettleserinnstillinger</h4>
              <p className="text-muted-foreground mb-3">
                Du kan kontrollere og slette informasjonskapsler gjennom nettleserens innstillinger:
              </p>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="bg-muted p-3 rounded-lg">
                  <p className="font-semibold text-sm mb-1">Google Chrome</p>
                  <p className="text-xs text-muted-foreground">Innstillinger → Personvern og sikkerhet → Informasjonskapsler</p>
                </div>
                <div className="bg-muted p-3 rounded-lg">
                  <p className="font-semibold text-sm mb-1">Mozilla Firefox</p>
                  <p className="text-xs text-muted-foreground">Innstillinger → Personvern og sikkerhet → Informasjonskapsler</p>
                </div>
                <div className="bg-muted p-3 rounded-lg">
                  <p className="font-semibold text-sm mb-1">Safari</p>
                  <p className="text-xs text-muted-foreground">Innstillinger → Personvern → Administrer nettstedsdata</p>
                </div>
                <div className="bg-muted p-3 rounded-lg">
                  <p className="font-semibold text-sm mb-1">Microsoft Edge</p>
                  <p className="text-xs text-muted-foreground">Innstillinger → Informasjonskapsler og nettstedstillatelser</p>
                </div>
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
              <p className="text-sm font-semibold mb-2">⚠️ Viktig å vite:</p>
              <p className="text-sm text-muted-foreground">
                Hvis du blokkerer nødvendige informasjonskapsler, kan deler av tjenesten slutte å fungere. Spesielt vil innlogging og autentisering ikke fungere.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Ditt samtykke
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Ved å bruke Nexify AI-tjenesten samtykker du til bruk av informasjonskapsler som beskrevet i denne policyen.
            </p>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-semibold mb-2">Trekke tilbake samtykke</p>
              <p className="text-sm text-muted-foreground">
                Du kan når som helst trekke tilbake samtykket ditt ved å slette informasjonskapsler i nettleseren eller kontakte oss på{" "}
                <a href="mailto:privacy@nexify.no" className="text-primary hover:underline">
                  privacy@nexify.no
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Endringer i informasjonskapselpolicyen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Vi kan oppdatere denne informasjonskapselpolicyen fra tid til annen for å gjenspeile endringer i teknologi eller lovgivning. Vesentlige endringer vil bli kommunisert via e-post eller ved innlogging på tjenesten.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Kontakt oss
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Hvis du har spørsmål om vår bruk av informasjonskapsler, kan du kontakte oss:</p>
            <div className="bg-muted p-4 rounded-lg">
              <p className="font-semibold mb-2">Nexify CRM Systems AS</p>
              <p className="text-sm text-muted-foreground">E-post: privacy@nexify.no</p>
              <p className="text-sm text-muted-foreground">Nettside: www.nexify.no</p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <a href="/landing" className="text-primary hover:underline">
            ← Tilbake til forsiden
          </a>
        </div>
      </div>
    </div>
  );
}