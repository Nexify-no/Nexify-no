/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, AlertCircle, CheckCircle, XCircle, Scale, CreditCard } from "lucide-react";

export default function TermsOfService() {
  useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8">
          <FileText className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-center mb-4">Vilkår for bruk</h1>
          <p className="text-center text-muted-foreground">
            Sist oppdatert: {new Date().toLocaleDateString('nb-NO', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              1. Aksept av vilkår
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Ved å registrere deg, få tilgang til eller bruke Nexify AI-tjenesten ("Tjenesten") som tilbys av Nexify CRM Systems AS ("vi", "oss", "vår"), godtar du å være bundet av disse vilkårene for bruk ("Vilkår").
            </p>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
              <p className="text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Viktig:
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Hvis du ikke godtar disse vilkårene, må du ikke bruke tjenesten.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              2. Beskrivelse av tjenesten
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Nexify AI er en AI-drevet plattform som hjelper brukere med å generere profesjonelt innhold for sosiale medier, inkludert LinkedIn, Twitter/X, Instagram og Facebook.
            </p>
            <div className="space-y-2">
              <h4 className="font-semibold">Tjenesten inkluderer:</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>AI-basert innholdsgenerering</li>
                <li>Plattformspesifikk formatering</li>
                <li>Stemmetilpasning og personalisering</li>
                <li>Innholdsanalyse og coaching</li>
                <li>Lagring av genererte innlegg</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              3. Brukerregistrering og konto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">3.1 Registreringskrav</h4>
              <p className="text-muted-foreground">
                For å bruke tjenesten må du opprette en konto. Du må oppgi nøyaktig og fullstendig informasjon og holde kontoinformasjonen oppdatert.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">3.2 Kontosikkerhet</h4>
              <p className="text-muted-foreground">
                Du er ansvarlig for å opprettholde konfidensialiteten til kontoen din og passordet. Du er ansvarlig for all aktivitet som skjer under kontoen din.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">3.3 Alderskrav</h4>
              <p className="text-muted-foreground">
                Du må være minst 18 år gammel for å bruke tjenesten. Ved å registrere deg bekrefter du at du oppfyller dette kravet.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              4. Abonnement og betaling
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">4.1 Gratis prøveperiode</h4>
              <p className="text-muted-foreground">
                Nye brukere får 5 gratis innlegg uten kredittkort. Etter det må du oppgradere til et betalt abonnement for å fortsette å bruke tjenesten.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">4.2 Betalt abonnement</h4>
              <p className="text-muted-foreground mb-2">
                Pro-abonnementet koster 199 NOK per måned og gir tilgang til:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>15 innlegg per måned</li>
                <li>Alle plattformer</li>
                <li>AI Content Coach</li>
                <li>Ubegrensede lagrede eksempler</li>
                <li>AI Coach Chat</li>
                <li>Prioritert support</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">4.3 Betalingsmetode</h4>
              <p className="text-muted-foreground">
                Betalinger behandles gjennom Vipps. Du godtar å betale alle gebyrer som påløper under kontoen din.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">4.4 Automatisk fornyelse</h4>
              <p className="text-muted-foreground">
                Abonnementet fornyes automatisk hver måned med mindre du kansellerer før neste faktureringsperiode.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">4.5 Kansellering og refusjon</h4>
              <p className="text-muted-foreground">
                Du kan kansellere når som helst. Vi tilbyr 30-dagers pengene-tilbake-garanti for nye abonnenter. Etter 30 dager gis ingen refusjon for ubrukte deler av abonnementsperioden.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              5. Akseptabel bruk
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Du godtar å IKKE bruke tjenesten til:</p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold mb-1">Ulovlig innhold</h4>
                    <p className="text-sm text-muted-foreground">Generere innhold som bryter lover eller forskrifter</p>
                  </div>
                </div>
              </div>
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold mb-1">Hatefullt innhold</h4>
                    <p className="text-sm text-muted-foreground">Innhold som fremmer hat, vold eller diskriminering</p>
                  </div>
                </div>
              </div>
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold mb-1">Spam og misbruk</h4>
                    <p className="text-sm text-muted-foreground">Masseprodusere spam eller misbruke tjenesten</p>
                  </div>
                </div>
              </div>
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold mb-1">Krenkelse av rettigheter</h4>
                    <p className="text-sm text-muted-foreground">Krenke andres opphavsrett eller immaterielle rettigheter</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
              <p className="text-sm font-semibold">Konsekvenser ved brudd:</p>
              <p className="text-sm text-muted-foreground mt-2">
                Vi forbeholder oss retten til å suspendere eller avslutte kontoen din umiddelbart ved brudd på disse vilkårene, uten refusjon.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              6. Immaterielle rettigheter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">6.1 Ditt innhold</h4>
              <p className="text-muted-foreground">
                Du beholder alle rettigheter til innholdet du genererer gjennom tjenesten. Ved å bruke tjenesten gir du oss en begrenset lisens til å lagre og behandle innholdet for å levere tjenesten.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">6.2 Vårt innhold</h4>
              <p className="text-muted-foreground">
                Tjenesten, inkludert design, kode, logoer og varemerker, eies av Nexify CRM Systems AS og er beskyttet av opphavsrett og andre lover. Du får ikke rett til å kopiere, modifisere eller distribuere noen del av tjenesten.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              7. Ansvarsfraskrivelse
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm">
                Tjenesten leveres "som den er" og "som tilgjengelig" uten garantier av noen art, verken uttrykkelige eller underforståtte. Vi garanterer ikke at tjenesten vil være uavbrutt, sikker eller feilfri.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">AI-generert innhold</h4>
              <p className="text-muted-foreground">
                Innholdet som genereres av AI kan inneholde feil eller unøyaktigheter. Du er ansvarlig for å gjennomgå og godkjenne alt innhold før publisering. Vi er ikke ansvarlige for konsekvenser av bruk av AI-generert innhold.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              8. Ansvarsbegrensning
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              I den grad loven tillater, skal Nexify CRM Systems AS ikke holdes ansvarlig for:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Indirekte, tilfeldige, spesielle eller følgeskader</li>
              <li>Tap av fortjeneste, data eller goodwill</li>
              <li>Tjenesteforstyrrelser eller tap av tilgang</li>
              <li>Tredjeparters handlinger eller unnlatelser</li>
            </ul>
            <p className="text-sm text-muted-foreground italic">
              Vårt totale ansvar overfor deg skal ikke overstige beløpet du har betalt oss de siste 12 månedene.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              9. Endringer i vilkår
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Vi kan oppdatere disse vilkårene fra tid til annen. Vesentlige endringer vil bli kommunisert via e-post eller ved innlogging på tjenesten. Din fortsatte bruk av tjenesten etter endringer utgjør aksept av de nye vilkårene.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              10. Gjeldende lov og jurisdiksjon
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Disse vilkårene reguleres av norsk lov. Eventuelle tvister skal løses i norske domstoler.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              11. Kontakt
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Hvis du har spørsmål om disse vilkårene, kan du kontakte oss:</p>
            <div className="bg-muted p-4 rounded-lg">
              <p className="font-semibold mb-2">Nexify CRM Systems AS</p>
              <p className="text-sm text-muted-foreground">E-post: support@nexify.no</p>
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