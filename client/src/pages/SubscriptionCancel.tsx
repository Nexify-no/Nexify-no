/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle, ArrowLeft, HelpCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function SubscriptionCancel() {
  const { loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex flex-col items-center gap-4"><div className="h-14 w-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div><p className="text-sm text-muted-foreground animate-pulse">Laster...</p></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-20 w-20 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center shadow-lg">
            <XCircle className="h-10 w-10 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-700">
            Betaling avbrutt
          </CardTitle>
          <CardDescription className="text-lg mt-2">
            Du har avbrutt betalingsprosessen
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Info message */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-gray-600 text-center">
              Ingen bekymring! Du kan prøve igjen når som helst. 
              Din prøveperiode er fortsatt aktiv.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-3">
            <Button 
              onClick={() => setLocation("/settings")}
              className="w-full bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Prøv igjen
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => setLocation("/dashboard")}
              className="w-full"
            >
              Gå til Dashboard
            </Button>
          </div>

          {/* Help info */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <HelpCircle className="h-4 w-4" />
            <span>
              Har du spørsmål?{" "}
              <a href="/contact" className="text-primary hover:underline">
                Kontakt oss
              </a>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}