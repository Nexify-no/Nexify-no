/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Smartphone, TrendingUp, Sparkles } from "lucide-react";
import { VippsPaymentDialog } from "@/components/VippsPayment";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { PLANS, yearlyNOK, yearlyPerMonthNOK, ANNUAL_DISCOUNT } from "@shared/pricing";

type Billing = "monthly" | "yearly";
const SAVE_PCT = Math.round(ANNUAL_DISCOUNT * 100); // 10

// The third tier is shown as "Premium" but keyed ENTERPRISE in the backend.
const backendTier = (key: string) => (key === "PREMIUM" ? "ENTERPRISE" : key);

export function Pricing() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [billing, setBilling] = useState<Billing>("monthly");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showVippsPayment, setShowVippsPayment] = useState(false);
  const [isLoading] = useState(false);

  const { data: currentSubscription } = trpc.payment.getCurrentSubscription.useQuery(
    undefined,
    { enabled: !!user }
  );

  const handleSelectPlan = (planKey: string) => {
    if (planKey === "FREE") {
      setLocation(user ? "/dashboard" : "/");
      return;
    }
    if (!user) {
      setLocation("/");
      return;
    }
    setSelectedPlan(planKey);
    setShowVippsPayment(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/80 via-background to-background dark:from-slate-950/50">
      <main className="container py-12 md:py-20 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-10 page-enter">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
            <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
              Transparent prising
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Velg din plan</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start gratis – ingen kredittkort. Oppgrader når du er klar.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <button
            onClick={() => setBilling("monthly")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              billing === "monthly" ? "bg-primary text-white shadow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Månedlig
          </button>
          <button
            onClick={() => setBilling("yearly")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition inline-flex items-center gap-2 ${
              billing === "yearly" ? "bg-primary text-white shadow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Årlig
            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
              Spar {SAVE_PCT}%
            </span>
          </button>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16 max-w-5xl mx-auto">
          {PLANS.map((plan) => {
            const isCurrentPlan = currentSubscription?.tier === backendTier(plan.key);
            const isYearly = billing === "yearly" && plan.monthlyNOK > 0;
            const priceShown = isYearly ? yearlyPerMonthNOK(plan.monthlyNOK) : plan.monthlyNOK;

            return (
              <Card
                key={plan.key}
                className={`relative transition-all duration-300 hover:shadow-lg ${
                  plan.highlighted ? "md:scale-105 border-2 border-blue-500 shadow-xl" : "hover:shadow-md"
                } ${isCurrentPlan ? "ring-2 ring-green-500" : ""}`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      ANBEFALT
                    </span>
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                    Din plan
                  </div>
                )}

                <CardHeader className={plan.highlighted ? "pt-8" : ""}>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.tagline}</CardDescription>

                  <div className="mt-6 mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">{priceShown}</span>
                      <span className="text-muted-foreground">kr</span>
                      {plan.monthlyNOK > 0 && <span className="text-muted-foreground">/mnd</span>}
                    </div>
                    {isYearly && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {yearlyNOK(plan.monthlyNOK)} kr faktureres årlig
                      </p>
                    )}
                    {!isYearly && plan.monthlyNOK > 0 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        = {(plan.monthlyNOK / 30).toFixed(2)} kr/dag
                      </p>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  <Button
                    onClick={() => handleSelectPlan(plan.key)}
                    disabled={isCurrentPlan || isLoading}
                    className={`w-full h-11 font-semibold ${
                      plan.highlighted
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                        : ""
                    }`}
                    variant={isCurrentPlan ? "outline" : plan.highlighted ? "default" : "outline"}
                  >
                    {isCurrentPlan ? (
                      "Din plan"
                    ) : (
                      <>
                        {plan.key === "FREE" ? "Start gratis" : `Velg ${plan.name}`}
                        {plan.key !== "FREE" && <Smartphone className="ml-2 h-4 w-4" />}
                      </>
                    )}
                  </Button>

                  <div className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Features Comparison */}
        <div className="bg-card rounded-xl border p-8 mb-16">
          <h2 className="text-2xl font-bold mb-8">Sammenlign planer</h2>

          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4 pb-3 border-b font-semibold text-sm text-muted-foreground">
              <div>Funksjon</div>
              <div className="text-center">Gratis</div>
              <div className="text-center text-blue-600">Pro</div>
              <div className="text-center">Premium</div>
            </div>
            {[
              { feature: "Innlegg per måned", free: "2", pro: "15", premium: "30" },
              { feature: "AI-genererte bilder", free: "Nei", pro: "Ja", premium: "Ja" },
              { feature: "Stemmetrening", free: "Nei", pro: "Ja", premium: "Avansert" },
              { feature: "Innholdskalender", free: "Nei", pro: "Ja", premium: "Ja" },
              { feature: "Multi-bruker / team", free: "Nei", pro: "Nei", premium: "Ja" },
              { feature: "Support", free: "Grunnleggende", pro: "Prioritert", premium: "Dedikert" },
            ].map((row, idx) => (
              <div key={idx} className="grid grid-cols-4 gap-4 py-3 border-b last:border-b-0">
                <div className="font-medium">{row.feature}</div>
                <div className="text-center text-sm">{row.free}</div>
                <div className="text-center text-sm text-blue-600 font-medium">{row.pro}</div>
                <div className="text-center text-sm">{row.premium}</div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-xl border p-8">
          <h2 className="text-2xl font-bold mb-8">Vanlige spørsmål</h2>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                q: "Kan jeg bytte plan når som helst?",
                a: "Ja, du kan oppgradere eller nedgradere planen din når som helst. Endringer trer i kraft på neste faktureringsdato.",
              },
              {
                q: "Hvor mange innlegg får jeg?",
                a: "Gratis gir 2 innlegg per måned, Pro gir 15 og Premium gir 30 – med AI-bilder inkludert fra Pro og oppover.",
              },
              {
                q: "Tilbyr dere refusjon?",
                a: "Ja, vi tilbyr 30 dagers pengene-tilbake-garanti hvis du ikke er fornøyd.",
              },
              {
                q: `Er det rabatt på årlig betaling?`,
                a: `Ja. Velger du årlig betaling sparer du ${SAVE_PCT}% sammenlignet med å betale måned for måned.`,
              },
            ].map((item, idx) => (
              <div key={idx}>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  {item.q}
                </h3>
                <p className="text-sm text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Vipps Payment Modal */}
      {showVippsPayment && selectedPlan && (() => {
        const plan = PLANS.find((p) => p.key === selectedPlan);
        if (!plan) return null;
        const amountNOK = billing === "yearly" ? yearlyNOK(plan.monthlyNOK) : plan.monthlyNOK;
        return (
          <VippsPaymentDialog
            amount={amountNOK * 100}
            description={`${plan.name}-abonnement (${billing === "yearly" ? "årlig" : "månedlig"})`}
            onClose={() => {
              setShowVippsPayment(false);
              setSelectedPlan(null);
            }}
            onSuccess={() => {
              setLocation("/payment/success");
            }}
          />
        );
      })()}
    </div>
  );
}