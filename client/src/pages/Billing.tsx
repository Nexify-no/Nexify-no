/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Check, Loader2, CreditCard, Download } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumb } from "@/components/Breadcrumb";

export function BillingPage() {
  const [isLoading, setIsLoading] = useState(false);

  // Queries
  const { data: currentSubscription, isLoading: subscriptionLoading } = trpc.payment.getCurrentSubscription.useQuery();
  const { data: subscriptionUsage, isLoading: usageLoading } = trpc.payment.getSubscriptionUsage.useQuery();
  const { data: billingHistory = [], isLoading: historyLoading } = trpc.payment.getBillingHistory.useQuery();
  const { data: pricingPlans = [] } = trpc.payment.getPricingPlans.useQuery();

  // Mutations
  const createCheckoutMutation = trpc.payment.createCheckoutSession.useMutation();
  const createPortalMutation = trpc.payment.createBillingPortalSession.useMutation();
  const cancelSubscriptionMutation = trpc.payment.cancelSubscription.useMutation();
  const generateInvoicePDFMutation = trpc.payment.generateInvoicePDF.useMutation();

  const handleUpgrade = async (productKey: string) => {
    setIsLoading(true);
    try {
      const result = await createCheckoutMutation.mutateAsync({ productKey: productKey as "FREE" | "PRO_MONTHLY" | "PRO_YEARLY" | "ENTERPRISE_MONTHLY" | "ENTERPRISE_YEARLY" });
      if (result.url) {
        window.open(result.url, "_blank");
      }
    } catch (error) {
      console.error("Upgrade error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setIsLoading(true);
    try {
      const result = await createPortalMutation.mutateAsync();
      if (result.url) {
        window.open(result.url, "_blank");
      }
    } catch (error) {
      console.error("Billing portal error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (confirm("Er du sikker på at du vil avbryte abonnementet? Du vil fortsatt ha tilgang til slutten av faktureringsperioden.")) {
      try {
        await cancelSubscriptionMutation.mutateAsync({ reason: "User requested cancellation" });
        // Refresh subscription data
      } catch (error) {
        console.error("Cancel subscription error:", error);
      }
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "FREE":
        return "bg-gray-100 text-gray-800";
      case "PRO":
        return "bg-blue-100 text-blue-800";
      case "ENTERPRISE":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTierLabel = (tier: string) => {
    switch (tier) {
      case "FREE":
        return "Gratis";
      case "PRO":
        return "Pro";
      case "ENTERPRISE":
        return "Premium";
      default:
        return tier;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Fakturering"
        description="Administrer abonnementet ditt og betalingshistorikken"
      />

      <Breadcrumb
        items={[
          { label: "Innstillinger", href: "/settings" },
          { label: "Fakturering", href: "/settings/billing" },
        ]}
      />

      <div className="container max-w-6xl mx-auto px-4 py-8">
        {/* Current Subscription */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Gjeldende abonnement</h2>

          {subscriptionLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">
                      {getTierLabel(currentSubscription?.tier || "FREE")}
                    </CardTitle>
                    <CardDescription>
                      Status: {currentSubscription?.status}
                    </CardDescription>
                  </div>
                  <Badge className={getTierColor(currentSubscription?.tier || "FREE")}>
                    {getTierLabel(currentSubscription?.tier || "FREE")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentSubscription?.currentPeriodStart && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Periode starter</p>
                      <p className="font-medium">
                        {currentSubscription?.currentPeriodStart ? new Date(currentSubscription.currentPeriodStart).toLocaleDateString("no-NO") : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Periode slutter</p>
                      <p className="font-medium">
                        {currentSubscription?.currentPeriodEnd ? new Date(currentSubscription.currentPeriodEnd).toLocaleDateString("no-NO") : "N/A"}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  {currentSubscription?.tier === "FREE" && (
                    <Button onClick={() => handleUpgrade("PRO_MONTHLY")} disabled={isLoading}>
                      {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Oppgrader til Pro
                    </Button>
                  )}

                  {currentSubscription?.tier !== "FREE" && (
                    <>
                      <Button variant="outline" onClick={handleManageBilling} disabled={isLoading}>
                        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                        Administrer betaling
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleCancelSubscription}
                        disabled={cancelSubscriptionMutation.isPending}
                      >
                        {cancelSubscriptionMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : null}
                        Avbryt abonnement
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Usage */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Bruk</h2>

          {usageLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Innlegg</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {subscriptionUsage?.postsUsed || 0}/{subscriptionUsage?.postsLimit === -1 ? "∞" : subscriptionUsage?.postsLimit}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">AI-genererte innlegg denne måneden</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: subscriptionUsage?.postsLimit === -1
                          ? "100%"
                          : `${Math.min(100, ((subscriptionUsage?.postsUsed || 0) / (subscriptionUsage?.postsLimit || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Plattformer</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {subscriptionUsage?.platformsUsed || 0}/{subscriptionUsage?.platformsLimit}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Tilkoblede plattformer</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">AI-bilder</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {subscriptionUsage?.aiImagesUsed || 0}/{subscriptionUsage?.aiImagesLimit === -1 ? "∞" : subscriptionUsage?.aiImagesLimit}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">AI-genererte bilder denne måneden</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Pricing Plans */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Oppgraderingsalternativer</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pricingPlans?.map((plan: any) => (
              <Card key={plan.key} className={plan.key.includes("ENTERPRISE") ? "border-purple-500 border-2" : ""}>
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-3xl font-bold">
                    {plan.priceNOK === 0 ? "Gratis" : `${plan.priceNOK} NOK`}
                    {plan.priceNOK !== 0 && <span className="text-sm text-muted-foreground">/{plan.interval === "month" ? "mnd" : "år"}</span>}
                  </div>

                  <ul className="space-y-2">
                    {plan.features.map((feature: any, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {plan.key !== "FREE" && (
                    <Button
                      className="w-full"
                      onClick={() => handleUpgrade(plan.key as string)}
                      disabled={isLoading || currentSubscription?.tier === "PRO"}
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Velg plan
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Billing History */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Betalingshistorikk</h2>

          {historyLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : billingHistory && billingHistory.length > 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {billingHistory.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between border-b pb-4 last:border-b-0">
                      <div>
                        <p className="font-medium">{invoice.description || "Faktura"}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(invoice.date).toLocaleDateString("no-NO")}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-medium">{invoice.amount} {invoice.currency}</p>
                          <Badge variant={invoice.status === "paid" ? "default" : "secondary"}>
                            {invoice.status === "paid" ? "Betalt" : "Utestående"}
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const result = await generateInvoicePDFMutation.mutateAsync({
                                invoiceNumber: invoice.id,
                              });
                              const link = document.createElement("a");
                              link.href = `data:application/pdf;base64,${result.pdf}`;
                              link.download = result.filename;
                              link.click();
                            } catch (error) {
                              console.error("PDF download error:", error);
                            }
                          }}
                          disabled={generateInvoicePDFMutation.isPending}
                        >
                          {generateInvoicePDFMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Ingen betalingshistorikk ennå</AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}