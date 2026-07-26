/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  HelpCircle, LogOut, Menu, Settings, SlidersHorizontal, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { BrandSelector } from "@/components/BrandSelector";
import { PennaMark } from "@/components/PennaMark";
import {
  navForMode, isNavItemActive, SETTINGS_ITEM,
  type NavSection, type ViewMode,
} from "./navItems";
import { toast } from "sonner";

/**
 * The Penna app sidebar (Batch 1 of the UI refresh).
 *
 * Behaviour is deliberately unchanged from DashboardNav: same view-mode source
 * (`user.getViewMode`), same Enkel-plan gate (`plan.flags`), same destinations.
 * What changes is the presentation — a light, fixed sidebar per the mockups.
 *
 * Rendered only when VITE_FEATURE_NEW_SHELL is on; otherwise PageLayout keeps
 * mounting DashboardNav exactly as before.
 */

const SIDEBAR_WIDTH = "16rem"; // 256px

function NavLinks({
  sections, location, onNavigate,
}: {
  sections: NavSection[];
  location: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Hovedmeny">
      {sections.map((section, i) => (
        <div key={section.title ?? `group-${i}`} className={cn(i > 0 && "mt-5")}>
          {section.title && (
            <p className="px-3 pb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {section.title}
            </p>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(item.href, location);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                      active
                        ? "bg-secondary font-medium text-secondary-foreground"
                        : "text-foreground/80 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { user } = useAuth({ redirectOnUnauthenticated: false });
  const utils = trpc.useUtils();

  const planFlags = trpc.plan.flags.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const viewModeQuery = trpc.user.getViewMode.useQuery(undefined, { staleTime: 5 * 60 * 1000 });

  const setViewMode = trpc.user.setViewMode.useMutation({
    onSuccess: (d) => {
      localStorage.setItem("penna-view-mode", d.viewMode);
      utils.user.getViewMode.invalidate();
    },
  });
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      toast.success("Logget ut");
      window.location.href = "/login";
    },
  });

  const mode: ViewMode = viewModeQuery.data ?? "simple";
  const sections = navForMode(mode, { enkelPlanEnabled: planFlags.data?.enabled === true });
  const loadingNav = viewModeQuery.isLoading || planFlags.isLoading;

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Brand mark */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <PennaMark className="h-7 w-7" />
        <span className="font-display text-xl font-semibold text-primary">Penna</span>
      </div>

      {loadingNav ? (
        <div className="flex-1 space-y-2 px-3 py-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <NavLinks sections={sections} location={location} onNavigate={onNavigate} />
      )}

      {/* Account area */}
      <div className="mt-auto px-3 pb-4">
        <Separator className="mb-3" />

        <div className="px-1 pb-2">
          <BrandSelector />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setViewMode.mutate({ viewMode: mode === "simple" ? "advanced" : "simple" })}
          disabled={setViewMode.isPending}
          className="w-full justify-start gap-3 rounded-xl px-3 text-sm font-normal text-muted-foreground"
        >
          <SlidersHorizontal className="h-[18px] w-[18px]" aria-hidden="true" />
          {mode === "simple" ? "Vis alle verktøy" : "Forenklet visning"}
        </Button>

        <Link
          href="/faq"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <HelpCircle className="h-[18px] w-[18px]" aria-hidden="true" />
          Trenger du hjelp?
        </Link>

        <Link
          href={SETTINGS_ITEM.href}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Settings className="h-[18px] w-[18px]" aria-hidden="true" />
          {SETTINGS_ITEM.label}
        </Link>

        {user && (
          <button
            type="button"
            onClick={() => logout.mutate()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
            Logg ut
          </button>
        )}
      </div>
    </div>
  );
}

export default function AppSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop: fixed, light, always visible */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden border-r border-border md:block"
        style={{ width: SIDEBAR_WIDTH }}
      >
        <SidebarBody />
      </aside>

      {/* Mobile: top bar + slide-over. Not a shrunken desktop sidebar. */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Åpne meny"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <PennaMark className="h-6 w-6" />
          <span className="font-display text-lg font-semibold text-primary">Penna</span>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Lukk meny"
            className="absolute inset-0 bg-foreground/20"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute inset-y-0 left-0 w-[17rem] shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Meny"
          >
            <Button
              variant="ghost"
              size="icon"
              aria-label="Lukk meny"
              className="absolute right-2 top-3 z-10"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
            <SidebarBody onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

export { SIDEBAR_WIDTH };
