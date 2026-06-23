/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, AlertTriangle, CreditCard, Ban, Scale, RefreshCw } from "lucide-react";

export default function Terms() {
  const { language } = useLanguage();

  const norwegianContent = {
    title: "Vilkår for bruk",
    lastUpdated: "Sist oppdatert: 26. januar 2026",
    intro: "Ved å bruke Innlegg godtar du disse vilkårene. Les dem nøye før du bruker tjenesten.",
    sections: [
      {
        icon: FileText,
        title: "1. Aksept av vilkår",
        content: [
          "Ved å opprette en konto og bruke Innlegg, godtar du å være bundet av disse vilkårene.",
          "Hvis du ikke godtar disse vilkårene, må du ikke bruke tjenesten.",
          "Vi forbeholder oss retten til å endre disse vilkårene når som helst. Endringer trer i kraft umiddelbart etter publisering."
        ]
      },
      {
        icon: CreditCard,
        title: "2. Abonnement og betaling",
        content: [
          "**Gratis prøveperiode**: Nye brukere får 14 dagers gratis prøveperiode med 5 innlegg",
          "**Pro-abonnement**: 199 NOK/måned for ubegrenset innholdsgenerering",
          "**Årsabonnement**: 1910 NOK/år (spar 2 måneder)",
          "**Fakturering**: Abonnementer fornyes automatisk hver måned/år",
          "**Betalingsmetoder**: Vi aksepterer kredittkort, debetkort og Vipps",
          "**Refusjon**: Ingen refusjon for ubrukte deler av abonnementsperioden"
        ]
      },
      {
        icon: Scale,
        title: "3. Eierskap til innhold",
        content: [
          "**Ditt innhold**: Du eier 100% av innholdet du genererer med Innlegg",
          "**Kommersiell bruk**: Du kan fritt bruke generert innhold til kommersielle formål",
          "**Ingen rettigheter for oss**: Innlegg gjør ikke krav på noen rettigheter til ditt genererte innhold",
          "**AI-generert innhold**: Vær oppmerksom på at AI-generert innhold kan ligne på annet innhold. Du er ansvarlig for å sikre at innholdet ditt er unikt."
        ]
      },
      {
        icon: Ban,
        title: "4. Forbudt bruk",
        content: [
          "Du samtykker i å **ikke** bruke Innlegg til:",
          "- Generere ulovlig, hatefullt eller diskriminerende innhold",
          "- Spre feilinformasjon eller falske nyheter",
          "- Krenke andres opphavsrett eller immaterielle rettigheter",
          "- Spam eller uønsket markedsføring",
          "- Hacke, misbruke eller forstyrre tjenesten",
          "**Konsekvens**: Brudd på disse reglene kan føre til umiddelbar kontostenging uten refusjon"
        ]
      },
      {
        icon: AlertTriangle,
        title: "5. Ansvarsfraskrivelse",
        content: [
          "**Ingen garanti**: Innlegg leveres \"som den er\" uten garantier av noe slag",
          "**AI-nøyaktighet**: Vi garanterer ikke at AI-generert innhold er 100% nøyaktig eller feilfritt",
          "**Ansvar**: Du er ansvarlig for å gjennomgå og redigere innholdet før publisering",
          "**Ingen ansvar**: Innlegg er ikke ansvarlig for tap eller skade som følge av bruk av tjenesten"
        ]
      },
      {
        icon: RefreshCw,
        title: "6. Oppsigelse",
        content: [
          "**Din rett**: Du kan når som helst si opp abonnementet ditt fra Innstillinger",
          "**Vår rett**: Vi kan stenge kontoen din hvis du bryter disse vilkårene",
          "**Etter oppsigelse**: Du mister tilgang til tjenesten ved slutten av gjeldende faktureringsperiode",
          "**Datasletting**: Du kan slette kontoen din og alle data permanent fra Innstillinger"
        ]
      }
    ],
    contact: {
      title: "Kontakt oss",
      content: "Hvis du har spørsmål om disse vilkårene, kontakt oss på **support@innlegg.no**"
    }
  };

  const englishContent = {
    title: "Terms of Service",
    lastUpdated: "Last updated: January 26, 2026",
    intro: "By using Innlegg, you agree to these terms. Please read them carefully before using the service.",
    sections: [
      {
        icon: FileText,
        title: "1. Acceptance of Terms",
        content: [
          "By creating an account and using Innlegg, you agree to be bound by these terms.",
          "If you do not agree to these terms, you must not use the service.",
          "We reserve the right to change these terms at any time. Changes take effect immediately upon publication."
        ]
      },
      {
        icon: CreditCard,
        title: "2. Subscription and Payment",
        content: [
          "**Free Trial**: New users get a 14-day free trial with 5 posts",
          "**Pro Subscription**: 199 NOK/month for unlimited content generation",
          "**Annual Subscription**: 1910 NOK/year (save 2 months)",
          "**Billing**: Subscriptions renew automatically every month/year",
          "**Payment Methods**: We accept credit cards, debit cards, and Vipps",
          "**Refunds**: No refunds for unused portions of the subscription period"
        ]
      },
      {
        icon: Scale,
        title: "3. Content Ownership",
        content: [
          "**Your Content**: You own 100% of the content you generate with Innlegg",
          "**Commercial Use**: You can freely use generated content for commercial purposes",
          "**No Rights for Us**: Innlegg makes no claim to any rights to your generated content",
          "**AI-Generated Content**: Be aware that AI-generated content may resemble other content. You are responsible for ensuring your content is unique."
        ]
      },
      {
        icon: Ban,
        title: "4. Prohibited Use",
        content: [
          "You agree to **not** use Innlegg to:",
          "- Generate illegal, hateful, or discriminatory content",
          "- Spread misinformation or fake news",
          "- Infringe on others' copyright or intellectual property rights",
          "- Spam or unwanted marketing",
          "- Hack, abuse, or disrupt the service",
          "**Consequence**: Violation of these rules may result in immediate account closure without refund"
        ]
      },
      {
        icon: AlertTriangle,
        title: "5. Disclaimer",
        content: [
          "**No Warranty**: Innlegg is provided \"as is\" without warranties of any kind",
          "**AI Accuracy**: We do not guarantee that AI-generated content is 100% accurate or error-free",
          "**Responsibility**: You are responsible for reviewing and editing content before publishing",
          "**No Liability**: Innlegg is not liable for any loss or damage resulting from use of the service"
        ]
      },
      {
        icon: RefreshCw,
        title: "6. Termination",
        content: [
          "**Your Right**: You can cancel your subscription at any time from Settings",
          "**Our Right**: We may close your account if you violate these terms",
          "**After Cancellation**: You lose access to the service at the end of the current billing period",
          "**Data Deletion**: You can delete your account and all data permanently from Settings"
        ]
      }
    ],
    contact: {
      title: "Contact Us",
      content: "If you have questions about these terms, contact us at **support@innlegg.no**"
    }
  };

  const content = language === "no" ? norwegianContent : englishContent;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <main className="container py-12 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-3">{content.title}</h1>
          <p className="text-sm text-muted-foreground">{content.lastUpdated}</p>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <p className="text-muted-foreground leading-relaxed">{content.intro}</p>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {content.sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {section.content.map((paragraph, pIndex) => (
                      <p key={pIndex} className="text-muted-foreground leading-relaxed">
                        {paragraph.split('**').map((part, i) => 
                          i % 2 === 1 ? <strong key={i} className="text-foreground font-semibold">{part}</strong> : part
                        )}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="mt-6 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle className="text-blue-600 dark:text-blue-400">
              {content.contact.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">
              {content.contact.content.split('**').map((part, i) => 
                i % 2 === 1 ? <strong key={i} className="text-foreground font-semibold">{part}</strong> : part
              )}
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}