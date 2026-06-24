/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, Calendar, Info, Moon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PAGE_DESCRIPTIONS } from "@/lib/pageDescriptions";

export default function BestTime() {
  const daysOfWeek = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];

  // General industry benchmarks for the Norwegian market — NOT based on the
  // user's own account data. Widely-cited best-practice windows per platform.
  const bestTimes = {
    linkedin: { bestDays: [2, 3, 4], bestHours: [8, 9, 12, 17] },
    twitter: { bestDays: [1, 2, 5], bestHours: [10, 13, 19, 21] },
    instagram: { bestDays: [0, 3, 6], bestHours: [11, 15, 19, 20] },
    facebook: { bestDays: [2, 4, 5], bestHours: [9, 12, 18, 20] },
  };

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
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div>
              <PageHeader title="Beste Tid" description={PAGE_DESCRIPTIONS.bestTime} />
              <p className="text-muted-foreground">
                Generelle anbefalinger for beste publiseringstidspunkt i det norske markedet
              </p>
            </div>
          </div>

          {/* Honest disclaimer — general benchmarks, not account data */}
          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 mb-6">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-200">
                    Generelle bransjestandarder
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Anbefalingene under er alminnelige beste-praksis-tidspunkter for det norske
                    markedet — ikke basert på din egen kontodata. Personlig tidsanalyse fra dine
                    egne publiserte innlegg er planlagt og krever tilkobling av sosiale kontoer.
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

        {/* Platform-specific general recommendations */}
        <div className="grid md:grid-cols-2 gap-6">
          {Object.entries(bestTimes).map(([platform, data]) => (
            <Card key={platform} className="overflow-hidden">
              <div className={`h-2 bg-gradient-to-r ${getPlatformColor(platform)}`} />
              <CardHeader>
                <CardTitle className="capitalize">{platform}</CardTitle>
                <CardDescription>
                  Generelle anbefalinger for det norske markedet
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
                      {data.bestDays.map((day) => (
                        <Badge key={day} className="bg-green-100 text-green-700">
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
                    <div className="grid grid-cols-4 gap-2">
                      {data.bestHours.map((hour) => (
                        <div
                          key={hour}
                          className="bg-muted rounded-lg p-2 text-center text-sm font-medium"
                        >
                          {formatHour(hour)}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Insight */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-900">
                      <strong>💡 Innsikt:</strong>{" "}
                      {platform === "linkedin"
                        ? "Publiser på hverdager mellom 08-09 for maksimal rekkevidde blant profesjonelle."
                        : platform === "twitter"
                          ? "Tidlig morgen og sen ettermiddag gir best engasjement."
                          : platform === "instagram"
                            ? "Helger og kvelder er best for visuelt innhold."
                            : "Lunsj og kveldstid fungerer best for Facebook-publikum."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* General Tips */}
        <Card className="mt-6 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
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
