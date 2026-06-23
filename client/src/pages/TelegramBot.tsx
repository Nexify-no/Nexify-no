/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, Check, Copy, ExternalLink, RefreshCw, Unlink } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { PAGE_DESCRIPTIONS } from "@/lib/pageDescriptions";

export default function TelegramBot() {
  const [linkCode, setLinkCode] = useState("");
  const { data: status, refetch } = trpc.telegram.getStatus.useQuery();
  const { data: subscription } = trpc.user.getSubscription.useQuery();

  const generateCodeMutation = trpc.telegram.generateLinkCode.useMutation({
    onSuccess: (data) => {
      setLinkCode(data.linkCode);
      toast.success("Koblingskode generert!");
    },
    onError: () => {
      toast.error("Kunne ikke generere kode");
    },
  });

  const disconnectMutation = trpc.telegram.disconnect.useMutation({
    onSuccess: () => {
      setLinkCode("");
      refetch();
      toast.success("Telegram frakoblet");
    },
    onError: () => {
      toast.error("Kunne ikke frakoble");
    },
  });

  const isPro = subscription?.status === "active";
  const isConnected = status?.connected || false;

  const copyCode = () => {
    if (linkCode) {
      navigator.clipboard.writeText(linkCode);
      toast.success("Kode kopiert!");
    }
  };

  const handleGenerateCode = () => {
    if (!isPro) {
      toast.error("Telegram Bot krever Pro-abonnement");
      return;
    }
    generateCodeMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <main className="container py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <Send className="h-6 w-6 text-white" />
            </div>
            <div>
              <PageHeader title="Telegram Bot" description={PAGE_DESCRIPTIONS.telegramBot} />
              <p className="text-muted-foreground">
                Send idéer via Telegram og få innlegg tilbake
              </p>
            </div>
          </div>

          {!isPro && (
            <Card className="p-4 border-orange-200 bg-orange-50">
              <p className="text-sm text-orange-900">
                ⚠️ Telegram Bot krever Pro-abonnement. Oppgrader for å bruke denne funksjonen.
              </p>
            </Card>
          )}
        </div>

        {/* Connection Status */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className="h-8 w-8 text-blue-500" />
              <div>
                <h2 className="font-semibold">@Nexifynorgebot</h2>
                <p className="text-sm text-muted-foreground">
                  {isConnected ? "Koblet til" : "Ikke koblet"}
                </p>
              </div>
            </div>
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? "Aktiv" : "Inaktiv"}
            </Badge>
          </div>

          {isConnected && status?.telegramFirstName && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-900">
                ✅ Koblet til Telegram som <strong>{status.telegramFirstName}</strong>
                {status.telegramUsername && ` (@${status.telegramUsername})`}
              </p>
            </div>
          )}
        </Card>

        {/* Setup Instructions */}
        {!isConnected ? (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Koble til Telegram</h2>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-blue-600">1</span>
                </div>
                <div>
                  <p className="font-medium">Generer koblingskode</p>
                  <p className="text-sm text-muted-foreground">
                    Klikk på knappen nedenfor for å generere en unik 8-sifret kode
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-6 w-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-blue-600">2</span>
                </div>
                <div>
                  <p className="font-medium">Åpne Telegram</p>
                  <p className="text-sm text-muted-foreground">
                    Søk etter <strong>@Nexifynorgebot</strong> eller{" "}
                    <a
                      href="https://t.me/Nexifynorgebot"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      klikk her
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-6 w-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-blue-600">3</span>
                </div>
                <div>
                  <p className="font-medium">Send koblingskoden</p>
                  <p className="text-sm text-muted-foreground">
                    Trykk /start og send den 8-sifrede koden til boten
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-6 w-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-blue-600">4</span>
                </div>
                <div>
                  <p className="font-medium">Ferdig!</p>
                  <p className="text-sm text-muted-foreground">
                    Nå kan du sende idéer til boten og få innlegg tilbake
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t">
              {linkCode ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                      <p className="text-2xl font-mono font-bold text-center tracking-widest text-blue-600">
                        {linkCode}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copyCode}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Koden utløper om 10 minutter
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleGenerateCode}
                    disabled={generateCodeMutation.isPending}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Generer ny kode
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleGenerateCode}
                  disabled={!isPro || generateCodeMutation.isPending}
                  className="w-full"
                  size="lg"
                >
                  {generateCodeMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Genererer...
                    </>
                  ) : (
                    <>
                      <Bot className="h-4 w-4 mr-2" />
                      Generer koblingskode
                    </>
                  )}
                </Button>
              )}
            </div>
          </Card>
        ) : (
          /* Connected - Show Usage */
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Slik bruker du boten</h2>
            
            <div className="space-y-4 mb-6">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium mb-2">💡 Send en idé</p>
                <p className="text-sm text-muted-foreground">
                  Åpne Telegram og send en melding til @Nexifynorgebot med idéen din.
                  Boten genererer automatisk et innlegg basert på idéen.
                </p>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium mb-2">📝 Eksempel</p>
                <p className="text-sm text-muted-foreground italic">
                  "Jeg vil skrive om viktigheten av kaffe i arbeidslivet"
                </p>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium mb-2">⚡ Rask og enkelt</p>
                <p className="text-sm text-muted-foreground">
                  Boten svarer innen få sekunder med et ferdig innlegg som du kan
                  se og redigere på innlegg.no
                </p>
              </div>
            </div>

            <Button
              variant="destructive"
              className="w-full"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
            >
              <Unlink className="h-4 w-4 mr-2" />
              Frakoble Telegram
            </Button>
          </Card>
        )}

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          <Card className="p-4">
            <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
              <Send className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="font-semibold mb-2">Rask innsending</h3>
            <p className="text-sm text-muted-foreground">
              Send idéer når som helst, direkte fra Telegram
            </p>
          </Card>

          <Card className="p-4">
            <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <h3 className="font-semibold mb-2">Automatisk generering</h3>
            <p className="text-sm text-muted-foreground">
              Boten lager innlegget automatisk og lagrer det
            </p>
          </Card>

          <Card className="p-4">
            <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
              <Bot className="h-5 w-5 text-purple-600" />
            </div>
            <h3 className="font-semibold mb-2">Alltid tilgjengelig</h3>
            <p className="text-sm text-muted-foreground">
              Boten er aktiv 24/7 og svarer umiddelbart
            </p>
          </Card>
        </div>
      </main>
    </div>
  );
}