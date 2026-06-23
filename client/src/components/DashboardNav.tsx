/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X, Zap, LayoutDashboard, Sparkles, FileText, MessageSquare, Settings as SettingsIcon, LogOut, Flame, Mic, BarChart3, Lightbulb, Calendar, Clock, Recycle, Send, Target, List, FlaskConical, Mail, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import FloatingIdeaButton from "./FloatingIdeaButton";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

export default function DashboardNav() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed.toString());
  }, [sidebarCollapsed]);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      toast.success("Logget ut");
      window.location.href = "/login";
    },
  });

  // Primary navigation items
  const primaryNavItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Generer", href: "/generate", icon: Sparkles },
    { label: "Mine innlegg", href: "/posts", icon: FileText },
  ];

  // Sidebar navigation items
  const sidebarSections = [
    {
      title: "Planlegging",
      items: [
        { label: "Kalender", href: "/kalender", icon: Calendar },
        { label: "Beste Tid", href: "/best-time", icon: Clock },
        { label: "Gjenbruk", href: "/repurpose", icon: Recycle },
        { label: "Innholds-Serier", href: "/content-series", icon: List },
        { label: "Idé-Bank", href: "/idea-bank", icon: Lightbulb },
      ]
    },
    {
      title: "Inspirasjon",
      items: [
        { label: "Trender", href: "/trends", icon: Flame },
        { label: "Eksempler", href: "/examples", icon: Lightbulb },
      ]
    },
    {
      title: "Tilpasning",
      items: [
        { label: "Stemme", href: "/voice-training", icon: Mic },
        { label: "Coach", href: "/coach", icon: MessageSquare },
      ]
    },
    {
      title: "Avansert",
      items: [
        { label: "Telegram Bot", href: "/telegram-bot", icon: Send },
        { label: "Telegram Innlegg", href: "/telegram-posts", icon: MessageSquare },
        { label: "Konkurrent-Radar", href: "/competitor-radar", icon: Target },
        { label: "A/B Testing", href: "/ab-testing", icon: FlaskConical },
        { label: "Ukentlig Rapport", href: "/weekly-report", icon: Mail },
        { label: "Engasjement-Hjelper", href: "/engagement-helper", icon: MessageSquare },
      ]
    },
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard") return location === "/dashboard";
    return location.startsWith(href);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const NavItem = ({ item, collapsed }: { item: { label: string; href: string; icon: any }; collapsed: boolean }) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    
    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Link href={item.href}>
              <Button
                variant={active ? "secondary" : "ghost"}
                size="icon"
                className={cn(
                  "w-10 h-10 transition-all duration-200",
                  active 
                    ? "bg-primary/10 text-primary shadow-sm shadow-primary/10" 
                    : "hover:bg-muted/80"
                )}
              >
                <Icon className={cn("h-5 w-5 transition-colors", active && "text-primary")} />
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium text-xs">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Link href={item.href}>
        <Button
          variant={active ? "secondary" : "ghost"}
          className={cn(
            "w-full justify-start gap-3 h-9 text-[13px] transition-all duration-200",
            active 
              ? "bg-primary/10 text-primary font-medium shadow-sm shadow-primary/5 border border-primary/10" 
              : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className={cn("h-4 w-4 transition-colors", active ? "text-primary" : "text-muted-foreground")} />
          {item.label}
        </Button>
      </Link>
    );
  };

  return (
    <>
      {/* Fixed Sidebar - Desktop */}
      <aside className={cn(
        "hidden md:flex flex-col fixed left-0 top-0 h-screen bg-background/95 backdrop-blur-xl border-r border-border/50 z-40 transition-all duration-300",
        sidebarCollapsed ? "w-16" : "w-60"
      )}>
        {/* Logo */}
        <div className={cn(
          "h-14 flex items-center border-b border-border/50 px-3",
          sidebarCollapsed ? "justify-center" : "justify-between"
        )}>
          {!sidebarCollapsed && (
            <Link href="/dashboard">
              <div className="flex items-center gap-2.5 cursor-pointer group">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-md shadow-primary/20 group-hover:shadow-lg group-hover:shadow-primary/30 transition-shadow">
                  <Zap className="h-4.5 w-4.5 text-white" />
                </div>
                <span className="text-lg font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  Nexify AI
                </span>
              </div>
            </Link>
          )}
          {sidebarCollapsed && (
            <Link href="/dashboard">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center cursor-pointer shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-shadow">
                <Zap className="h-4.5 w-4.5 text-white" />
              </div>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7 text-muted-foreground hover:text-foreground", sidebarCollapsed && "hidden")}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Expand button when collapsed */}
        {sidebarCollapsed && (
          <div className="flex justify-center py-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setSidebarCollapsed(false)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Primary Navigation */}
        <div className={cn("p-2 space-y-0.5", sidebarCollapsed && "flex flex-col items-center")}>
          {primaryNavItems.map((item) => (
            <NavItem key={item.href} item={item} collapsed={sidebarCollapsed} />
          ))}
        </div>

        {/* Scrollable Sidebar Content */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-thin">
          {sidebarSections.map((section, idx) => (
            <div key={section.title} className={cn("mt-3", sidebarCollapsed && "flex flex-col items-center")}>
              {!sidebarCollapsed && (
                <div className="px-3 py-1.5">
                  <h3 className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                    {section.title}
                  </h3>
                </div>
              )}
              {sidebarCollapsed && idx > 0 && (
                <div className="w-6 h-px bg-border/50 my-2" />
              )}
              <div className={cn("space-y-0.5", sidebarCollapsed && "flex flex-col items-center")}>
                {section.items.map((item) => (
                  <NavItem key={item.href} item={item} collapsed={sidebarCollapsed} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Section */}
        <div className={cn("border-t border-border/50 p-2 space-y-0.5", sidebarCollapsed && "flex flex-col items-center")}>
          <NavItem 
            item={{ label: "Innstillinger", href: "/settings", icon: SettingsIcon }} 
            collapsed={sidebarCollapsed} 
          />
          {user?.role === "admin" && (
            <NavItem 
              item={{ label: "Analytics", href: "/admin/analytics", icon: BarChart3 }} 
              collapsed={sidebarCollapsed} 
            />
          )}
          
          {/* Theme Toggle */}
          <div className={cn("py-1.5", sidebarCollapsed ? "flex justify-center" : "px-3")}>
            <ThemeToggle />
          </div>
          
          {/* User Info & Logout */}
          <div className={cn(
            "pt-2 mt-1 border-t border-border/50",
            sidebarCollapsed ? "flex flex-col items-center" : ""
          )}>
            {!sidebarCollapsed && user && (
              <Link href="/profile">
                <div className="px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                  <div className="flex items-center gap-2.5">
                    {(user as any).avatarUrl ? (
                      <img
                        src={(user as any).avatarUrl}
                        alt={user.name || "User"}
                        className="h-8 w-8 rounded-full object-cover flex-shrink-0 ring-1 ring-border"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                        {user.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate leading-tight">{user.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                </div>
              </Link>
            )}
            {sidebarCollapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-10 h-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={handleLogout}
                    disabled={logoutMutation.isPending}
                  >
                    <LogOut className="h-4.5 w-4.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">Logg ut</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-9 text-[13px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
              >
                <LogOut className="h-4 w-4" />
                Logg ut
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Top Navigation */}
      <div>
        <nav className="md:hidden sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
          <div className="container flex h-14 items-center justify-between">
            <Link href="/dashboard">
              <div className="flex items-center gap-2 cursor-pointer">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-md shadow-primary/20">
                  <Zap className="h-4.5 w-4.5 text-white" />
                </div>
                <span className="text-lg font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  Nexify AI
                </span>
              </div>
            </Link>

            <button
              className="md:hidden p-2 rounded-lg hover:bg-muted/60 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-border/50 bg-background/98 backdrop-blur-xl max-h-[calc(100vh-3.5rem)] overflow-y-auto">
              <div className="container py-3 space-y-1">
                {primaryNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href}>
                      <Button
                        variant={isActive(item.href) ? "secondary" : "ghost"}
                        className={cn(
                          "w-full justify-start gap-2.5 h-10 text-sm",
                          isActive(item.href) && "bg-primary/10 text-primary font-medium"
                        )}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Button>
                    </Link>
                  );
                })}
                
                {sidebarSections.map((section) => (
                  <div key={section.title} className="pt-2">
                    <div className="text-[10px] font-semibold text-muted-foreground/70 px-3 py-1.5 uppercase tracking-widest">
                      {section.title}
                    </div>
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link key={item.href} href={item.href}>
                          <Button
                            variant={isActive(item.href) ? "secondary" : "ghost"}
                            className={cn(
                              "w-full justify-start gap-2.5 h-9 text-[13px]",
                              isActive(item.href) && "bg-primary/10 text-primary font-medium"
                            )}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <Icon className="h-4 w-4" />
                            {item.label}
                          </Button>
                        </Link>
                      );
                    })}
                  </div>
                ))}

                <div className="pt-2 border-t border-border/50">
                  <Link href="/settings">
                    <Button
                      variant={isActive("/settings") ? "secondary" : "ghost"}
                      className="w-full justify-start gap-2.5 h-9 text-[13px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <SettingsIcon className="h-4 w-4" />
                      Innstillinger
                    </Button>
                  </Link>
                  {user?.role === "admin" && (
                    <Link href="/admin/analytics">
                      <Button
                        variant={isActive("/admin/analytics") ? "secondary" : "ghost"}
                        className="w-full justify-start gap-2.5 h-9 text-[13px]"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <BarChart3 className="h-4 w-4" />
                        Analytics
                      </Button>
                    </Link>
                  )}
                </div>

                <div className="pt-2 border-t border-border/50">
                  {user && (
                    <div className="px-3 py-2 flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                        {user.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{user.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2.5 h-9 text-[13px] text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    disabled={logoutMutation.isPending}
                  >
                    <LogOut className="h-4 w-4" />
                    Logg ut
                  </Button>
                </div>
              </div>
            </div>
          )}
        </nav>
      </div>

      <FloatingIdeaButton />
    </>
  );
}