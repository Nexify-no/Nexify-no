/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, CreditCard, Download, RotateCcw, Package, MessageSquare, Scale, RefreshCw } from "lucide-react";

export default function Salgsbetingelser() {
  const { language } = useLanguage();

  const norwegianContent = {
    title: "Salgsbetingelser",
    lastUpdated: "Sist oppdatert: 26. juni 2026",
    intro: "Disse salgsbetingelsene gjelder for kjøp av abonnement og tjenester fra Penna. Betingelsene er utarbeidet med utgangspunkt i Forbrukertilsynets standard salgsbetingelser, tilpasset salg av en digital abonnementstjeneste.",
    sections: [
      {
        icon: Building2,
        title: "1. Parter",
        content: [
          "**Selger** er Nexify CRM Systems AS (\"Penna\", \"vi\", \"oss\"), org.nr 936300278.",
          "**Adresse**: Nedre Sølen 5, 3913 Porsgrunn, Norge.",
          "**E-post**: support@penna.no",
          "**Telefon**: [fyll inn telefonnummer]",
          "**Kjøper** er den forbrukeren eller virksomheten som foretar bestillingen, heretter kalt kunden."
        ]
      },
      {
        icon: CreditCard,
        title: "2. Betaling",
        content: [
          "Alle priser er oppgitt i norske kroner (NOK) og inkluderer merverdiavgift (MVA) der dette er aktuelt.",
          "**Priser**: Pro 199 NOK/måned, årsabonnement 2149 NOK/år (spar 10%). Gjeldende priser fremgår alltid på prissiden før kjøpet bekreftes.",
          "**Betalingsmetoder**: Vi aksepterer betalings-/kredittkort og Vipps.",
          "**Trekk**: Abonnementet er en fast, gjentakende betaling som trekkes automatisk ved starten av hver fakturaperiode (måned eller år) frem til kunden sier opp.",
          "Betaling belastes ved bestilling og deretter ved hver fornyelse."
        ]
      },
      {
        icon: Download,
        title: "3. Levering",
        content: [
          "Penna er en digital tjeneste. Levering skjer ved at kunden får tilgang til tjenesten umiddelbart etter at kontoen er opprettet og betalingen er gjennomført.",
          "Det sendes ingen fysiske varer. Tilgangen er tilgjengelig via nettstedet penna.no så lenge abonnementet er aktivt."
        ]
      },
      {
        icon: RotateCcw,
        title: "4. Angrerett",
        content: [
          "Forbrukere har som hovedregel 14 dagers angrerett etter angrerettloven ved kjøp på nett.",
          "**Digitale tjenester**: Penna leveres digitalt og starter umiddelbart. Ved kjøpet samtykker kunden uttrykkelig til at leveringen starter med en gang, og bekrefter å forstå at angreretten da bortfaller når tjenesten er tatt i bruk, jf. angrerettloven § 22 bokstav n.",
          "Dersom tjenesten ikke er tatt i bruk, kan kunden benytte angreretten innen 14 dager ved å kontakte support@penna.no. Standardisert angreskjema er tilgjengelig hos Forbrukertilsynet."
        ]
      },
      {
        icon: Package,
        title: "5. Retur",
        content: [
          "Ettersom Penna er en digital tjeneste uten fysiske varer, finnes det ingen fysisk retur.",
          "Eventuell tilbakebetaling håndteres i samsvar med angreretten (punkt 4) og reklamasjonsreglene (punkt 6). Det gis ikke refusjon for ubrukte deler av en allerede påbegynt abonnementsperiode utover det som følger av tvingende lovgivning."
        ]
      },
      {
        icon: MessageSquare,
        title: "6. Reklamasjonshåndtering",
        content: [
          "Dersom det foreligger en feil eller mangel ved tjenesten, kan kunden reklamere ved å kontakte oss på **support@penna.no**.",
          "Reklamasjon skal skje innen rimelig tid etter at mangelen ble oppdaget, i samsvar med forbrukerkjøpsloven.",
          "Vi bekrefter mottak av henvendelser så raskt som mulig, normalt innen 2 virkedager, og søker å finne en løsning gjennom retting, ny levering eller eventuelt prisavslag/heving der vilkårene for dette er oppfylt."
        ]
      },
      {
        icon: Scale,
        title: "7. Konfliktløsning",
        content: [
          "Klager rettes til oss innen rimelig tid, jf. punkt 6. Vi vil forsøke å løse eventuelle tvister i minnelighet.",
          "Dersom vi ikke kommer til enighet, kan forbrukeren ta kontakt med **Forbrukertilsynet / Forbrukerrådet** for mekling.",
          "Forbrukere kan også benytte EU-kommisjonens nettbaserte klageportal (ODR): https://ec.europa.eu/odr",
          "Tvister er underlagt norsk rett og norske domstoler."
        ]
      },
      {
        icon: RefreshCw,
        title: "8. Abonnement, bindingstid og oppsigelse",
        content: [
          "**Bindingstid**: Abonnementet har ingen bindingstid. Månedsabonnement løper måned for måned; årsabonnement løper for den betalte perioden.",
          "**Oppsigelse**: Kunden kan når som helst si opp abonnementet under Innstillinger. Oppsigelsen trer i kraft ved utløpet av inneværende, allerede betalte fakturaperiode.",
          "**Endring**: Kunden kan oppgradere eller nedgradere abonnementet under Innstillinger. Endringer i pris varsles i god tid før de trer i kraft.",
          "**Etter oppsigelse**: Tilgangen opphører ved slutten av gjeldende fakturaperiode, og det skjer ingen ytterligere trekk."
        ]
      }
    ],
    contact: {
      title: "Firma- og kontaktinformasjon",
      content: "**Nexify CRM Systems AS** · Org.nr 936300278 · Nedre Sølen 5, 3913 Porsgrunn · E-post: support@penna.no · Telefon: [fyll inn]"
    }
  };

  const englishContent = {
    title: "Terms of Sale",
    lastUpdated: "Last updated: 26 June 2026",
    intro: "These terms of sale apply to the purchase of subscriptions and services from Penna. They are based on the Norwegian Consumer Authority's standard sales terms, adapted for a digital subscription service.",
    sections: [
      {
        icon: Building2,
        title: "1. Parties",
        content: [
          "**Seller** is Nexify CRM Systems AS (\"Penna\", \"we\", \"us\"), company no. 936300278.",
          "**Address**: Nedre Sølen 5, 3913 Porsgrunn, Norway.",
          "**Email**: support@penna.no",
          "**Phone**: [add phone number]",
          "**Buyer** is the consumer or business placing the order, hereinafter the customer."
        ]
      },
      {
        icon: CreditCard,
        title: "2. Payment",
        content: [
          "All prices are stated in Norwegian kroner (NOK) and include VAT where applicable.",
          "**Prices**: Pro 199 NOK/month, annual 2149 NOK/year (save 10%). Current prices are always shown on the pricing page before purchase is confirmed.",
          "**Payment methods**: We accept debit/credit cards and Vipps.",
          "**Charges**: The subscription is a fixed, recurring payment charged automatically at the start of each billing period (month or year) until the customer cancels.",
          "Payment is charged on order and then on each renewal."
        ]
      },
      {
        icon: Download,
        title: "3. Delivery",
        content: [
          "Penna is a digital service. Delivery occurs when the customer gains access to the service immediately after the account is created and payment is completed.",
          "No physical goods are shipped. Access is available via penna.no for as long as the subscription is active."
        ]
      },
      {
        icon: RotateCcw,
        title: "4. Right of Withdrawal",
        content: [
          "Consumers generally have a 14-day right of withdrawal under the Norwegian Right of Withdrawal Act for online purchases.",
          "**Digital services**: Penna is delivered digitally and starts immediately. On purchase, the customer expressly consents to delivery starting at once and acknowledges that the right of withdrawal then lapses once the service has been used.",
          "If the service has not been used, the customer may exercise the right of withdrawal within 14 days by contacting support@penna.no."
        ]
      },
      {
        icon: Package,
        title: "5. Returns",
        content: [
          "As Penna is a digital service with no physical goods, there is no physical return.",
          "Any refund is handled in accordance with the right of withdrawal (section 4) and the complaint rules (section 6). No refund is given for unused parts of an already started subscription period beyond what mandatory law requires."
        ]
      },
      {
        icon: MessageSquare,
        title: "6. Complaint Handling",
        content: [
          "If there is a fault or defect in the service, the customer may complain by contacting us at **support@penna.no**.",
          "Complaints must be made within a reasonable time after the defect was discovered, in accordance with the Norwegian Consumer Purchases Act.",
          "We confirm receipt as soon as possible, normally within 2 business days, and seek a solution through repair, redelivery or, where applicable, a price reduction/cancellation."
        ]
      },
      {
        icon: Scale,
        title: "7. Dispute Resolution",
        content: [
          "Complaints should be directed to us within a reasonable time (see section 6). We will try to resolve any disputes amicably.",
          "If we do not reach agreement, the consumer may contact the **Norwegian Consumer Authority / Consumer Council** for mediation.",
          "Consumers may also use the EU Commission's online dispute resolution platform (ODR): https://ec.europa.eu/odr",
          "Disputes are governed by Norwegian law and Norwegian courts."
        ]
      },
      {
        icon: RefreshCw,
        title: "8. Subscription, Lock-in and Cancellation",
        content: [
          "**Lock-in**: The subscription has no lock-in period. Monthly plans run month to month; annual plans run for the paid period.",
          "**Cancellation**: The customer may cancel the subscription at any time under Settings. Cancellation takes effect at the end of the current, already paid billing period.",
          "**Changes**: The customer may upgrade or downgrade under Settings. Price changes are notified well in advance.",
          "**After cancellation**: Access ends at the end of the current billing period and no further charges are made."
        ]
      }
    ],
    contact: {
      title: "Company and Contact Information",
      content: "**Nexify CRM Systems AS** · Company no. 936300278 · Nedre Sølen 5, 3913 Porsgrunn, Norway · Email: support@penna.no · Phone: [add]"
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
