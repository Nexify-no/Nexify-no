/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Plus, Sparkles, Clock, TrendingUp } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { PAGE_DESCRIPTIONS } from "@/lib/pageDescriptions";

export default function ContentCalendar() {
  const [, setLocation] = useLocation();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear] = useState(new Date().getFullYear());

  const { data: events, isLoading } = trpc.calendar.getEvents.useQuery({
    month: selectedMonth + 1,
    year: selectedYear,
  });

  const { data: schedule } = trpc.calendar.getUserSchedule.useQuery();

  const months = [
    "Januar", "Februar", "Mars", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Desember"
  ];

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      norwegian: "bg-red-100 text-red-700 border-red-200",
      global: "bg-blue-100 text-blue-700 border-blue-200",
      business: "bg-purple-100 text-purple-700 border-purple-200",
      tech: "bg-green-100 text-green-700 border-green-200",
      seasonal: "bg-orange-100 text-orange-700 border-orange-200",
    };
    return colors[category] || "bg-gray-100 text-gray-700";
  };

  const handleUseEvent = (event: any) => {
    setLocation(`/generate?topic=${encodeURIComponent(event.title + ": " + event.description)}`);
  };

  const handleSchedulePost = () => {
    toast.info("Planlegg innlegg-funksjon kommer snart!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <main className="container py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                <CalendarIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <PageHeader title="Innholds-Kalender" description={PAGE_DESCRIPTIONS.calendar} />
                <p className="text-muted-foreground">
                  Planlegg innhold rundt viktige datoer og hendelser
                </p>
              </div>
            </div>
            <Button onClick={handleSchedulePost}>
              <Plus className="h-4 w-4 mr-2" />
              Planlegg innlegg
            </Button>
          </div>
        </div>

        {/* Month Selector */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {months.map((month, index) => (
            <Button
              key={month}
              variant={selectedMonth === index ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedMonth(index)}
              className="whitespace-nowrap"
            >
              {month}
            </Button>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Upcoming Events */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Kommende hendelser - {months[selectedMonth]}
                </CardTitle>
                <CardDescription>
                  Viktige datoer og anledninger for innholdsproduksjon
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : events && events.length > 0 ? (
                  <div className="space-y-3">
                    {events.map((event: any) => (
                      <Card key={event.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={getCategoryColor(event.category)}>
                                  {event.category}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {new Date(event.eventDate).toLocaleDateString("nb-NO", {
                                    day: "numeric",
                                    month: "long",
                                  })}
                                </span>
                              </div>
                              <h4 className="font-semibold mb-1">{event.title}</h4>
                              <p className="text-sm text-muted-foreground">
                                {event.description}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUseEvent(event)}
                            >
                              <Sparkles className="h-4 w-4 mr-2" />
                              Bruk
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Ingen hendelser funnet for {months[selectedMonth]}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Your Schedule */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Din plan
                </CardTitle>
                <CardDescription>
                  Planlagte innlegg
                </CardDescription>
              </CardHeader>
              <CardContent>
                {schedule && schedule.length > 0 ? (
                  <div className="space-y-3">
                    {schedule.map((item: any) => (
                      <Card key={item.id} className="bg-muted/50">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{item.platform}</Badge>
                            <Badge className={
                              item.status === "published" ? "bg-green-100 text-green-700" :
                              item.status === "planned" ? "bg-blue-100 text-blue-700" :
                              "bg-gray-100 text-gray-700"
                            }>
                              {item.status}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium mb-1">
                            {new Date(item.scheduledDate).toLocaleDateString("nb-NO", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground">{item.notes}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Ingen planlagte innlegg ennå
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={handleSchedulePost}
                    >
                      Planlegg ditt første innlegg
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Tips */}
            <Card className="mt-4 bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-sm">💡 Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li>• Planlegg innhold 2-4 uker i forveien</li>
                  <li>• Bruk hendelser som utgangspunkt</li>
                  <li>• Vær tidlig ute med sesonginnhold</li>
                  <li>• Kombiner globale + norske hendelser</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}