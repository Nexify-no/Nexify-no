/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Linkedin, Twitter, Instagram, Facebook, Trash2, CheckCircle2 } from "lucide-react";
import { PrivacyNotice, OAuthFlowSteps } from "@/components/SecurityBadge";
import { OAuthWarningDialog } from "@/components/OAuthWarningDialog";
import { toast } from "sonner";

const PLATFORMS = [
  { name: "LinkedIn", icon: Linkedin, color: "bg-blue-600", id: "linkedin" },
  { name: "Twitter", icon: Twitter, color: "bg-sky-500", id: "twitter" },
  { name: "Instagram", icon: Instagram, color: "bg-pink-600", id: "instagram" },
  { name: "Facebook", icon: Facebook, color: "bg-blue-700", id: "facebook" },
];

export default function PlatformIntegrations() {
  const { language } = useLanguage();
  const [oauthDialog, setOauthDialog] = useState<{ open: boolean; platform: string | null }>({
    open: false,
    platform: null,
  });
  const { data: integrations, isLoading, refetch } = trpc.platform.getConnectedPlatforms.useQuery();
  const disconnectMutation = trpc.platform.disconnectPlatform.useMutation({
    onSuccess: () => {
      toast.success("Tilkoblingen ble fjernet");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Kunne ikke koble fra");
    },
  });

  const handleDisconnect = (platform: string) => {
    disconnectMutation.mutate({ platform: platform as "linkedin" | "twitter" | "instagram" | "facebook" });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const connectedPlatforms = integrations?.platforms || [];

  const handleConnectPlatform = (platform: string) => {
    setOauthDialog({ open: true, platform });
  };

  const handleConfirmOAuth = async () => {
    if (!oauthDialog.platform) return;
    console.log("Connecting to", oauthDialog.platform);
    setOauthDialog({ open: false, platform: null });
  };

  return (
    <div className="space-y-6">
      {/* Security Notice */}
      <PrivacyNotice language={language || "no"} />
      <OAuthFlowSteps language={language || "no"} />

      <div className="grid gap-4 md:grid-cols-2">
        {PLATFORMS.map((platform) => {
          const Icon = platform.icon;
          const isConnected = integrations?.platforms?.includes(platform.id) || false;

          return (
            <Card key={platform.id} className={isConnected ? "border-green-200 bg-green-50/50" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`${platform.color} p-2 rounded-lg text-white`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{platform.name}</CardTitle>
                      {isConnected && (
                        <CardDescription className="flex items-center gap-1 text-green-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Tilkoblet
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  {isConnected && (
                    <Badge variant="outline" className="bg-green-100 text-green-800">
                      Aktiv
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {isConnected ? (
                  <>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-semibold">Status:</span> Tilkoblet
                      </div>
                    </div>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDisconnect(platform.id)}
                      disabled={disconnectMutation.isPending}
                      className="w-full gap-2"
                    >
                      {disconnectMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Koble fra
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Koble til {platform.name}-kontoen din for automatisk publisering
                    </p>
                    <Button
                      onClick={() => handleConnectPlatform(platform.id)}
                      className="w-full"
                      variant="outline"
                    >
                      Koble til {platform.name}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {connectedPlatforms.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="text-base">Tilkoblede plattformer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Du har {connectedPlatforms.length} tilkoblede plattformer. Du kan publisere innhold automatisk til alle disse.
            </p>
          </CardContent>
        </Card>
      )}

      {/* OAuth Warning Dialog */}
      {oauthDialog.platform && (
        <OAuthWarningDialog
          platform={oauthDialog.platform as any}
          language={language || "no"}
          open={oauthDialog.open}
          onOpenChange={(open) => setOauthDialog({ ...oauthDialog, open })}
          onConfirm={handleConfirmOAuth}
          isLoading={false}
        />
      )}
    </div>
  );
}