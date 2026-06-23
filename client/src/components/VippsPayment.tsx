/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2, CreditCard } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface VippsPaymentProps {
  amount: number; // Amount in øre (1 NOK = 100 øre)
  description: string;
  orderId?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export function VippsPayment({
  amount,
  description,
  orderId,
  onSuccess,
  onError,
  className = "",
}: VippsPaymentProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiatePayment = trpc.vipps.initiatePayment.useMutation({
    onSuccess: (data) => {
      setIsLoading(false);
      // Open Vipps payment in new tab
      window.open(data.url, "_blank");
      onSuccess?.();
    },
    onError: (err) => {
      setIsLoading(false);
      const errorMessage = err.message || "Payment initiation failed";
      setError(errorMessage);
      onError?.(errorMessage);
    },
  });

  const handlePayment = async () => {
    setError(null);
    setIsLoading(true);

    try {
      await initiatePayment.mutateAsync({
        amount,
        orderId: orderId || `order-${Date.now()}`,
        description,
        fallbackUrl: window.location.href,
      });
    } catch (err) {
      setIsLoading(false);
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      onError?.(errorMessage);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Pay with Vipps
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Amount Display */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Total Amount</div>
          <div className="text-3xl font-bold text-gray-900">
            {(amount / 100).toFixed(2)} NOK
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Payment Button */}
        <Button
          onClick={handlePayment}
          disabled={isLoading || amount <= 0}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Pay {(amount / 100).toFixed(2)} NOK
            </>
          )}
        </Button>

        {/* Info Text */}
        <p className="text-xs text-gray-500 text-center">
          You will be redirected to Vipps to complete the payment. Please keep this window open.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Vipps Payment Dialog Component
 * Use this for modal-based payments
 */
export function VippsPaymentDialog({
  amount,
  description,
  orderId,
  onSuccess,
  onClose,
}: VippsPaymentProps & { onClose?: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <VippsPayment
          amount={amount}
          description={description}
          orderId={orderId}
          onSuccess={() => {
            onSuccess?.();
            onClose?.();
          }}
          onError={() => {
            // Error is displayed in the component
          }}
        />
      </div>
    </div>
  );
}

/**
 * Quick Vipps Payment Button
 * Minimal button for quick payments
 */
export function VippsPaymentButton({
  amount,
  description,
  orderId,
  onSuccess,
  onError,
  className = "",
  size = "default",
}: VippsPaymentProps & { size?: "sm" | "default" | "lg" }) {
  const [isLoading, setIsLoading] = useState(false);

  const initiatePayment = trpc.vipps.initiatePayment.useMutation({
    onSuccess: (data) => {
      setIsLoading(false);
      window.open(data.url, "_blank");
      onSuccess?.();
    },
    onError: (err) => {
      setIsLoading(false);
      onError?.(err.message || "Payment failed");
    },
  });

  const handleClick = async () => {
    setIsLoading(true);
    try {
      await initiatePayment.mutateAsync({
        amount,
        orderId: orderId || `order-${Date.now()}`,
        description,
        fallbackUrl: window.location.href,
      });
    } catch (err) {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      className={`bg-blue-600 hover:bg-blue-700 text-white ${className}`}
      size={size}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <CreditCard className="mr-2 h-4 w-4" />
          Pay with Vipps
        </>
      )}
    </Button>
  );
}