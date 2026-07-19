/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Check, X } from "lucide-react";

export default function AdminSettings() {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  useLocation();

  // Check if user is admin
  const isAdmin = user?.role === "admin";

  // State for ChatGPT settings
  const [chatGptKey, setChatGptKey] = useState("");
  const [chatGptKeyVisible, setChatGptKeyVisible] = useState(false);
  const [chatGptTesting, setChatGptTesting] = useState(false);

  // State for API key validation
  const [chatGptValid, setChatGptValid] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings from localStorage on mount
  const [isLoaded, setIsLoaded] = useState(false);
  if (!isLoaded && typeof window !== 'undefined') {
    setIsLoaded(true);
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex flex-col items-center gap-4">
          <div className="h-14 w-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
          <p className="text-sm text-muted-foreground animate-pulse">Laster...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Admin Settings</h1>
          <p className="text-muted-foreground mt-2">Configure AI services and integrations</p>
        </div>
          
          <Card className="mt-8 border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <X className="h-6 w-6 text-red-600" />
                <div>
                  <p className="font-semibold text-red-900 dark:text-red-100">Access Denied</p>
                  <p className="text-sm text-red-800 dark:text-red-200">Only administrators can access this page.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const handleTestChatGPT = async () => {
    // SECURITY: never send a raw API key from the browser to api.openai.com (it
    // would be exposed in the Network tab and to any injected script), and never
    // persist it in localStorage. The OpenAI key is configured SERVER-SIDE via
    // the OPENAI_API_KEY environment variable and is used only by the backend.
    toast.info(
      "OpenAI-nøkkelen settes server-side via OPENAI_API_KEY (miljøvariabel) og kan ikke testes eller lagres fra nettleseren."
    );
  };

  const handleSaveSettings = async () => {
    // SECURITY: do NOT store API keys in localStorage (readable by any XSS). The
    // OpenAI key is managed server-side via the OPENAI_API_KEY environment
    // variable — there is nothing to persist from the browser.
    toast.info(
      "API-nøkler konfigureres server-side (miljøvariabler), ikke fra nettleseren. Kontakt drift for å endre OPENAI_API_KEY."
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Admin Settings</h1>
          <p className="text-muted-foreground mt-2">Configure AI services and integrations for all users</p>
        </div>

        <div className="grid gap-6 mt-8">
          {/* ChatGPT Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>ChatGPT Configuration</span>
                {chatGptValid === true && <Check className="h-5 w-5 text-green-600" />}
                {chatGptValid === false && <X className="h-5 w-5 text-red-600" />}
              </CardTitle>
              <CardDescription>
                Configure OpenAI ChatGPT API key for content generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="chatgpt-key">API Key</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="chatgpt-key"
                      type={chatGptKeyVisible ? "text" : "password"}
                      placeholder="sk-..."
                      value={chatGptKey}
                      onChange={(e) => setChatGptKey(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      onClick={() => setChatGptKeyVisible(!chatGptKeyVisible)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {chatGptKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    onClick={handleTestChatGPT}
                    disabled={chatGptTesting}
                    variant="outline"
                  >
                    {chatGptTesting ? "Testing..." : "Test"}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OpenAI Platform</a>
              </p>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex gap-2 justify-end mt-8">
            <Button
              onClick={handleSaveSettings}
              disabled={isSaving || !chatGptKey.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </div>

          {/* Info Card */}
          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-900 dark:text-blue-100">ℹ️ Admin Settings Info</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
              <p>• These settings are stored securely and available to all users in your workspace</p>
              <p>• API keys are encrypted and never exposed to the frontend</p>
              <p>• Test your keys before saving to ensure they work correctly</p>
              <p>• Only administrators can modify these settings</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}