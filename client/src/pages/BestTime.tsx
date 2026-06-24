/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, TrendingUp, Calendar, Info, Moon, RefreshCw, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PAGE_DESCRIPTIONS } from "@/lib/pageDescriptions";
import { trpc } from "@/lib/trpc";

type PlatformKey = "linkedin" | "twitter" | "instagram" | "facebook";

export default function BestTime() {
  const daysOfWeek = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];

  // General industry benchmarks for the Norwegian market — NOT based on the
  // user's own account data. Widely-cited best-practice windows per platform.
  // Used as the honest fallback while loading, on error, or when the user has no
  // personalized engagement data yet.
  const bestTimes: Record<PlatformKey, { bestDays: number[]; bestHours: number[] }> = {
    linkedin: { bestDays: [2, 3, 4], bestHours: [8, 9, 12, 17] },
    twitter: { bestDays: [1, 2, 5], bestHours: [10, 13, 19, 21] },
    instagram: { bestDays: [0, 3, 6], bestHours: [11, 15, 19, 20] },
    facebook: { bestDays: [2, 4, 5], bestHours: [9, 12, 18, 20] },
  };

  const overviewQuery = trpc.scheduling.getBestTimesOverview.useQuery(undefined, {
    retry: false,
  });
  const refreshMutation = trpc.scheduling.refreshMyMetrics.useMutation({
    onSettled: () => {
      void overviewQuery.refetch();
    },
  });

  const overview = overviewQuery.data;

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      linkedin: "from-blue-500 to-blue-600",
      twitter: "from-sky-400 to-sky-500",
      instagram: "from-pink-500 to-purple-500",
      facebook: "from-blue-600 to-indigo-600",
    };
    return colors[platform] || "from-gray-500 to-gray-600";
  };

  const formatHour = (hour: number) => `${hour.toString().padStart(2, "0")}:00`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <main className="container py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div>
                <PageHeader title="Beste Tid" description={PAGE_DESCRIPTIONS.bestTime} />
                <p className="text-muted-foreground">
                  Anbefalinger for beste publiseringstidspunkt — personlig der vi har data
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? "animate-spin" : ""}`}
              />
              {refreshMutation.isPending ? "Oppdaterer…" : "Oppdater data"}
            </Button>
          </div>

          {/* Honest disclaimer — explains personalized vs general */}
          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 mb-6">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-200">
                    Slik beregnes anbefalingene
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Når vi har nok engasjementsdata fra dine egne publiserte innlegg, viser vi
                    personlige beste tidspunkter (grønt merke). Ellers viser vi alminnelige
                    bransjestandarder for det norske markedet. Vi finner aldri opp tall — det som
                    vises er enten dine faktiske data eller tydelig merkede generelle anbefalinger.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* General highlights — no fabricated account metrics */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Beste dag (generelt)</span>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">Onsdag</p>
              <p className="text-xs text-muted-foreground">På tvers av plattformer</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Beste morgentid</span>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">09:00</p>
              <p className="text-xs text-muted-foreground">Morgenrush</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Beste kveldstid</span>
                <Moon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">20:00</p>
              <p className="text-xs text-muted-foreground">Prime time</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Datakilde</span>
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">Bransjestandard</p>
              <p className="text-xs text-muted-foreground">Norske markedet</p>
            </CardContent>
          </Card>
        </div>

        {/* Platform-specific recommendations — personalized when data exists */}
        <div className="grid md:grid-cols-2 gap-6">
          {(Object.keys(bestTimes) as PlatformKey[]).map((platform) => {
            const fallback = bestTimes[platform];
            const data = overview?.[platform];
            const isPersonalized = data?.source === "personalized";
            const hasPendingData =
              data?.source === "general" && (data?.totalPosts ?? 0) > 0;

            // Derive display slots.
            const personalizedSlots = isPersonalized ? data!.slots : [];
            const personalizedDays = isPersonalized
              ? Array.from(new Set(data!.slots.map((s) => s.dayOfWeek)))
              : [];
            const personalizedHours = isPersonalized
              ? Array.from(new Set(data!.slots.map((s) => s.hour)))
              : [];

            const displayDays = isPersonalized ? personalizedDays : fallback.bestDays;
            const displayHours = isPersonalized ? personalizedHours : fallback.bestHours;

            return (
              <Card key={platform} className="overflow-hidden">
                <div className={`h-2 bg-gradient-to-r ${getPlatformColor(platform)}`} />
                <CardHeader>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="capitalize">{platform}</CardTitle>
                    {isPersonalized ? (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Basert på dine {data!.totalPosts} innlegg
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Generell standard
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    {isPersonalized
                      ? "Personlige anbefalinger fra dine faktiske resultater"
                      : "Generelle anbefalinger for det norske markedet"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Best Days */}
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Beste dager
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {displayDays.map((day) => (
                          <Badge
                            key={day}
                            className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                          >
                            {daysOfWeek[day]}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Best Hours */}
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Beste tidspunkter
                      </h4>
                      {isPersonalized ? (
                        <div className="space-y-2">
                          {personalizedSlots.map((slot, i) => (
                            <div
                              key={`${slot.dayOfWeek}-${slot.hour}-${i}`}
                              className="flex items-center justify-between bg-muted rounded-lg p-2 text-sm"
                            >
                              <span className="font-medium">
                                {daysOfWeek[slot.dayOfWeek]} {formatHour(slot.hour)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Score {slot.score}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-2">
                          {displayHours.map((hour) => (
                            <div
                              key={hour}
                              className="bg-muted rounded-lg p-2 text-center text-sm font-medium"
                            >
                              {formatHour(hour)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Status note */}
                    {isPersonalized ? (
                      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-3">
                        <p className="text-sm text-green-900 dark:text-green-200">
                          <strong>✅ Personlig:</strong> Beregnet fra engasjementet på dine egne{" "}
                          {data!.totalPosts} publiserte innlegg på {platform}.
                        </p>
                      </div>
                    ) : hasPendingData ? (
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
                        <p className="text-sm text-amber-900 dark:text-amber-200">
                          <strong>⏳ Venter:</strong> Vi har {data!.totalPosts} innlegg – venter på
                          engasjementsdata fra plattformen.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
                        <p className="text-sm text-blue-900 dark:text-blue-200">
                          <strong>ℹ️ Generelle bransjestandarder.</strong>{" "}
                          {platform === "linkedin"
                            ? "Publiser på hverdager mellom 08-09 for maksimal rekkevidde blant profesjonelle."
                            : platform === "twitter"
                              ? "Tidlig morgen og sen ettermiddag gir best engasjement."
                              : platform === "instagram"
                                ? "Helger og kvelder er best for visuelt innhold."
                                : "Lunsj og kveldstid fungerer best for Facebook-publikum."}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* General Tips */}
        <Card className="mt-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Generelle tips for timing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">🌅 Morgen (07:00-09:00)</h4>
                <p className="text-sm text-muted-foreground">
                  Folk sjekker sosiale medier på vei til jobb. Perfekt for LinkedIn og Twitter.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">☕ Lunsj (12:00-13:00)</h4>
                <p className="text-sm text-muted-foreground">
                  Lunsjpause = scrolletid. Godt for alle plattformer.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">🌆 Ettermiddag (17:00-18:00)</h4>
                <p className="text-sm text-muted-foreground">
                  Etter jobb, folk avslapper. Høy aktivitet på Facebook og Instagram.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">🌙 Kveld (20:00-22:00)</h4>
                <p className="text-sm text-muted-foreground">
                  Prime time for Instagram og Facebook. Folk er hjemme og aktive.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
