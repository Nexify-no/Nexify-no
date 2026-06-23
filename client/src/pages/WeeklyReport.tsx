/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Mail, TrendingUp, Calendar, BarChart3, CheckCircle2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PAGE_DESCRIPTIONS } from "@/lib/pageDescriptions";

export default function WeeklyReport() {
  trpc.auth.me.useQuery();
  const { data: subscription } = trpc.user.getSubscription.useQuery();
  trpc.reports.getSettings.useQuery();
  const [email, setEmail] = useState("");
  const [enabled, setEnabled] = useState(false);

  const updateSettingsMutation = trpc.reports.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Innstillinger lagret!");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const sendTestReportMutation = trpc.reports.sendTestReport.useMutation({
    onSuccess: () => {
      toast.success("Test-rapport sendt! Sjekk e-posten din.");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSaveSettings = () => {
    if (!email) {
      toast.error("Vennligst fyll inn e-postadresse");
      return;
    }
    updateSettingsMutation.mutate({ email, enabled });
  };

  const handleSendTest = () => {
    if (!email) {
      toast.error("Vennligst fyll inn e-postadresse først");
      return;
    }
    sendTestReportMutation.mutate({ email });
  };

  const isPro = subscription?.status === "active";

  if (!isPro) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="mb-8">
          <PageHeader title="Ukentlig Rapport" description={PAGE_DESCRIPTIONS.weeklyReport} />
          <p className="text-muted-foreground mt-2">
            Få automatiske ukentlige rapporter med innsikt og anbefalinger
          </p>
        </div>

        <Card className="p-8 text-center border-2 border-dashed">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mb-4">
            <Mail className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-xl font-semibold mb-2">🔒 Pro-funksjon</h3>
          <p className="text-muted-foreground mb-6">
            Ukentlige rapporter er kun tilgjengelig for Pro-abonnenter
          </p>
          <Button
            onClick={() => window.location.href = "/settings"}
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
          >
            Oppgrader til Pro
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
          📊 Ukentlig Rapport
        </h1>
        <p className="text-muted-foreground mt-2">
          Få automatiske ukentlige rapporter med innsikt og anbefalinger
        </p>
      </div>

      <div className="grid gap-6">
        {/* Settings Card */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Mail className="h-5 w-5 text-orange-500" />
            Rapport-innstillinger
          </h2>

          <div className="space-y-4">
            <div>
              <Label htmlFor="email">E-postadresse</Label>
              <Input
                id="email"
                type="email"
                placeholder="din@epost.no"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Rapporten sendes til denne adressen hver mandag kl. 09:00
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enabled">Aktiver ukentlig rapport</Label>
                <p className="text-sm text-muted-foreground">
                  Motta automatiske rapporter hver uke
                </p>
              </div>
              <Switch
                id="enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSaveSettings}
                disabled={updateSettingsMutation.isPending}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
              >
                {updateSettingsMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Lagrer...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Lagre innstillinger
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={handleSendTest}
                disabled={sendTestReportMutation.isPending}
              >
                {sendTestReportMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sender...
                  </>
                ) : (
                  "Send test-rapport nå"
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* What's Included Card */}
        <Card className="p-6 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 border-orange-200">
          <h2 className="text-xl font-semibold mb-4">📈 Hva inkluderes i rapporten?</h2>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white dark:bg-gray-800 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <h3 className="font-semibold">Ytelsesstatistikk</h3>
                <p className="text-sm text-muted-foreground">
                  Antall innlegg, engasjement, beste innlegg
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white dark:bg-gray-800 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <h3 className="font-semibold">Trender & Innsikt</h3>
                <p className="text-sm text-muted-foreground">
                  Hva fungerer best, anbefalte temaer
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white dark:bg-gray-800 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <h3 className="font-semibold">Kommende events</h3>
                <p className="text-sm text-muted-foreground">
                  Viktige datoer og anledninger å utnytte
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white dark:bg-gray-800 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <h3 className="font-semibold">Handlingsanbefalinger</h3>
                <p className="text-sm text-muted-foreground">
                  Konkrete tips for neste uke
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Info Card */}
        <Card className="p-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-500" />
            Slik fungerer det
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">1.</span>
              <span>Rapporten genereres automatisk hver søndag kveld</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">2.</span>
              <span>Du mottar e-posten hver mandag morgen kl. 09:00</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">3.</span>
              <span>Rapporten inneholder data fra de siste 7 dagene</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">4.</span>
              <span>Du kan når som helst deaktivere eller endre e-postadresse</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}