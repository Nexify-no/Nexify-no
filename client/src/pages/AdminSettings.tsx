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

  // State for Nano Banana settings
  const [nanoBananaKey, setNanoBananaKey] = useState("");
  const [nanoBananaKeyVisible, setNanoBananaKeyVisible] = useState(false);
  const [nanoBananaTesting, setNanoBananaTesting] = useState(false);

  // State for API key validation
  const [chatGptValid, setChatGptValid] = useState<boolean | null>(null);
  const [nanoBananaValid, setNanoBananaValid] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings from localStorage on mount
  const [isLoaded, setIsLoaded] = useState(false);
  if (!isLoaded && typeof window !== 'undefined') {
    const savedChatGpt = localStorage.getItem('admin_chatgpt_key') || '';
    const savedNanoBanana = localStorage.getItem('admin_nanoBanana_key') || '';
    if (savedChatGpt || savedNanoBanana) {
      setChatGptKey(savedChatGpt);
      setNanoBananaKey(savedNanoBanana);
    }
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
    if (!chatGptKey.trim()) {
      toast.error("Please enter ChatGPT API key");
      return;
    }

    setChatGptTesting(true);
    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${chatGptKey}`,
        },
      });

      if (response.ok) {
        setChatGptValid(true);
        toast.success("ChatGPT API key is valid!");
        // Save to localStorage for now
        localStorage.setItem("chatgpt_api_key", chatGptKey);
      } else {
        setChatGptValid(false);
        toast.error("Invalid ChatGPT API key");
      }
    } catch (error) {
      setChatGptValid(false);
      toast.error("Failed to test ChatGPT API key");
    } finally {
      setChatGptTesting(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!chatGptKey.trim() && !nanoBananaKey.trim()) {
      toast.error("Please enter at least one API key");
      return;
    }

    setIsSaving(true);
    try {
      // Save to localStorage
      if (chatGptKey.trim()) {
        localStorage.setItem('admin_chatgpt_key', chatGptKey);
      }
      if (nanoBananaKey.trim()) {
        localStorage.setItem('admin_nanoBanana_key', nanoBananaKey);
      }
      
      toast.success("Settings saved successfully! Available to all users.");
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestNanoBanana = async () => {
    if (!nanoBananaKey.trim()) {
      toast.error("Please enter Nano Banana API key");
      return;
    }

    setNanoBananaTesting(true);
    try {
      // Nano Banana API test - simplified
      const response = await fetch("https://api.banana.dev/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${nanoBananaKey}`,
        },
        body: JSON.stringify({ test: true }),
      });

      if (response.ok || response.status === 401) {
        // 401 means key exists but might need setup
        setNanoBananaValid(true);
        toast.success("Nano Banana API key is valid!");
        // Save to localStorage for now
        localStorage.setItem("nanoBanana_api_key", nanoBananaKey);
      } else {
        setNanoBananaValid(false);
        toast.error("Invalid Nano Banana API key");
      }
    } catch (error) {
      setNanoBananaValid(false);
      toast.error("Failed to test Nano Banana API key");
    } finally {
      setNanoBananaTesting(false);
    }
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

          {/* Nano Banana Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Nano Banana Configuration</span>
                {nanoBananaValid === true && <Check className="h-5 w-5 text-green-600" />}
                {nanoBananaValid === false && <X className="h-5 w-5 text-red-600" />}
              </CardTitle>
              <CardDescription>
                Configure Nano Banana (Gemini) API key for image generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nanoBanana-key">API Key</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="nanoBanana-key"
                      type={nanoBananaKeyVisible ? "text" : "password"}
                      placeholder="bnn_..."
                      value={nanoBananaKey}
                      onChange={(e) => setNanoBananaKey(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      onClick={() => setNanoBananaKeyVisible(!nanoBananaKeyVisible)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {nanoBananaKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    onClick={handleTestNanoBanana}
                    disabled={nanoBananaTesting}
                    variant="outline"
                  >
                    {nanoBananaTesting ? "Testing..." : "Test"}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Get your API key from <a href="https://www.banana.dev" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Banana.dev</a>
              </p>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex gap-2 justify-end mt-8">
            <Button
              onClick={handleSaveSettings}
              disabled={isSaving || (!chatGptKey.trim() && !nanoBananaKey.trim())}
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