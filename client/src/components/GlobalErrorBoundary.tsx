/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
    this.setState({ error, errorInfo });
    
    // Log to error tracking service (if configured)
    if (typeof window !== "undefined" && (window as any).errorTracker) {
      (window as any).errorTracker.logError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = "/dashboard";
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Noe gikk galt</CardTitle>
                  <CardDescription>
                    Vi beklager, men noe uventet skjedde
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Error Details (for development) */}
                {process.env.NODE_ENV === "development" && this.state.error && (
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="font-mono text-sm text-red-600 mb-2">
                      {this.state.error.toString()}
                    </p>
                    {this.state.errorInfo && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-muted-foreground">
                          Stack trace
                        </summary>
                        <pre className="mt-2 text-xs overflow-auto max-h-64">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                )}

                {/* User-friendly message */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    <strong>Hva kan du gjøre?</strong>
                  </p>
                  <ul className="mt-2 text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li>Prøv å laste siden på nytt</li>
                    <li>Gå tilbake til dashboard</li>
                    <li>Hvis problemet vedvarer, kontakt support</li>
                  </ul>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    onClick={this.handleReload}
                    className="flex-1"
                    variant="default"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Last på nytt
                  </Button>
                  <Button
                    onClick={this.handleReset}
                    className="flex-1"
                    variant="outline"
                  >
                    <Home className="h-4 w-4 mr-2" />
                    Gå til Dashboard
                  </Button>
                </div>

                {/* Support link */}
                <div className="text-center pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Trenger du hjelp?{" "}
                    <a
                      href="/contact"
                      className="text-primary hover:underline"
                    >
                      Kontakt support
                    </a>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}