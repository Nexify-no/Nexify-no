/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { FileText, Zap, TrendingUp, Clock, Target, Sparkles, Search, ChevronLeft, ChevronRight, ArrowRight, Plus, Eye, Edit, Copy, Rocket, Gift, LayoutDashboard, Crown, Activity, Shield, BarChart3 } from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
// import OnboardingTour from "@/components/OnboardingTour"; // Removed: react-joyride dependency removed
import { useState, useMemo } from "react";
import { SkeletonCard } from "@/components/SkeletonLoader";
import { EmptyStateWithImage } from "@/components/EmptyState";
import { toast } from "sonner";

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

export default function Dashboard() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<string | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<string | "all">("all");
  const [sortBy] = useState<"newest" | "oldest" | "platform">("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: subscription, isLoading: subLoading } = trpc.user.getSubscription.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: posts, isLoading: postsLoading } = trpc.content.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  
  const { data: activityData, isLoading: activityLoading } = trpc.content.getActivityData.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const filteredAndSortedPosts = useMemo(() => {
    if (!posts) return [];
    
    const filtered = posts.filter((post) => {
      const matchesSearch = post.generatedContent.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           post.rawInput?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPlatform = selectedPlatform === "all" || post.platform === selectedPlatform;
      const matchesStatus = selectedStatus === "all" || post.status === selectedStatus;
      return matchesSearch && matchesPlatform && matchesStatus;
    });

    if (sortBy === "newest") {
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === "oldest") {
      filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortBy === "platform") {
      filtered.sort((a, b) => a.platform.localeCompare(b.platform));
    }

    return filtered;
  }, [posts, searchQuery, selectedPlatform, selectedStatus, sortBy]);

  const totalPages = Math.ceil(filteredAndSortedPosts.length / itemsPerPage);
  const paginatedPosts = filteredAndSortedPosts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleFilterChange = (callback: () => void) => {
    setCurrentPage(1);
    callback();
  };

  // Use the effective limit/usage from the backend (active plans return the real
  // monthly cap + usage; trial falls back to the trial fields).
  const postsLimit = subscription?.postsLimit ?? subscription?.trialPostsLimit ?? 2;
  const postsUsed = subscription?.postsUsed ?? subscription?.postsGenerated ?? 0;
  const postsRemaining = subscription?.postsRemaining ?? Math.max(0, postsLimit - postsUsed);
  const usagePercentage = postsLimit > 0 ? (postsUsed / postsLimit) * 100 : 0;

  const platformDistribution = useMemo(() => {
    if (!posts) return [];
    const dist: Record<string, number> = {};
    posts.forEach(post => {
      dist[post.platform] = (dist[post.platform] || 0) + 1;
    });
    return Object.entries(dist).map(([platform, count]) => ({ name: platform, value: count }));
  }, [posts]);

  const getProgressColor = (percentage: number) => {
    if (percentage < 50) return "bg-emerald-500";
    if (percentage < 80) return "bg-amber-500";
    return "bg-rose-500";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft": return { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", dot: "bg-slate-400" };
      case "scheduled": return { bg: "bg-blue-50 dark:bg-blue-950", text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500" };
      case "published": return { bg: "bg-emerald-50 dark:bg-emerald-950", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" };
      default: return { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" };
    }
  };

  const getPlatformConfig = (platform: string) => {
    const configs: Record<string, { icon: string; color: string; bg: string }> = {
      linkedin: { icon: "in", color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/40" },
      twitter: { icon: "𝕏", color: "text-slate-900 dark:text-slate-100", bg: "bg-slate-100 dark:bg-slate-800" },
      instagram: { icon: "ig", color: "text-pink-600", bg: "bg-pink-100 dark:bg-pink-900/40" },
      facebook: { icon: "fb", color: "text-blue-700", bg: "bg-blue-100 dark:bg-blue-900/40" }
    };
    return configs[platform] || { icon: "?", color: "text-slate-600", bg: "bg-slate-100" };
  };

  const handleCopyPost = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success(language === "no" ? "Kopiert til utklippstavlen!" : "Copied to clipboard!");
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = user?.name?.split(" ")[0] || "";
    if (hour < 12) return language === "no" ? `God morgen, ${name}` : `Good morning, ${name}`;
    if (hour < 18) return language === "no" ? `God ettermiddag, ${name}` : `Good afternoon, ${name}`;
    return language === "no" ? `God kveld, ${name}` : `Good evening, ${name}`;
  };

  if (authLoading || !isAuthenticated) {
    if (!authLoading && !isAuthenticated) {
      window.location.href = getLoginUrl();
      return null;
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-14 w-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
            <Zap className="h-6 w-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">
            {language === "no" ? "Laster dashbord..." : "Loading dashboard..."}
          </p>
        </div>
      </div>
    );
  }

  const isAdmin = user && "role" in user && user.role === "admin";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/80 via-background to-background dark:from-slate-950/50">
      <main className="container py-6 md:py-8 max-w-6xl">
        {/* Welcome Header */}
        <div className="mb-8 page-enter">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <LayoutDashboard className="h-4 w-4 text-white" />
                </div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dashboard</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold mb-1 tracking-tight">
                {getGreeting()}
              </h1>
              <p className="text-muted-foreground text-sm">
                {subscription?.status === "trial" 
                  ? (language === "no" 
                    ? `Du har ${postsRemaining} gratis innlegg igjen. La oss lage noe bra!` 
                    : `You have ${postsRemaining} free posts remaining. Let's create something great!`)
                  : (language === "no" ? "Klar til å lage noe fantastisk i dag?" : "Ready to create something amazing today?")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <>
                  <Button 
                    size="lg" 
                    onClick={() => setLocation("/admin")}
                    className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <BarChart3 className="h-4 w-4" />
                    {language === "no" ? "Admin Hub" : "Admin Hub"}
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline"
                    onClick={() => setLocation("/admin/users")}
                    className="gap-2 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    <Shield className="h-4 w-4" />
                    {language === "no" ? "Users" : "Users"}
                  </Button>
                </>
              )}
              <Button 
                size="lg" 
                onClick={() => setLocation("/generate")}
                className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 transition-all duration-300 hover:-translate-y-0.5 text-white border-0"
              >
                <Plus className="h-4 w-4" />
                {language === "no" ? "Nytt innlegg" : "New Post"}
              </Button>
            </div>
          </div>
        </div>

        {/* Welcome Card for New Users */}
        {!postsLoading && (!posts || posts.length === 0) && (
          <div className="mb-8 page-enter" style={{ animationDelay: '0.1s' }}>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-8 text-white">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4 blur-2xl" />
              
              <div className="relative text-center max-w-xl mx-auto">
                <div className="h-16 w-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl">
                  <Rocket className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold mb-3">
                  {language === "no" ? "Velkommen til Nexify AI!" : "Welcome to Nexify AI!"}
                </h2>
                <p className="text-white/80 mb-6 leading-relaxed">
                  {language === "no" 
                    ? "Lag ditt første profesjonelle innlegg på under 30 sekunder. Velg plattform, skriv en idé, og la AI gjøre resten."
                    : "Create your first professional post in under 30 seconds. Choose a platform, write an idea, and let AI do the rest."}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button 
                    size="lg" 
                    onClick={() => setLocation("/generate")}
                    className="gap-2 bg-white text-indigo-700 hover:bg-white/90 shadow-lg font-semibold"
                  >
                    <Sparkles className="h-5 w-5" />
                    {language === "no" ? "Lag ditt første innlegg" : "Create Your First Post"}
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline"
                    onClick={() => setLocation("/trends")}
                    className="gap-2 border-white/30 text-white hover:bg-white/10 bg-transparent"
                  >
                    <TrendingUp className="h-5 w-5" />
                    {language === "no" ? "Se trender" : "Browse Trends"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards Grid */}
        {subLoading ? (
          <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8 stagger-children">
            {/* Posts Generated */}
            <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 card-hover">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {language === "no" ? "Generert" : "Generated"}
                </span>
                <div className="h-9 w-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <FileText className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white mb-3 tabular-nums">
                {postsUsed}
              </div>
              <div className="space-y-2">
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${getProgressColor(usagePercentage)}`}
                    style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {postsUsed} / {postsLimit}
                </p>
              </div>
            </div>

            {/* Posts Remaining */}
            <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 card-hover">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {language === "no" ? "Gjenstår" : "Remaining"}
                </span>
                <div className="h-9 w-9 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Zap className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white mb-3 tabular-nums">
                {postsRemaining}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {language === "no" ? 
                  (postsRemaining > 3 ? "Du har god plass!" : "Snart tom — oppgrader?") :
                  (postsRemaining > 3 ? "Plenty of room!" : "Running low — upgrade?")}
              </p>
            </div>

            {/* Time Saved */}
            <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 card-hover">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {language === "no" ? "Tid spart" : "Time Saved"}
                </span>
                <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Clock className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white mb-3 tabular-nums">
                {Math.round(postsUsed * 0.25)}h
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                ~15 {language === "no" ? "min spart per innlegg" : "min saved per post"}
              </p>
            </div>

            {/* Subscription Status */}
            <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 card-hover">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {language === "no" ? "Abonnement" : "Plan"}
                </span>
                <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Crown className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
                {subscription?.status === "trial" ? (language === "no" ? "Gratis" : "Free") : (subscription?.planName || "Pro")}
              </div>
              {subscription?.status === "trial" ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-[11px] h-6 px-2.5 border-amber-200 text-amber-700 dark:text-amber-400 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                  onClick={() => setLocation("/pricing")}
                >
                  <Gift className="h-3 w-3 mr-1" />
                  {language === "no" ? "Oppgrader" : "Upgrade"}
                </Button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    {language === "no" ? "Aktiv" : "Active"}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Charts Section */}
        {(subscription?.postsGenerated || 0) > 0 && (
          <div className="grid gap-5 mb-8 lg:grid-cols-5 page-enter" style={{ animationDelay: '0.15s' }}>
            {/* Activity Chart */}
            <div className="lg:col-span-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden">
              <div className="px-5 pt-5 pb-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-indigo-500" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {language === "no" ? "Aktivitet" : "Activity"}
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {language === "no" ? "Siste 7 dager" : "Last 7 days"}
                  </span>
                </div>
              </div>
              <div className="px-2 pb-4">
                {activityLoading ? (
                  <div className="h-[260px] flex items-center justify-center">
                    <div className="animate-pulse text-muted-foreground text-sm">
                      {language === "no" ? "Laster..." : "Loading..."}
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={activityData || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        stroke="var(--muted-foreground)" 
                        fontSize={11} 
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="var(--muted-foreground)" 
                        fontSize={11} 
                        tickLine={false}
                        axisLine={false}
                      />
                      <RechartsTooltip 
                        contentStyle={{ 
                          backgroundColor: "var(--card)", 
                          border: "1px solid var(--border)",
                          borderRadius: "10px",
                          boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                          fontSize: "12px",
                          padding: "8px 12px"
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#6366f1" 
                        strokeWidth={2.5}
                        fill="url(#activityGradient)" 
                        dot={{ fill: "#6366f1", strokeWidth: 0, r: 3 }}
                        activeDot={{ fill: "#6366f1", strokeWidth: 2, stroke: "#fff", r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Platform Distribution */}
            <div className="lg:col-span-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden">
              <div className="px-5 pt-5 pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-violet-500" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {language === "no" ? "Plattformer" : "Platforms"}
                  </h3>
                </div>
              </div>
              {platformDistribution.length > 0 ? (
                <div className="px-2 pb-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={platformDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {platformDistribution.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ 
                          backgroundColor: "var(--card)", 
                          border: "1px solid var(--border)",
                          borderRadius: "10px",
                          boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                          fontSize: "12px"
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Legend */}
                  <div className="px-4 flex flex-wrap gap-3 justify-center">
                    {platformDistribution.map((item, index) => (
                      <div key={item.name} className="flex items-center gap-1.5">
                        <div 
                          className="h-2.5 w-2.5 rounded-full" 
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} 
                        />
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                          {item.name} ({item.value})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
                  {language === "no" ? "Ingen data ennå" : "No data yet"}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Posts Section */}
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden page-enter" style={{ animationDelay: '0.25s' }}>
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <FileText className="h-4 w-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {language === "no" ? "Siste innlegg" : "Recent Posts"}
                  </h3>
                </div>
                <p className="text-[11px] text-slate-400">
                  {filteredAndSortedPosts.length > 0 
                    ? (language === "no" ? `${filteredAndSortedPosts.length} innlegg funnet` : `${filteredAndSortedPosts.length} posts found`)
                    : (language === "no" ? "Dine genererte innlegg" : "Your generated posts")}
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setLocation("/generate")} 
                className="gap-1.5 h-8 text-xs border-slate-200 dark:border-slate-700"
              >
                <Plus className="h-3.5 w-3.5" />
                {language === "no" ? "Nytt" : "New"}
              </Button>
            </div>

            {/* Search and Filters */}
            {posts && posts.length > 0 && (
              <div className="grid gap-2.5 md:grid-cols-4">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder={language === "no" ? "Søk i innlegg..." : "Search posts..."}
                    value={searchQuery}
                    onChange={(e) => handleFilterChange(() => setSearchQuery(e.target.value))}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all placeholder:text-slate-400"
                  />
                </div>
                <select
                  value={selectedPlatform}
                  onChange={(e) => handleFilterChange(() => setSelectedPlatform(e.target.value))}
                  className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all cursor-pointer"
                >
                  <option value="all">{language === "no" ? "Alle plattformer" : "All platforms"}</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="twitter">Twitter/X</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                </select>
                <select
                  value={selectedStatus}
                  onChange={(e) => handleFilterChange(() => setSelectedStatus(e.target.value))}
                  className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all cursor-pointer"
                >
                  <option value="all">{language === "no" ? "Alle statuser" : "All statuses"}</option>
                  <option value="draft">{language === "no" ? "Utkast" : "Draft"}</option>
                  <option value="scheduled">{language === "no" ? "Planlagt" : "Scheduled"}</option>
                  <option value="published">{language === "no" ? "Publisert" : "Published"}</option>
                </select>
              </div>
            )}
          </div>

          <div className="px-5 pb-5">
            {postsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : paginatedPosts.length > 0 ? (
              <div className="space-y-2">
                {paginatedPosts.map((post) => {
                  const platformConfig = getPlatformConfig(post.platform);
                  const statusConfig = getStatusBadge(post.status);
                  return (
                    <div 
                      key={post.id} 
                      className="group flex items-center gap-4 p-3.5 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all duration-200"
                    >
                      {/* Platform Icon */}
                      <div className={`h-10 w-10 rounded-xl ${platformConfig.bg} flex items-center justify-center flex-shrink-0`}>
                        <span className={`text-xs font-bold ${platformConfig.color} uppercase`}>
                          {platformConfig.icon}
                        </span>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 dark:text-white truncate leading-snug mb-1">
                          {post.generatedContent.substring(0, 90)}...
                        </p>
                        <div className="flex items-center gap-2">
                          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                            <div className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
                            {post.status === "draft" ? (language === "no" ? "Utkast" : "Draft") :
                             post.status === "scheduled" ? (language === "no" ? "Planlagt" : "Scheduled") :
                             post.status === "published" ? (language === "no" ? "Publisert" : "Published") :
                             post.status}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {new Date(post.createdAt).toLocaleDateString(language === "no" ? "nb-NO" : "en-US", {
                              day: "numeric",
                              month: "short"
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          title={language === "no" ? "Vis" : "View"}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          title={language === "no" ? "Rediger" : "Edit"}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          title={language === "no" ? "Kopier" : "Copy"}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                          onClick={() => handleCopyPost(post.generatedContent)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-400">
                      {language === "no" 
                        ? `Side ${currentPage} av ${totalPages}`
                        : `Page ${currentPage} of ${totalPages}`}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="h-7 w-7 p-0 border-slate-200 dark:border-slate-700"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="h-7 w-7 p-0 border-slate-200 dark:border-slate-700"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : posts && posts.length > 0 ? (
              <div className="text-center py-12">
                <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <Search className="h-5 w-5 text-slate-400" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                  {language === "no" ? "Ingen resultater" : "No results"}
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  {language === "no" 
                    ? "Prøv å endre søket eller filtrene dine"
                    : "Try adjusting your search or filters"}
                </p>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => {
                  setSearchQuery("");
                  setSelectedPlatform("all");
                  setSelectedStatus("all");
                }}>
                  {language === "no" ? "Nullstill filtre" : "Reset filters"}
                </Button>
              </div>
            ) : (
              <div className="text-center py-12">
                <EmptyStateWithImage
                  illustration="posts"
                  title={language === "no" ? "Ingen innlegg ennå" : "No posts yet"}
                  description={language === "no" 
                    ? "Lag ditt første innlegg på under 30 sekunder!"
                    : "Create your first post in under 30 seconds!"}
                />
                <Button 
                  size="lg" 
                  onClick={() => setLocation("/generate")}
                  className="mt-6 gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white border-0 shadow-lg shadow-indigo-500/25"
                >
                  <Sparkles className="h-5 w-5" />
                  {language === "no" ? "Lag ditt første innlegg" : "Create Your First Post"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Upgrade CTA if on trial */}
        {!postsLoading && subscription?.status === "trial" && postsRemaining <= 2 && (
          <div className="mt-8 relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-6 text-white page-enter">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-2xl" />
            <div className="relative flex flex-col md:flex-row items-center gap-5">
              <div className="h-14 w-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-lg font-bold mb-0.5">
                  {language === "no" ? "Liker du Nexify AI?" : "Enjoying Nexify AI?"}
                </h3>
                <p className="text-white/80 text-sm">
                  {language === "no" 
                    ? "Oppgrader til Pro for 15 innlegg/mnd, AI-bilder, stemmetrening og mye mer."
                    : "Upgrade to Pro for 15 posts/month, AI images, voice training and much more."}
                </p>
              </div>
              <Button 
                size="lg" 
                onClick={() => setLocation("/pricing")}
                className="gap-2 bg-white text-indigo-700 hover:bg-white/90 shadow-lg font-semibold whitespace-nowrap"
              >
                {language === "no" ? "Oppgrader til Pro" : "Upgrade to Pro"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </main>
      {/* <OnboardingTour /> - Removed: react-joyride dependency removed */}
    </div>
  );
}