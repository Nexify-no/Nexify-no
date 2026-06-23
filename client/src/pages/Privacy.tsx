/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, Database, Eye, UserX, Mail } from "lucide-react";

export default function Privacy() {
  const { language } = useLanguage();

  const norwegianContent = {
    title: "Personvernerklæring",
    lastUpdated: "Sist oppdatert: 26. januar 2026",
    intro: "Hos Innlegg tar vi personvernet ditt på alvor. Denne personvernerklæringen forklarer hvordan vi samler inn, bruker og beskytter dine personopplysninger i samsvar med GDPR (General Data Protection Regulation).",
    sections: [
      {
        icon: Database,
        title: "1. Hvilke data samler vi inn",
        content: [
          "**Kontoinformasjon**: Navn, e-postadresse, og profilbilde (via OAuth-pålogging)",
          "**Innholddata**: Innlegg du genererer, lagrede utkast, og preferanser",
          "**Bruksdata**: Antall genererte innlegg, abonnementsstatus, og språkvalg",
          "**Tekniske data**: IP-adresse, nettlesertype, og enhetsinformasjon (for sikkerhet og feilsøking)"
        ]
      },
      {
        icon: Eye,
        title: "2. Hvordan bruker vi dataene dine",
        content: [
          "**Tjenesteleveranse**: For å generere innhold og levere funksjonaliteten du har bedt om",
          "**AI-behandling**: Vi sender dine tekstforespørsler til OpenAI (USA) for innholdsgenerering. OpenAI lagrer ikke dataene dine permanent etter behandling.",
          "**Forbedring**: For å analysere bruksmønstre og forbedre tjenesten",
          "**Kommunikasjon**: For å sende viktige oppdateringer om tjenesten (ikke markedsføring uten samtykke)"
        ]
      },
      {
        icon: Lock,
        title: "3. Datasikkerhet",
        content: [
          "**Kryptering**: All data overføres via HTTPS (SSL/TLS-kryptering)",
          "**Lagring**: Dataene dine lagres sikkert i TiDB Cloud (GDPR-kompatibel database)",
          "**Tilgangskontroll**: Kun autorisert personell har tilgang til databasen",
          "**Bilder**: Bilder du laster opp lagres i Amazon S3 med sikre tilgangskontroller"
        ]
      },
      {
        icon: Shield,
        title: "4. Dine rettigheter (GDPR)",
        content: [
          "**Rett til innsyn**: Du kan når som helst be om en kopi av dine data",
          "**Rett til sletting**: Du kan slette kontoen din og alle tilknyttede data fra Innstillinger",
          "**Rett til dataportabilitet**: Du kan eksportere innleggene dine i JSON-format",
          "**Rett til å trekke tilbake samtykke**: Du kan når som helst trekke tilbake samtykket ditt til AI-behandling"
        ]
      },
      {
        icon: UserX,
        title: "5. Datasletting",
        content: [
          "Du kan slette kontoen din når som helst fra **Innstillinger > Slett konto**",
          "Når du sletter kontoen din, fjernes følgende permanent:",
          "- All kontoinformasjon (navn, e-post, profil)",
          "- Alle genererte innlegg og utkast",
          "- Alle opplastede bilder fra S3",
          "- Abonnementshistorikk og preferanser",
          "**Merk**: Sletting er permanent og kan ikke angres."
        ]
      },
      {
        icon: Mail,
        title: "6. Kontakt oss",
        content: [
          "Hvis du har spørsmål om personvern eller ønsker å utøve dine GDPR-rettigheter, kontakt oss:",
          "**E-post**: privacy@innlegg.no",
          "**Responstid**: Vi svarer innen 30 dager i henhold til GDPR-krav"
        ]
      }
    ],
    openaiNotice: {
      title: "Viktig merknad om OpenAI",
      content: "Når du bruker vår AI-innholdsgenerator, sendes tekstforespørselen din til OpenAI (USA) for behandling. OpenAI er sertifisert under EU-US Data Privacy Framework. Du eier 100% av innholdet som genereres. OpenAI lagrer ikke forespørslene dine permanent etter behandling (30-dagers oppbevaring for sikkerhet). Ved første pålogging vil du bli bedt om å samtykke til denne behandlingen."
    }
  };

  const englishContent = {
    title: "Privacy Policy",
    lastUpdated: "Last updated: January 26, 2026",
    intro: "At Innlegg, we take your privacy seriously. This privacy policy explains how we collect, use, and protect your personal information in accordance with GDPR (General Data Protection Regulation).",
    sections: [
      {
        icon: Database,
        title: "1. What Data We Collect",
        content: [
          "**Account Information**: Name, email address, and profile picture (via OAuth login)",
          "**Content Data**: Posts you generate, saved drafts, and preferences",
          "**Usage Data**: Number of generated posts, subscription status, and language choice",
          "**Technical Data**: IP address, browser type, and device information (for security and troubleshooting)"
        ]
      },
      {
        icon: Eye,
        title: "2. How We Use Your Data",
        content: [
          "**Service Delivery**: To generate content and deliver the functionality you requested",
          "**AI Processing**: We send your text requests to OpenAI (USA) for content generation. OpenAI does not permanently store your data after processing.",
          "**Improvement**: To analyze usage patterns and improve the service",
          "**Communication**: To send important service updates (no marketing without consent)"
        ]
      },
      {
        icon: Lock,
        title: "3. Data Security",
        content: [
          "**Encryption**: All data is transmitted via HTTPS (SSL/TLS encryption)",
          "**Storage**: Your data is securely stored in TiDB Cloud (GDPR-compliant database)",
          "**Access Control**: Only authorized personnel have database access",
          "**Images**: Images you upload are stored in Amazon S3 with secure access controls"
        ]
      },
      {
        icon: Shield,
        title: "4. Your Rights (GDPR)",
        content: [
          "**Right to Access**: You can request a copy of your data at any time",
          "**Right to Deletion**: You can delete your account and all associated data from Settings",
          "**Right to Data Portability**: You can export your posts in JSON format",
          "**Right to Withdraw Consent**: You can withdraw your consent to AI processing at any time"
        ]
      },
      {
        icon: UserX,
        title: "5. Data Deletion",
        content: [
          "You can delete your account at any time from **Settings > Delete Account**",
          "When you delete your account, the following is permanently removed:",
          "- All account information (name, email, profile)",
          "- All generated posts and drafts",
          "- All uploaded images from S3",
          "- Subscription history and preferences",
          "**Note**: Deletion is permanent and cannot be undone."
        ]
      },
      {
        icon: Mail,
        title: "6. Contact Us",
        content: [
          "If you have questions about privacy or wish to exercise your GDPR rights, contact us:",
          "**Email**: privacy@innlegg.no",
          "**Response Time**: We respond within 30 days in accordance with GDPR requirements"
        ]
      }
    ],
    openaiNotice: {
      title: "Important Notice About OpenAI",
      content: "When you use our AI content generator, your text request is sent to OpenAI (USA) for processing. OpenAI is certified under the EU-US Data Privacy Framework. You own 100% of the content generated. OpenAI does not permanently store your requests after processing (30-day retention for security). On first login, you will be asked to consent to this processing."
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

        <Card className="mt-6 border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="text-orange-600 dark:text-orange-400">
              {content.openaiNotice.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">
              {content.openaiNotice.content}
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}