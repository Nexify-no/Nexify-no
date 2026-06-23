/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { XCircle, ArrowLeft, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function PaymentFailure() {
  const [location, navigate] = useLocation();
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.split("?")[1]);
    setOrderId(params.get("orderId"));
  }, [location]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <div className="p-8 text-center">
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-red-200 rounded-full animate-pulse"></div>
              <XCircle className="w-24 h-24 text-red-600 relative" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Betaling mislyktes
          </h1>
          <p className="text-gray-600 mb-6">
            Vi kunne dessverre ikke behandle betalingen din. Vennligst prøv igjen.
          </p>

          {orderId && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 mb-1">Ordre-ID</p>
              <p className="font-mono text-sm text-gray-900 break-all">{orderId}</p>
            </div>
          )}

          <div className="space-y-4 mb-6">
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 mb-3">
                Mulige årsaker:
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="text-red-600 mr-2">•</span>
                  <span>Utilstrekkelig dekning på kontoen</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-600 mr-2">•</span>
                  <span>Kortet ditt er blokkert eller utløpt</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-600 mr-2">•</span>
                  <span>Feil ved betalingsleverandør</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => navigate("/pricing")}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <RotateCw className="w-4 h-4 mr-2" />
              Prøv igjen
            </Button>
            <Button
              onClick={() => navigate("/support/tickets")}
              variant="outline"
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Kontakt support
            </Button>
          </div>

          <p className="text-xs text-gray-500 mt-6">
            Trenger du hjelp? Kontakt oss på support@innlegg.no eller bruk support-systemet vårt.
          </p>
        </div>
      </Card>
    </div>
  );
}