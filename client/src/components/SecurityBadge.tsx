/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Shield, Lock, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SecurityBadgeProps {
  language: "no" | "en";
}

export function SecurityBadge({ language }: SecurityBadgeProps) {
  const badges = [
    {
      icon: Lock,
      title: language === "no" ? "SSL Kryptert" : "SSL Encrypted",
      description: language === "no" ? "Alle data er kryptert" : "All data is encrypted",
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
    {
      icon: Shield,
      title: language === "no" ? "OAuth 2.0" : "OAuth 2.0",
      description: language === "no" ? "Sikker autentisering" : "Secure authentication",
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    {
      icon: CheckCircle2,
      title: language === "no" ? "GDPR Samsvar" : "GDPR Compliant",
      description: language === "no" ? "Respekterer personvern" : "Respects privacy",
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
      {badges.map((badge, index) => {
        const Icon = badge.icon;
        return (
          <Card key={index} className={badge.bgColor}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Icon className={`h-6 w-6 ${badge.color}`} />
                <div>
                  <p className="font-semibold text-sm">{badge.title}</p>
                  <p className="text-xs text-muted-foreground">{badge.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function PrivacyNotice({ language }: SecurityBadgeProps) {
  return (
    <Card className="border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
          <Shield className="h-5 w-5" />
          {language === "no" ? "🔒 Din Sikkerhet" : "🔒 Your Security"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p>
            {language === "no"
              ? "Vi lagrer IKKE ditt passord - LinkedIn håndterer autentiseringen"
              : "We do NOT store your password - LinkedIn handles authentication"}
          </p>
        </div>
        <div className="flex gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p>
            {language === "no"
              ? "Vi lagrer kun en sikker token som kan tilbakekalles når som helst"
              : "We only store a secure token that can be revoked anytime"}
          </p>
        </div>
        <div className="flex gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p>
            {language === "no"
              ? "Du kontrollerer hvilke tillatelser vi har tilgang til"
              : "You control which permissions we have access to"}
          </p>
        </div>
        <div className="flex gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p>
            {language === "no"
              ? "Du kan når som helst koble fra eller tilbakekalle tilgang"
              : "You can disconnect or revoke access anytime"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function OAuthFlowSteps({ language }: SecurityBadgeProps) {
  const steps = [
    {
      number: "1",
      title: language === "no" ? "Du klikker 'Koble til'" : "You click 'Connect'",
      description: language === "no" ? "Du blir sendt til LinkedIn" : "You are sent to LinkedIn",
    },
    {
      number: "2",
      title: language === "no" ? "LinkedIn autentisering" : "LinkedIn Authentication",
      description: language === "no" ? "Du logger inn på LinkedIn" : "You log in to LinkedIn",
    },
    {
      number: "3",
      title: language === "no" ? "Godkjenn tillatelser" : "Approve Permissions",
      description: language === "no" ? "Du godkjenner hva vi kan gjøre" : "You approve what we can do",
    },
    {
      number: "4",
      title: language === "no" ? "Du blir sendt tilbake" : "You are sent back",
      description: language === "no" ? "Kontoen din er nå koblet" : "Your account is now connected",
    },
  ];

  return (
    <div className="space-y-4 my-6">
      <h3 className="font-semibold">
        {language === "no" ? "📝 Slik fungerer det:" : "📝 How it works:"}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {steps.map((step, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground font-semibold">
                    {step.number}
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-sm">{step.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}