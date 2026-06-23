/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { CreditCard, Download, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function BillingManagement() {
  trpc.auth.me.useQuery();
  const { data: subscription, isLoading: subscriptionLoading } = trpc.user.getSubscription.useQuery();
  const { data: invoices, isLoading: invoicesLoading } = trpc.user.getInvoices.useQuery();
  const [, setSelectedPlan] = useState<"free" | "pro">("free");

  const createCheckoutMutation = trpc.stripe.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      window.open(data.url, "_blank");
      toast.success("Omdirigerer til betaling...");
    },
    onError: (error) => {
      toast.error(error.message || "Kunne ikke starte betaling");
    },
  });

  const plans = [
    {
      id: "free",
      name: "Gratis",
      price: "0 kr",
      period: "alltid",
      description: "Perfekt for å komme i gang",
      features: [
        "5 gratis innlegg",
        "Alle plattformer",
        "AI Content Coach",
        "Ingen kredittkort påkrevd",
      ],
      current: subscription?.status === "trial",
    },
    {
      id: "pro",
      name: "Pro",
      price: "199 kr",
      period: "per måned",
      description: "For profesjonelle innholdsskapere",
      features: [
        "15 innlegg per måned",
        "Alle plattformer",
        "AI Content Coach",
        "Ubegrensede lagrede eksempler",
        "AI Coach Chat",
        "Personlig stemmetrening",
        "Prioritert support",
      ],
      current: subscription?.status === "active",
    },
  ];

  const handleUpgrade = (plan: "PRO_MONTHLY" | "PRO_YEARLY") => {
    createCheckoutMutation.mutate({ productKey: plan });
  };

  if (subscriptionLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isPro = subscription?.status === "active";
  const isTrial = subscription?.status === "trial";

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Din nåværende plan</h3>
        <Card className={isPro ? "border-2 border-primary bg-gradient-to-r from-primary/5 to-purple-500/5" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-2xl font-bold">{isPro ? "Pro" : "Gratis"}</h4>
                  <Badge>{subscription?.status === "active" ? "Aktiv" : "Prøveperiode"}</Badge>
                </div>
                <p className="text-muted-foreground mb-4">
                  {isTrial 
                    ? `Du bruker ${subscription?.postsGenerated || 0} av ${subscription?.trialPostsLimit || 5} gratis innlegg`
                    : `Du har ubegrenset antall innlegg`
                  }
                </p>
                {isTrial && (
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className="bg-gradient-to-r from-primary to-purple-600 h-2 rounded-full"
                      style={{ width: `${((subscription?.postsGenerated || 0) / (subscription?.trialPostsLimit || 5)) * 100}%` }}
                    ></div>
                  </div>
                )}
                {subscription?.subscriptionEndDate && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Fornyes: {new Date(subscription.subscriptionEndDate).toLocaleDateString("no-NO")}
                  </p>
                )}
              </div>
              {!isPro && (
                <Button 
                  className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
                  onClick={() => handleUpgrade("PRO_MONTHLY")}
                  disabled={createCheckoutMutation.isPending}
                >
                  {createCheckoutMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Oppgrader til Pro
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan Comparison */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Velg din plan</h3>
        <div className="grid md:grid-cols-2 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`border-2 transition-all cursor-pointer ${
                plan.current
                  ? "border-primary bg-primary/5"
                  : "border-gray-200 hover:border-primary"
              }`}
              onClick={() => setSelectedPlan(plan.id as "free" | "pro")}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {plan.current && <Badge className="bg-green-500">Aktiv</Badge>}
                </div>
                <div className="text-3xl font-bold">
                  {plan.price}
                  <span className="text-lg font-normal text-muted-foreground">
                    {" "}
                    / {plan.period}
                  </span>
                </div>
                <p className="text-muted-foreground">{plan.description}</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {!plan.current && (
                  <Button 
                    className="w-full bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
                    onClick={() => handleUpgrade(plan.id === "pro" ? "PRO_MONTHLY" : "PRO_YEARLY")}
                    disabled={createCheckoutMutation.isPending}
                  >
                    {createCheckoutMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Oppgrader nå
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Payment Methods */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Betalingsmåter</h3>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
              <div className="flex items-center gap-3">
                <CreditCard className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-semibold">Visa ending in 4242</p>
                  <p className="text-sm text-muted-foreground">Utløper 12/{new Date().getFullYear() + 2}</p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Endre
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice History */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Fakturahistorikk</h3>
        <Card>
          <CardContent className="pt-6">
            {invoicesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : invoices && invoices.length > 0 ? (
              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-semibold">Faktura #{invoice.id}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(invoice.invoiceDate).toLocaleDateString("no-NO")}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold">{(invoice.amount / 100).toFixed(2)} {invoice.currency}</p>
                        <Badge variant="outline" className={
                          invoice.status === "paid" ? "bg-green-50" : 
                          invoice.status === "pending" ? "bg-yellow-50" : 
                          "bg-red-50"
                        }>
                          {invoice.status === "paid" ? "Betalt" : 
                           invoice.status === "pending" ? "Venter" : 
                           "Mislyktes"}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Ingen fakturaer ennå</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Billing Info */}
      {subscription?.subscriptionEndDate && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-900 mb-1">
                  Neste faktura
                </h4>
                <p className="text-sm text-yellow-800">
                  Din abonnement fornyes automatisk {new Date(subscription.subscriptionEndDate).toLocaleDateString("no-NO")} for 199 kr.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cancel Subscription */}
      {isPro && (
        <div className="pt-4">
          <Button variant="outline" className="text-red-600 hover:text-red-700">
            Avbryt abonnement
          </Button>
        </div>
      )}
    </div>
  );
}