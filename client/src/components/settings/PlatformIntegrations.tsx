/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Linkedin, Twitter, Instagram, Facebook, Trash2, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PrivacyNotice, OAuthFlowSteps } from "@/components/SecurityBadge";
import { OAuthWarningDialog } from "@/components/OAuthWarningDialog";
import { toast } from "sonner";

const PLATFORMS = [
  { name: "LinkedIn", icon: Linkedin, color: "bg-blue-600", id: "linkedin" },
  // Shown as "X" — the name on the product the user is about to be redirected
  // to. The platform VALUE stays "twitter" because that is the enum every table
  // in the schema already uses; renaming it would be a migration with nothing at
  // the end of it.
  { name: "X", icon: Twitter, color: "bg-neutral-900", id: "twitter" },
  // Instagram is not connected on its own. Meta reaches an Instagram
  // Professional account through the Facebook Page it is linked to, so the
  // Facebook card connects both and this card explains that rather than offering
  // a button that cannot work.
  { name: "Instagram", icon: Instagram, color: "bg-pink-600", id: "instagram", via: "facebook" as const },
  { name: "Facebook", icon: Facebook, color: "bg-blue-700", id: "facebook" },
];

export default function PlatformIntegrations() {
  const { language } = useLanguage();
  const [oauthDialog, setOauthDialog] = useState<{ open: boolean; platform: string | null }>({
    open: false,
    platform: null,
  });
  // Which platform is mid-connect — not a bare boolean, which disabled every
  // platform's button while one of them was starting.
  const [connecting, setConnecting] = useState<string | null>(null);
  const [pagePickerOpen, setPagePickerOpen] = useState(false);
  const utils = trpc.useUtils();
  // A mutation because minting the PKCE verifier is a write. As a cached query
  // a second attempt within 30s reused an authUrl whose verifier was spent.
  const xAuthUrl = trpc.platform.getXAuthUrl.useMutation();
  const { data: integrations, isLoading, refetch } = trpc.platform.getConnectedPlatforms.useQuery();
  // Which channels this installation can actually connect. Undefined while it
  // loads — treated as available so a slow query never flashes "Kommer snart"
  // at a user whose channel works.
  const { data: availability } = trpc.platform.getPlatformAvailability.useQuery();
  const metaPages = trpc.platform.listMetaPages.useQuery(undefined, { enabled: pagePickerOpen });
  const selectPage = trpc.platform.selectMetaPage.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.instagramConnected
          ? `Publiserer nå til ${result.pageName} og tilknyttet Instagram-konto`
          : `Publiserer nå til ${result.pageName}`,
      );
      setPagePickerOpen(false);
      refetch();
    },
    onError: (error: any) => toast.error(error?.message || "Kunne ikke bytte side"),
  });

  // The Meta callback redirects back here with the outcome in the query string.
  // Report it once, then strip it so a reload does not repeat the toast.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const xError = params.get("x_error");
    const xSuccess = params.get("x_success");
    if (xError || xSuccess) {
      if (xError) {
        const X_MESSAGES: Record<string, string> = {
          ugyldig_state: "Tilkoblingen tok for lang tid. Prøv igjen.",
          mangler_parametere: "X sendte ikke tilbake nok informasjon. Prøv igjen.",
          ikke_konfigurert: "X er ikke satt opp på denne installasjonen ennå.",
          access_denied: "Du avbrøt tilkoblingen til X.",
        };
        toast.error(X_MESSAGES[xError] || xError);
      } else {
        toast.success("X er koblet til");
        refetch();
      }
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    const error = params.get("meta_error");
    const success = params.get("meta_success");
    if (!error && !success) return;

    if (error) {
      const MESSAGES: Record<string, string> = {
        ingen_sider: "Fant ingen Facebook-side. Du må være administrator for minst én side.",
        ugyldig_state: "Tilkoblingen tok for lang tid. Prøv igjen.",
        mangler_parametere: "Facebook sendte ikke tilbake nok informasjon. Prøv igjen.",
        ikke_konfigurert: "Facebook er ikke satt opp på denne installasjonen ennå.",
      };
      toast.error(MESSAGES[error] || error);
    } else {
      toast.success(
        params.get("meta_instagram")
          ? "Facebook og Instagram er koblet til"
          : "Facebook er koblet til",
      );
      // Several Pages: the callback connected one, and the user should know they
      // can change it rather than discovering later that posts went to the wrong
      // Page.
      if (params.get("meta_pick")) setPagePickerOpen(true);
      refetch();
    }
    window.history.replaceState({}, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

  /**
   * Actually start the OAuth flow.
   *
   * This function used to be a `console.log`. The dialog opened, the user pressed
   * "Fortsett", the dialog closed, and nothing happened — which is why no Facebook
   * account has ever been connected to this product.
   */
  const handleConfirmOAuth = async () => {
    const platform = oauthDialog.platform;
    if (!platform) return;
    setOauthDialog({ open: false, platform: null });

    if (platform === "facebook" || platform === "instagram") {
      setConnecting(platform);
      try {
        const { authUrl } = await utils.platform.getMetaAuthUrl.fetch();
        window.location.href = authUrl;
      } catch (error: any) {
        setConnecting(null);
        toast.error(error?.message || "Kunne ikke starte Facebook-tilkoblingen");
      }
      return;
    }

    if (platform === "twitter") {
      setConnecting(platform);
      try {
        const { authUrl } = await xAuthUrl.mutateAsync();
        window.location.href = authUrl;
      } catch (error: any) {
        setConnecting(null);
        toast.error(error?.message || "Kunne ikke starte X-tilkoblingen");
      }
      return;
    }

    // The remaining platforms have no working connect flow. Say so instead of
    // pretending the click did something.
    toast.info(`${platform} er ikke tilgjengelig for tilkobling ennå.`);
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
          // Instagram rides on the Facebook connection, so it is available
          // exactly when Facebook is.
          const isAvailable =
            availability?.[platform.id as keyof typeof availability] ?? true;

          return (
            <Card
              key={platform.id}
              className={
                isConnected ? "border-green-200 bg-green-50/50" : !isAvailable ? "opacity-60" : ""
              }
            >
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
                  {isConnected ? (
                    <Badge variant="outline" className="bg-green-100 text-green-800">
                      Aktiv
                    </Badge>
                  ) : !isAvailable ? (
                    <Badge variant="outline">Kommer snart</Badge>
                  ) : null}
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

                    {platform.id === "facebook" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setPagePickerOpen(true)}
                      >
                        Bytt Facebook-side
                      </Button>
                    )}

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
                      {!isAvailable
                        // Say plainly that the channel is not open yet. The
                        // alternative — a live-looking button that fails on click
                        // — is what this screen used to do.
                        ? `${platform.name} er ikke åpnet for kunder ennå. Vi sier fra så snart den er klar.`
                        : platform.via === "facebook"
                        ? "Instagram kobles til sammen med Facebook-siden din. Kontoen må være en Professional-konto som er koblet til siden."
                        : platform.id === "twitter"
                          // Not "automatisk publisering": X is not in
                          // SUPPORTED_SCHEDULER_PLATFORMS and schedulingRouter
                          // rejects it, so promising scheduling here would send the
                          // user to a dialog that refuses them. Publishing to X is
                          // manual, and text-only until media upload exists.
                          ? "Koble til X-kontoen din for å publisere innlegg direkte. Bilder og planlegging kommer senere."
                          : `Koble til ${platform.name}-kontoen din for automatisk publisering`}
                    </p>
                    <Button
                      onClick={() => handleConnectPlatform(platform.id)}
                      className="w-full"
                      variant="outline"
                      disabled={connecting === platform.id || !isAvailable}
                    >
                      {connecting === platform.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {!isAvailable
                        ? "Kommer snart"
                        : platform.via === "facebook"
                        ? "Koble til via Facebook"
                        : `Koble til ${platform.name}`}
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

      {/* Which Facebook Page to publish to. Without this the connect flow simply
          took whichever Page Meta listed first — so an account that administers
          several would publish to an arbitrary one, with no way to tell or fix. */}
      <Dialog open={pagePickerOpen} onOpenChange={setPagePickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Velg Facebook-side</DialogTitle>
            <DialogDescription>
              Innlegg publiseres til siden du velger her — og til Instagram-kontoen som er koblet til den.
            </DialogDescription>
          </DialogHeader>

          {metaPages.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : metaPages.data?.needsReconnectToSwitch ? (
            <p className="text-sm text-muted-foreground">
              Denne tilkoblingen ble opprettet før sidebytte var mulig. Koble til Facebook på nytt for å bytte side.
            </p>
          ) : metaPages.data?.pages?.length ? (
            <div className="space-y-2">
              {metaPages.data.pages.map((page) => (
                <Button
                  key={page.id}
                  variant={page.isCurrent ? "default" : "outline"}
                  className="w-full justify-start gap-2"
                  disabled={selectPage.isPending || page.isCurrent}
                  onClick={() => selectPage.mutate({ pageId: page.id })}
                >
                  {page.isCurrent && <CheckCircle2 className="h-4 w-4" />}
                  <span className="truncate">{page.name}</span>
                  {page.instagramUsername && (
                    <Badge variant="secondary" className="ml-auto">
                      @{page.instagramUsername}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Fant ingen sider du er administrator for.
            </p>
          )}
        </DialogContent>
      </Dialog>

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