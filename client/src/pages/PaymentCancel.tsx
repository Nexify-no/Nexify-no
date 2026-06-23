/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export function PaymentCancel() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertCircle className="w-16 h-16 text-yellow-600" />
          </div>
          <CardTitle className="text-2xl">Betaling avbrutt</CardTitle>
          <CardDescription>Abonnementet ditt ble ikke fullført</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-yellow-50 dark:bg-yellow-950 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Du avbrøt betalingsprosessen. Ditt abonnement ble ikke aktivert.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <strong>Hva kan du gjøre?</strong>
            </p>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li>• Prøv igjen ved å velge en plan og fullføre betalingen</li>
              <li>• Kontakt support hvis du har spørsmål om prisene</li>
              <li>• Bruk den gratis versjonen mens du bestemmer deg</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Button onClick={() => navigate("/settings/billing")} className="w-full">
              Prøv igjen
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              className="w-full"
            >
              Tilbake til Dashboard
            </Button>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4">
            <p className="text-xs text-blue-800 dark:text-blue-200">
              💡 <strong>Tips:</strong> Hvis du har problemer med betalingen, kan du kontakte oss på support@nexify.ai
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}