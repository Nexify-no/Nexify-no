/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Sparkles, ArrowRight, Zap } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import confetti from "canvas-confetti";

export default function SubscriptionSuccess() {
  const { loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    // Trigger confetti animation
    if (!showConfetti) {
      setShowConfetti(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#22c55e", "#3b82f6", "#8b5cf6", "#f59e0b"],
      });
    }
  }, [showConfetti]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex flex-col items-center gap-4"><div className="h-14 w-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div><p className="text-sm text-muted-foreground animate-pulse">Laster...</p></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full shadow-xl border-green-200">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-20 w-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
            <CheckCircle2 className="h-10 w-10 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold text-green-600">
            Gratulerer! 🎉
          </CardTitle>
          <CardDescription className="text-lg mt-2">
            Du er nå Pro-medlem hos Nexify AI
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Features unlocked */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-100">
            <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Du har nå tilgang til:
            </h3>
            <ul className="space-y-2 text-sm text-green-700">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                100 AI-genererte innlegg per måned
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                AI-bildegenerering (DALL-E 3 + Nano Banana)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Stemmetrening - AI lærer din skrivestil
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Trend og Inspirasjon - Kuraterte emner
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                AI Content Coach
              </li>
            </ul>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-3">
            <Button 
              onClick={() => setLocation("/generate")}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:opacity-90 text-lg py-6"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Start å generere innhold
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => setLocation("/dashboard")}
              className="w-full"
            >
              Gå til Dashboard
            </Button>
          </div>

          {/* Support info */}
          <p className="text-center text-sm text-muted-foreground">
            Har du spørsmål? Kontakt oss på{" "}
            <a href="mailto:support@nexify.no" className="text-primary hover:underline">
              support@nexify.no
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}