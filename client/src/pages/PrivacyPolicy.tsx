/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Mail, Database, Lock, Eye, UserCheck } from "lucide-react";

export default function PrivacyPolicy() {
  useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8">
          <Shield className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-center mb-4">Personvernerklæring</h1>
          <p className="text-center text-muted-foreground">
            Sist oppdatert: {new Date().toLocaleDateString('nb-NO', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              1. Ansvarlig for personopplysninger
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Nexify CRM Systems AS er behandlingsansvarlig for personopplysninger som samles inn og behandles gjennom Nexify AI-tjenesten.
            </p>
            <div className="bg-muted p-4 rounded-lg">
              <p className="font-semibold mb-2">Kontaktinformasjon:</p>
              <p>Nexify CRM Systems AS</p>
              <p>E-post: privacy@nexify.no</p>
              <p>Nettside: www.nexify.no</p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              2. Hvilke personopplysninger samler vi inn?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">2.1 Informasjon du gir oss</h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Navn og e-postadresse (ved registrering)</li>
                <li>Informasjonskapselpreferanser (cookie consent)</li>
                <li>Profilinformasjon (språkpreferanser, stemmeprøver)</li>
                <li>Innhold du genererer gjennom tjenesten</li>
                <li>Betalingsinformasjon (behandles av Vipps)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">2.2 Informasjon vi samler automatisk</h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>IP-adresse og enhetsinformasjon</li>
                <li>Bruksmønstre og interaksjoner med tjenesten</li>
                <li>Informasjonskapsler (cookies) og lignende teknologier</li>
                <li>Loggdata (tidspunkt, funksjoner brukt, feilmeldinger)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              3. Hvordan bruker vi personopplysningene dine?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Vi bruker personopplysningene dine til følgende formål:</p>
            <div className="space-y-3">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">3.1 Levere tjenesten</h4>
                <p className="text-sm text-muted-foreground">
                  Opprette og administrere kontoen din, generere innhold med AI, lagre dine innlegg og preferanser.
                </p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">3.2 Forbedre tjenesten</h4>
                <p className="text-sm text-muted-foreground">
                  Analysere bruksmønstre, utvikle nye funksjoner, forbedre AI-modellene våre.
                </p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">3.3 Kommunikasjon</h4>
                <p className="text-sm text-muted-foreground">
                  Sende viktige oppdateringer, teknisk support, markedsføring (med ditt samtykke).
                </p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">3.4 Sikkerhet og juridiske forpliktelser</h4>
                <p className="text-sm text-muted-foreground">
                  Beskytte mot svindel, overholde lovkrav, håndtere tvister.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              4. Rettslig grunnlag for behandling
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Vi behandler personopplysninger basert på følgende rettslige grunnlag:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong>Avtale:</strong> For å oppfylle våre forpliktelser overfor deg som bruker</li>
              <li><strong>Samtykke:</strong> For markedsføring og valgfrie funksjoner</li>
              <li><strong>Berettiget interesse:</strong> For å forbedre tjenesten og sikkerhet</li>
              <li><strong>Juridisk forpliktelse:</strong> For å overholde lover og forskrifter</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              5. Deling av personopplysninger
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Vi deler personopplysninger med følgende tredjeparter:</p>
            <div className="space-y-3">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">5.1 Tjenesteleverandører</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>OpenAI (AI-innholdsgenerering)</li>
                  <li>Vipps (betalingsbehandling)</li>
                  <li>Hosting- og databaseleverandører</li>
                </ul>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">5.2 Juridiske krav</h4>
                <p className="text-sm text-muted-foreground">
                  Vi kan dele opplysninger hvis det kreves av lov, rettskjennelse eller offentlige myndigheter.
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground italic">
              Vi selger aldri personopplysningene dine til tredjeparter.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              6. Dine rettigheter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>I henhold til GDPR har du følgende rettigheter:</p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Innsyn</h4>
                <p className="text-sm text-muted-foreground">Få kopi av dine personopplysninger</p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Retting</h4>
                <p className="text-sm text-muted-foreground">Korrigere unøyaktige opplysninger</p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Sletting</h4>
                <p className="text-sm text-muted-foreground">Få slettet dine opplysninger</p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Begrensning</h4>
                <p className="text-sm text-muted-foreground">Begrense behandlingen</p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Dataportabilitet</h4>
                <p className="text-sm text-muted-foreground">Få dine data i strukturert format</p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Motsette seg</h4>
                <p className="text-sm text-muted-foreground">Motsette deg behandling</p>
              </div>
            </div>
            <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
              <p className="text-sm mb-3">
                <strong>Utøv dine rettigheter:</strong>
              </p>
              <div className="space-y-2 text-sm">
                <p>
                  • <strong>Eksporter dataene dine:</strong> Gå til{" "}
                  <a href="/account-settings" className="text-primary hover:underline font-medium">
                    Kontoinnstillinger
                  </a>{" "}
                  for å laste ned alle dine data
                </p>
                <p>
                  • <strong>Slett kontoen din:</strong> Gå til{" "}
                  <a href="/account-settings" className="text-primary hover:underline font-medium">
                    Kontoinnstillinger
                  </a>{" "}
                  for å slette kontoen permanent
                </p>
                <p>
                  • <strong>Andre forespørsler:</strong> Kontakt oss på{" "}
                  <a href="mailto:privacy@nexify.no" className="text-primary hover:underline">
                    privacy@nexify.no
                  </a>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              7. Informasjonskapsler (Cookies)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Vi bruker informasjonskapsler for å forbedre din opplevelse på nettstedet vårt. Du kan administrere dine informasjonskapselpreferanser når som helst.
            </p>
            <div className="space-y-3">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Nødvendige informasjonskapsler</h4>
                <p className="text-sm text-muted-foreground">
                  Disse er nødvendige for at nettstedet skal fungere og kan ikke deaktiveres. De brukes til autentisering og grunnleggende funksjonalitet.
                </p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Analyse-informasjonskapsler (valgfritt)</h4>
                <p className="text-sm text-muted-foreground">
                  Hjelper oss å forstå hvordan besøkende bruker nettstedet, slik at vi kan forbedre brukeropplevelsen.
                </p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Markedsførings-informasjonskapsler (valgfritt)</h4>
                <p className="text-sm text-muted-foreground">
                  Brukes til å vise deg relevante annonser basert på dine interesser.
                </p>
              </div>
            </div>
            <p className="text-sm">
              Les mer i vår{" "}
              <a href="/cookie-policy" className="text-primary hover:underline">
                informasjonskapselretningslinjer
              </a>
              .
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              8. Sikkerhet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Vi tar sikkerhet på alvor og implementerer passende tekniske og organisatoriske tiltak for å beskytte personopplysningene dine:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Kryptering av data under overføring (HTTPS/TLS)</li>
              <li>Kryptering av sensitive data i databasen</li>
              <li>Regelmessige sikkerhetsvurderinger</li>
              <li>Tilgangskontroll og autentisering</li>
              <li>Overvåking og logging av sikkerhetsrelevante hendelser</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              9. Lagringstid
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Vi lagrer personopplysninger så lenge det er nødvendig for formålene de ble samlet inn for:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong>Kontodata:</strong> Så lenge kontoen er aktiv + 3 måneder etter sletting</li>
              <li><strong>Nexify AI og innhold:</strong> Så lenge kontoen er aktiv</li>
              <li><strong>Betalingshistorikk:</strong> 5 år (bokføringsloven)</li>
              <li><strong>Loggdata:</strong> 12 måneder</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              10. Kontakt oss
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Hvis du har spørsmål om denne personvernerklæringen eller hvordan vi behandler personopplysningene dine, kan du kontakte oss:</p>
            <div className="bg-muted p-4 rounded-lg">
              <p className="font-semibold mb-2">Nexify CRM Systems AS</p>
              <p className="text-sm text-muted-foreground">E-post: privacy@nexify.no</p>
              <p className="text-sm text-muted-foreground">Nettside: www.nexify.no</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Du har også rett til å klage til Datatilsynet hvis du mener vi ikke overholder personvernreglene.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              11. Endringer i personvernerklæringen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Vi kan oppdatere denne personvernerklæringen fra tid til annen. Vesentlige endringer vil bli kommunisert via e-post eller ved innlogging på tjenesten. Vi oppfordrer deg til å gjennomgå denne erklæringen regelmessig.
            </p>
            <p className="text-sm text-muted-foreground italic">
              Ved å fortsette å bruke Nexify AI etter endringer er publisert, aksepterer du den oppdaterte personvernerklæringen.
            </p>
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