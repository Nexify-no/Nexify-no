/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2, Smartphone } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface VippsLoginProps {
  onSuccess?: (userInfo: any) => void;
  onError?: (error: string) => void;
  className?: string;
}

/**
 * Generate a random state token for CSRF protection
 */
function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Vipps Login Button Component
 */
export function VippsLoginButton({ onError, className = "" }: VippsLoginProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getLoginUrl = trpc.vipps.getLoginUrl.useMutation({
    onSuccess: (data) => {
      setIsLoading(false);
      // Store state in sessionStorage for verification
      sessionStorage.setItem("vipps_login_state", data.state);
      // Redirect to Vipps login
      window.location.href = data.url;
    },
    onError: (err) => {
      setIsLoading(false);
      const errorMessage = err.message || "Failed to initiate login";
      setError(errorMessage);
      onError?.(errorMessage);
    },
  });

  const handleLogin = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const state = generateRandomState();
      await getLoginUrl.mutateAsync({ state });
    } catch (err) {
      setIsLoading(false);
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      onError?.(errorMessage);
    }
  };

  return (
    <div className={className}>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        onClick={handleLogin}
        disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <Smartphone className="mr-2 h-4 w-4" />
            Login with Vipps
          </>
        )}
      </Button>
    </div>
  );
}

/**
 * Vipps Login Card Component
 */
export function VippsLoginCard({ onSuccess, onError }: VippsLoginProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="w-5 h-5" />
          Vipps Login
        </CardTitle>
        <CardDescription>Sign in with your Vipps account</CardDescription>
      </CardHeader>
      <CardContent>
        <VippsLoginButton onSuccess={onSuccess} onError={onError} />
        <p className="text-xs text-gray-500 text-center mt-4">
          You will be redirected to Vipps to complete the login process.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Vipps Login Callback Handler Component
 * Use this on your OAuth callback page (/auth/vipps/callback)
 */
export function VippsLoginCallback() {
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleCallback = trpc.vipps.handleLoginCallback.useMutation({
    onSuccess: (data) => {
      setIsProcessing(false);
      // Store user info and tokens
      localStorage.setItem("vipps_user", JSON.stringify(data.userInfo));
      localStorage.setItem("vipps_access_token", data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem("vipps_refresh_token", data.refreshToken);
      }
      // Redirect to dashboard or home
      window.location.href = "/dashboard";
    },
    onError: (err) => {
      setIsProcessing(false);
      setError(err.message || "Login failed");
    },
  });

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const storedState = sessionStorage.getItem("vipps_login_state");

    if (!code || !state) {
      setIsProcessing(false);
      setError("Missing authorization code or state");
      return;
    }

    if (state !== storedState) {
      setIsProcessing(false);
      setError("Invalid state parameter - possible CSRF attack");
      return;
    }

    // Clear stored state
    sessionStorage.removeItem("vipps_login_state");

    // Handle callback
    handleCallback.mutate({ code, state });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isProcessing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Processing your login...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="text-red-600">Login Failed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button asChild className="w-full">
              <a href="/login">Back to Login</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

/**
 * Hook to get current Vipps user info
 */
export function useVippsUser() {
  const [user, setUser] = React.useState<any | null>(null);

  React.useEffect(() => {
    const stored = localStorage.getItem("vipps_user");
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  return user;
}

/**
 * Hook to get Vipps access token
 */
export function useVippsAccessToken() {
  const [token, setToken] = React.useState<string | null>(null);

  React.useEffect(() => {
    const stored = localStorage.getItem("vipps_access_token");
    if (stored) {
      setToken(stored);
    }
  }, []);

  return token;
}

/**
 * Vipps Logout Function
 */
export async function vippsLogout() {
  const token = localStorage.getItem("vipps_access_token");

  if (token) {
    try {
      // Call logout endpoint
      await fetch("/api/trpc/vipps.logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: token }),
      });
    } catch (err) {
      console.error("Logout error:", err);
    }
  }

  // Clear local storage
  localStorage.removeItem("vipps_user");
  localStorage.removeItem("vipps_access_token");
  localStorage.removeItem("vipps_refresh_token");
}