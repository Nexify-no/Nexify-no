/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Target, Heart, Users, Lightbulb, TrendingUp, Mail, Globe } from "lucide-react";

export default function AboutUs() {
  useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <Building2 className="h-20 w-20 mx-auto mb-6" />
          <h1 className="text-5xl font-bold mb-6">Om Nexify CRM Systems AS</h1>
          <p className="text-xl max-w-3xl mx-auto leading-relaxed">
            Vi bygger intelligente løsninger som hjelper bedrifter og profesjonelle med å spare tid, 
            øke produktiviteten og fokusere på det som virkelig betyr noe.
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Company Story */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <Lightbulb className="h-8 w-8 text-primary" />
              Vår historie
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-lg">
            <p>
              Nexify CRM Systems AS ble grunnlagt med en klar visjon: å demokratisere tilgangen til 
              kraftige AI-verktøy som tidligere kun var tilgjengelige for store selskaper med store budsjetter.
            </p>
            <p>
              Vi så at små og mellomstore bedrifter, gründere og profesjonelle slet med å holde tritt 
              med innholdsproduksjon i en verden der sosiale medier er avgjørende for synlighet og vekst. 
              Samtidig var AI-teknologien i ferd med å revolusjonere måten vi jobber på.
            </p>
            <p>
              Resultatet ble <strong>Nexify AI</strong> – vår første AI-drevne løsning som kombinerer 
              kraftig innholdsgenerering med personlig coaching. Vi tror ikke bare på å gi deg verktøyene, 
              men også på å hjelpe deg å bli bedre i det du gjør.
            </p>
          </CardContent>
        </Card>

        {/* Vision & Mission */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Target className="h-7 w-7 text-blue-600" />
                Vår visjon
              </CardTitle>
            </CardHeader>
            <CardContent className="text-lg">
              <p>
                Å bli Norges ledende leverandør av AI-drevne produktivitetsverktøy som gjør 
                profesjonelle i stand til å jobbe smartere, ikke hardere.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <TrendingUp className="h-7 w-7 text-purple-600" />
                Vårt oppdrag
              </CardTitle>
            </CardHeader>
            <CardContent className="text-lg">
              <p>
                Å utvikle intuitive, kraftige og rimelige AI-løsninger som sparer tid, 
                øker kvaliteten og gir konkurransefortrinn til norske bedrifter.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Core Values */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <Heart className="h-8 w-8 text-primary" />
              Våre verdier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-green-100 dark:bg-green-900/20 p-2 rounded-lg">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-1">Kundefokus</h4>
                    <p className="text-muted-foreground">
                      Våre kunder er i sentrum av alt vi gjør. Vi lytter, lærer og forbedrer oss kontinuerlig 
                      basert på tilbakemeldinger.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded-lg">
                    <Lightbulb className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-1">Innovasjon</h4>
                    <p className="text-muted-foreground">
                      Vi utforsker nye teknologier og metoder for å levere løsninger som alltid er ett steg foran.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-purple-100 dark:bg-purple-900/20 p-2 rounded-lg">
                    <Heart className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-1">Enkelhet</h4>
                    <p className="text-muted-foreground">
                      Kompleks teknologi skal være enkel å bruke. Vi designer for intuitivitet og brukervennlighet.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-orange-100 dark:bg-orange-900/20 p-2 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-1">Resultater</h4>
                    <p className="text-muted-foreground">
                      Vi måler suksess på kundens suksess. Vårt mål er målbare forbedringer i produktivitet og kvalitet.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What We Do */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <Building2 className="h-8 w-8 text-primary" />
              Hva vi gjør
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-lg">
            <p>
              Nexify CRM Systems AS spesialiserer seg på å utvikle <strong>AI-drevne SaaS-løsninger</strong> 
              som adresserer reelle utfordringer for norske bedrifter og profesjonelle.
            </p>
            <div className="bg-muted p-6 rounded-lg">
              <h4 className="font-semibold text-xl mb-3">Våre produkter:</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 p-2 rounded">
                    <span className="text-2xl">⚡</span>
                  </div>
                  <div>
                    <h5 className="font-semibold mb-1">Nexify AI - AI Content Generator</h5>
                    <p className="text-muted-foreground">
                      Lag profesjonelt innhold for sosiale medier på 30 sekunder. Med AI Content Coach 
                      som gir deg personlig tilbakemelding og hjelper deg å forbedre ferdighetene dine.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 p-2 rounded">
                    <span className="text-2xl">🚀</span>
                  </div>
                  <div>
                    <h5 className="font-semibold mb-1">Kommende løsninger</h5>
                    <p className="text-muted-foreground">
                      Vi jobber kontinuerlig med nye AI-verktøy for CRM, kundeservice, og 
                      automatisering av forretningsprosesser.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Why Choose Us */}
        <Card className="mb-8 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <TrendingUp className="h-8 w-8 text-green-600" />
              Hvorfor velge Nexify?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm mb-3">
                  <span className="text-4xl">🇳🇴</span>
                </div>
                <h4 className="font-semibold mb-2">Norsk selskap</h4>
                <p className="text-sm text-muted-foreground">
                  Bygget for det norske markedet med lokal support og forståelse
                </p>
              </div>
              <div className="text-center">
                <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm mb-3">
                  <span className="text-4xl">🔒</span>
                </div>
                <h4 className="font-semibold mb-2">GDPR-kompatibel</h4>
                <p className="text-sm text-muted-foreground">
                  Full overholdelse av personvernregler og datasikkerhet
                </p>
              </div>
              <div className="text-center">
                <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm mb-3">
                  <span className="text-4xl">💡</span>
                </div>
                <h4 className="font-semibold mb-2">Kontinuerlig innovasjon</h4>
                <p className="text-sm text-muted-foreground">
                  Jevnlige oppdateringer og nye funksjoner basert på AI-fremskritt
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Section */}
        <Card className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <Mail className="h-8 w-8" />
              Kontakt oss
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg">
              Har du spørsmål om våre produkter eller ønsker å samarbeide? Vi vil gjerne høre fra deg!
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="h-5 w-5" />
                  <h4 className="font-semibold">E-post</h4>
                </div>
                <p>support@nexify.no</p>
                <p className="text-sm opacity-90 mt-1">For generelle henvendelser og support</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="h-5 w-5" />
                  <h4 className="font-semibold">Nettside</h4>
                </div>
                <p>www.nexify.no</p>
                <p className="text-sm opacity-90 mt-1">Besøk vår hovedside for mer informasjon</p>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Forretningsadresse</h4>
              <p className="text-sm opacity-90">
                Nexify CRM Systems AS<br />
                Organisasjonsnummer: [Org.nr]<br />
                Norge
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <a href="/landing" className="text-primary hover:underline text-lg">
            ← Tilbake til forsiden
          </a>
        </div>
      </div>
    </div>
  );
}