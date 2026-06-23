/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { SecurityBadge, PrivacyNotice, OAuthFlowSteps } from "@/components/SecurityBadge";
import { Lock, CheckCircle2, Eye, Key } from "lucide-react";

export default function Security() {
  const { language } = useLanguage();

  const content = {
    no: {
      title: "Sikkerhet og Personvern",
      description: "Hvordan vi sikrer dine data og integritet",
      sections: [
        {
          icon: Lock,
          title: "🔒 Datakryptering",
          description: "All data er kryptert under overføring og lagring",
          details: [
            "SSL/TLS-kryptering for all nettverkskommunikasjon",
            "AES-256 kryptering for sensitive data i databasen",
            "Sikre passord med bcrypt-hashing",
            "Regelmessige sikkerhetsvurderinger",
          ],
        },
        {
          icon: Key,
          title: "🔑 Autentisering",
          description: "Sikker innlogging og tilgangskontroll",
          details: [
            "OAuth 2.0 for tredjepartsintegrasjoner",
            "JWT-tokens for sikker sesjonshåndtering",
            "Valgfri to-faktor autentisering (2FA)",
            "Automatisk utlogging etter inaktivitet",
          ],
        },
        {
          icon: Eye,
          title: "👁️ Privatlivskontroll",
          description: "Du kontrollerer hvem som ser dine data",
          details: [
            "Granulær tilgangskontroll for delte ressurser",
            "Mulighet til å slette data når som helst",
            "Eksport av dine data i strukturert format",
            "Transparent datahåndtering",
          ],
        },
        {
          icon: CheckCircle2,
          title: "✅ Compliance",
          description: "Vi overholder internasjonale standarder",
          details: [
            "GDPR-samsvar (EU personvernforordning)",
            "CCPA-samsvar (California Consumer Privacy Act)",
            "ISO 27001 sikkerhetsstandarder",
            "Regelmessige sikkerhetsvurderinger",
          ],
        },
      ],
    },
    en: {
      title: "Security & Privacy",
      description: "How we protect your data and integrity",
      sections: [
        {
          icon: Lock,
          title: "🔒 Data Encryption",
          description: "All data is encrypted in transit and at rest",
          details: [
            "SSL/TLS encryption for all network communication",
            "AES-256 encryption for sensitive data in database",
            "Secure passwords with bcrypt hashing",
            "Regular security audits",
          ],
        },
        {
          icon: Key,
          title: "🔑 Authentication",
          description: "Secure login and access control",
          details: [
            "OAuth 2.0 for third-party integrations",
            "JWT tokens for secure session management",
            "Optional two-factor authentication (2FA)",
            "Automatic logout after inactivity",
          ],
        },
        {
          icon: Eye,
          title: "👁️ Privacy Control",
          description: "You control who sees your data",
          details: [
            "Granular access control for shared resources",
            "Ability to delete data anytime",
            "Export your data in structured format",
            "Transparent data handling",
          ],
        },
        {
          icon: CheckCircle2,
          title: "✅ Compliance",
          description: "We comply with international standards",
          details: [
            "GDPR compliance (EU data protection regulation)",
            "CCPA compliance (California Consumer Privacy Act)",
            "ISO 27001 security standards",
            "Regular security audits",
          ],
        },
      ],
    },
  };

  const currentContent = content[language];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <main className="container py-8 max-w-4xl">
        <PageHeader title={currentContent.title} description={currentContent.description} />

        {/* Security Badges */}
        <SecurityBadge language={language} />

        {/* Privacy Notice */}
        <PrivacyNotice language={language} />

        {/* OAuth Flow Steps */}
        <OAuthFlowSteps language={language} />

        {/* Security Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {currentContent.sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    {section.title}
                  </CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {section.details.map((detail, detailIndex) => (
                      <li key={detailIndex} className="flex gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* FAQ Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>
              {language === "no" ? "❓ Vanlige Spørsmål" : "❓ Frequently Asked Questions"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {language === "no" ? (
              <>
                <div>
                  <h4 className="font-semibold mb-2">Lagrer dere mitt passord?</h4>
                  <p className="text-sm text-muted-foreground">
                    Nei, vi lagrer IKKE passord i klartekst. Vi bruker bcrypt-hashing som gjør det umulig å gjenopprette passordet selv for oss.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Hva hvis jeg glemmer passordet mitt?</h4>
                  <p className="text-sm text-muted-foreground">
                    Du kan tilbakestille passordet ditt ved å klikke "Glemt passord" på innloggingssiden. Vi sender en sikker lenke til e-posten din.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Hvordan fungerer OAuth-integrasjonen?</h4>
                  <p className="text-sm text-muted-foreground">
                    Du blir sendt til LinkedIn/Twitter/etc. for å autorisere. Vi mottar kun en sikker token, aldri ditt passord. Du kan tilbakekalle tilgangen når som helst.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Kan jeg slette mine data?</h4>
                  <p className="text-sm text-muted-foreground">
                    Ja, du kan når som helst slette kontoen din og alle tilknyttede data fra Innstillinger → Konto.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <h4 className="font-semibold mb-2">Do you store my password?</h4>
                  <p className="text-sm text-muted-foreground">
                    No, we do NOT store passwords in plain text. We use bcrypt hashing which makes it impossible to recover the password even for us.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">What if I forget my password?</h4>
                  <p className="text-sm text-muted-foreground">
                    You can reset your password by clicking "Forgot password" on the login page. We send a secure link to your email.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">How does OAuth integration work?</h4>
                  <p className="text-sm text-muted-foreground">
                    You are sent to LinkedIn/Twitter/etc. to authorize. We only receive a secure token, never your password. You can revoke access anytime.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Can I delete my data?</h4>
                  <p className="text-sm text-muted-foreground">
                    Yes, you can anytime delete your account and all associated data from Settings → Account.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Contact Section */}
        <Card className="mt-8 bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle>
              {language === "no" ? "📧 Sikkerhetsspørsmål?" : "📧 Security Questions?"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-4">
              {language === "no"
                ? "Hvis du har spørsmål om sikkerhet eller personvern, kontakt oss på:"
                : "If you have questions about security or privacy, contact us at:"}
            </p>
            <a href="mailto:security@innlegg.no" className="text-primary hover:underline font-semibold">
              security@innlegg.no
            </a>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}