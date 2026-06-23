/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalendarIcon,
  Plus,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Eye,
} from "lucide-react";
import nbLocale from "@fullcalendar/core/locales/nb";
import { PostCreationDialog } from "@/components/PostCreationDialog";
import { EventDetailsDialog } from "@/components/EventDetailsDialog";
import { Breadcrumb } from "@/components/Breadcrumb";
import { SkeletonCard } from "@/components/SkeletonLoader";
import { useState, useRef, useMemo } from "react";
import { useLocation } from "wouter";

export default function Calendar() {
  const [view, setView] = useState<
    "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "listWeek"
  >("dayGridMonth");
  const calendarRef = useRef<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [, setLocation] = useLocation();

  // Fetch scheduled posts
  const {
    data: posts,
    isLoading,
    refetch,
  } = trpc.content.getScheduledPosts.useQuery();
  trpc.useUtils();

  // Mutation to reschedule post
  const reschedulePost = trpc.content.reschedule.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  // Compute stats from posts
  const stats = useMemo(() => {
    if (!posts) return { total: 0, scheduled: 0, published: 0, draft: 0 };
    return {
      total: posts.length,
      scheduled: posts.filter((p) => p.status === "scheduled").length,
      published: posts.filter((p) => p.status === "published").length,
      draft: posts.filter((p) => p.status === "draft").length,
    };
  }, [posts]);

  // Get upcoming posts (next 7 days)
  const upcomingPosts = useMemo(() => {
    if (!posts) return [];
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return posts
      .filter((p) => {
        if (!p.scheduledFor) return false;
        const scheduled = new Date(p.scheduledFor);
        return scheduled >= now && scheduled <= nextWeek;
      })
      .sort(
        (a, b) =>
          new Date(a.scheduledFor!).getTime() -
          new Date(b.scheduledFor!).getTime()
      )
      .slice(0, 5);
  }, [posts]);

  // Convert posts to FullCalendar events
  const events =
    posts?.map((post) => ({
      id: post.id.toString(),
      title: post.generatedContent.substring(0, 50) + "...",
      start: post.scheduledFor || undefined,
      backgroundColor: getPlatformColor(post.platform),
      borderColor: getPlatformColor(post.platform),
      extendedProps: {
        platform: post.platform,
        status: post.status,
        content: post.generatedContent,
      },
    })) || [];

  // Handle date click
  const handleDateClick = (info: any) => {
    setSelectedDate(new Date(info.dateStr));
    setDialogOpen(true);
  };

  // Handle event click
  const handleEventClick = (info: any) => {
    setSelectedEvent({
      id: info.event.id,
      title: info.event.title,
      start: info.event.start,
      extendedProps: info.event.extendedProps,
    });
    setEventDialogOpen(true);
  };

  // Handle edit event
  const handleEditEvent = (eventId: string) => {
    window.location.href = `/posts?id=${eventId}`;
  };

  // Handle delete event
  const handleDeleteEvent = (_eventId: string) => {
    if (confirm("Er du sikker på at du vil slette dette innlegget?")) {
      // TODO: Implement delete mutation
    }
  };

  // Handle event drop (reschedule)
  const handleEventDrop = (info: any) => {
    const postId = parseInt(info.event.id);
    const newDate = info.event.start;

    if (!newDate) {
      info.revert();
      return;
    }

    reschedulePost.mutate(
      { postId, scheduledFor: newDate.getTime() },
      {
        onError: () => {
          info.revert();
        },
      }
    );
  };

  // Jump to today
  const handleToday = () => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.today();
    }
  };

  // Change view
  const handleViewChange = (
    newView: "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "listWeek"
  ) => {
    setView(newView);
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.changeView(newView);
    }
  };

  const viewOptions = [
    { key: "dayGridMonth" as const, label: "Måned" },
    { key: "timeGridWeek" as const, label: "Uke" },
    { key: "timeGridDay" as const, label: "Dag" },
    { key: "listWeek" as const, label: "Liste" },
  ];

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "linkedin":
        return "💼";
      case "twitter":
        return "🐦";
      case "facebook":
        return "👍";
      case "instagram":
        return "📸";
      default:
        return "📝";
    }
  };

  const _getPlatformLabel = (platform: string) => {
    switch (platform) {
      case "linkedin":
        return "LinkedIn";
      case "twitter":
        return "Twitter/X";
      case "facebook":
        return "Facebook";
      case "instagram":
        return "Instagram";
      default:
        return platform;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0">
            Planlagt
          </Badge>
        );
      case "published":
        return (
          <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] px-1.5 py-0">
            Publisert
          </Badge>
        );
      case "draft":
        return (
          <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-[10px] px-1.5 py-0">
            Utkast
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] px-1.5 py-0">
            Feilet
          </Badge>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50/80 via-background to-background dark:from-slate-950/50">
        <main className="container py-6 md:py-8 max-w-7xl">
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Kalender", current: true },
            ]}
            className="mb-4"
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <div className="h-96 skeleton rounded-xl" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/80 via-background to-background dark:from-slate-950/50">
      <main className="container py-6 md:py-8 max-w-7xl">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Kalender", current: true },
          ]}
          className="mb-4"
        />

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 page-enter">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <CalendarIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Kalender
              </h1>
              <p className="text-sm text-muted-foreground">
                Planlegg og administrer innleggene dine visuelt
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
              className="text-xs"
            >
              <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />I dag
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setSelectedDate(new Date());
                setDialogOpen(true);
              }}
              className="gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 hover:shadow-xl transition-all duration-300 text-white border-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nytt innlegg</span>
              <span className="sm:hidden">Ny</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6 stagger-children">
          {/* Total Posts */}
          <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 card-hover">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Totalt
              </span>
              <div className="h-9 w-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
              {stats.total}
            </div>
            <p className="text-xs text-muted-foreground mt-1">innlegg totalt</p>
          </div>

          {/* Scheduled */}
          <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 card-hover">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Planlagt
              </span>
              <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
              {stats.scheduled}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              venter på publisering
            </p>
          </div>

          {/* Published */}
          <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 card-hover">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Publisert
              </span>
              <div className="h-9 w-9 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
              {stats.published}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              publiserte innlegg
            </p>
          </div>

          {/* Drafts */}
          <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 card-hover">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Utkast
              </span>
              <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
              {stats.draft}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              uferdige utkast
            </p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Calendar - Takes 3 columns */}
          <div className="lg:col-span-3 space-y-4">
            {/* View Switcher + Calendar */}
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden">
              {/* View Switcher Bar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                  {viewOptions.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => handleViewChange(opt.key)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                        view === opt.key
                          ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Platform Legend - Inline */}
                <div className="hidden md:flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                    <span className="text-[11px] text-muted-foreground">
                      LinkedIn
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-sky-400"></div>
                    <span className="text-[11px] text-muted-foreground">
                      Twitter/X
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-700"></div>
                    <span className="text-[11px] text-muted-foreground">
                      Facebook
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"></div>
                    <span className="text-[11px] text-muted-foreground">
                      Instagram
                    </span>
                  </div>
                </div>
              </div>

              {/* Calendar Content */}
              <div className="p-3 sm:p-5">
                <FullCalendar
                  key={view}
                  ref={calendarRef}
                  plugins={[
                    dayGridPlugin,
                    timeGridPlugin,
                    listPlugin,
                    interactionPlugin,
                  ]}
                  initialView={view}
                  headerToolbar={{
                    left: "prev,next",
                    center: "title",
                    right: "",
                  }}
                  locale={nbLocale}
                  events={events}
                  editable={true}
                  selectable={true}
                  selectMirror={true}
                  dayMaxEvents={true}
                  weekends={true}
                  dateClick={handleDateClick}
                  eventClick={handleEventClick}
                  eventDrop={handleEventDrop}
                  height="auto"
                  contentHeight="auto"
                  aspectRatio={1.8}
                />
              </div>

              {/* Mobile Platform Legend */}
              <div className="md:hidden flex items-center gap-3 px-4 py-3 border-t border-slate-200/80 dark:border-slate-800 overflow-x-auto">
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                  <span className="text-[11px] text-muted-foreground">
                    LinkedIn
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-sky-400"></div>
                  <span className="text-[11px] text-muted-foreground">
                    Twitter/X
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-700"></div>
                  <span className="text-[11px] text-muted-foreground">
                    Facebook
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"></div>
                  <span className="text-[11px] text-muted-foreground">
                    Instagram
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - Takes 1 column */}
          <div className="space-y-4">
            {/* Upcoming Posts */}
            <Card className="border-slate-200/80 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  Kommende innlegg
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingPosts.length > 0 ? (
                  upcomingPosts.map((post) => (
                    <div
                      key={post.id}
                      className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedEvent({
                          id: post.id.toString(),
                          title:
                            post.generatedContent.substring(0, 50) + "...",
                          start: post.scheduledFor
                            ? new Date(post.scheduledFor)
                            : null,
                          extendedProps: {
                            platform: post.platform,
                            status: post.status,
                            content: post.generatedContent,
                          },
                        });
                        setEventDialogOpen(true);
                      }}
                    >
                      <span className="text-lg flex-shrink-0 mt-0.5">
                        {getPlatformIcon(post.platform)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                          {post.generatedContent.substring(0, 40)}...
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] text-muted-foreground">
                            {post.scheduledFor
                              ? new Date(post.scheduledFor).toLocaleDateString(
                                  "nb-NO",
                                  {
                                    day: "numeric",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )
                              : "Ikke planlagt"}
                          </span>
                          {getStatusBadge(post.status)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Ingen kommende innlegg
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">
                      Klikk på en dato for å planlegge
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border-slate-200/80 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  Hurtighandlinger
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs h-9"
                  onClick={() => setLocation("/generate")}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-2 text-indigo-500" />
                  Generer nytt innlegg
                  <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs h-9"
                  onClick={() => setLocation("/posts")}
                >
                  <Eye className="h-3.5 w-3.5 mr-2 text-blue-500" />
                  Se alle innlegg
                  <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs h-9"
                  onClick={() => setLocation("/best-time")}
                >
                  <Clock className="h-3.5 w-3.5 mr-2 text-green-500" />
                  Finn beste tidspunkt
                  <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs h-9"
                  onClick={() => setLocation("/kalender-old")}
                >
                  <CalendarIcon className="h-3.5 w-3.5 mr-2 text-amber-500" />
                  Innholds-kalender
                  <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
                </Button>
              </CardContent>
            </Card>

            {/* Tips Card */}
            <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-200/50 dark:border-indigo-800/30 p-4">
              <h3 className="text-xs font-semibold text-indigo-800 dark:text-indigo-300 mb-2 flex items-center gap-1.5">
                <span>💡</span> Tips for planlegging
              </h3>
              <ul className="space-y-1.5">
                <li className="text-[11px] text-indigo-700/80 dark:text-indigo-400/80 flex items-start gap-1.5">
                  <span className="mt-0.5">•</span>
                  Planlegg innhold 2-4 uker i forveien
                </li>
                <li className="text-[11px] text-indigo-700/80 dark:text-indigo-400/80 flex items-start gap-1.5">
                  <span className="mt-0.5">•</span>
                  Dra og slipp for å flytte innlegg
                </li>
                <li className="text-[11px] text-indigo-700/80 dark:text-indigo-400/80 flex items-start gap-1.5">
                  <span className="mt-0.5">•</span>
                  Klikk på en dato for å opprette nytt
                </li>
                <li className="text-[11px] text-indigo-700/80 dark:text-indigo-400/80 flex items-start gap-1.5">
                  <span className="mt-0.5">•</span>
                  Bruk beste tid for optimal publisering
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Post Creation Dialog */}
        <PostCreationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          selectedDate={selectedDate}
        />

        {/* Event Details Dialog */}
        <EventDetailsDialog
          open={eventDialogOpen}
          onOpenChange={setEventDialogOpen}
          event={selectedEvent}
          onEdit={handleEditEvent}
          onDelete={handleDeleteEvent}
        />
      </main>
    </div>
  );
}

// Helper function to get platform color
function getPlatformColor(platform: string): string {
  switch (platform) {
    case "linkedin":
      return "#3b82f6"; // blue-500
    case "twitter":
      return "#38bdf8"; // sky-400
    case "facebook":
      return "#1d4ed8"; // blue-700
    case "instagram":
      return "#a855f7"; // purple-500
    default:
      return "#6b7280"; // gray-500
  }
}