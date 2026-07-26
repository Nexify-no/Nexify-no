/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useLocation } from "wouter";
import GlobalNav from "./GlobalNav";
import DashboardNav from "./DashboardNav";
import AppSidebar from "./app-shell/AppSidebar";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import { useState, useEffect } from "react";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

/**
 * New app shell (Batch 1 of the UI refresh) — OFF unless explicitly enabled.
 *
 * This is a BUILD-TIME flag: Vite inlines it at compile time, so changing it on
 * Render requires "Save, rebuild, and deploy" — a plain redeploy reuses the old
 * build and the new value never reaches the bundle. There is no instant runtime
 * kill switch in this batch; that would need a server- or DB-driven flag.
 *
 * When off, this file behaves exactly as before: DashboardNav, same margins.
 */
const NEW_SHELL = import.meta.env.VITE_FEATURE_NEW_SHELL === "true";

interface PageLayoutProps {
  children: React.ReactNode;
}

export default function PageLayout({ children }: PageLayoutProps) {
  const [location] = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === "true";
  });

  // Keep the content margin in sync with the sidebar. Same-tab: a CustomEvent from
  // DashboardNav updates instantly (storage events don't fire in the same tab).
  // Cross-tab: the storage event keeps other tabs aligned.
  useEffect(() => {
    const handleStorage = () => {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      setSidebarCollapsed(saved === "true");
    };
    const handleCustom = (e: Event) => {
      setSidebarCollapsed(Boolean((e as CustomEvent).detail));
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("sidebar-collapsed-change", handleCustom as EventListener);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("sidebar-collapsed-change", handleCustom as EventListener);
    };
  }, []);
  
  // Public / auth / standalone pages that must NOT show the app sidebar.
  // Everything ELSE — the whole authenticated app, including every Norwegian
  // route alias (/generer, /innlegg, /trender, /priser, ...) and all /admin
  // and /payment pages — shows DashboardNav. Using a blacklist (instead of a
  // whitelist) guarantees the sidebar stays fixed on every app page, and that
  // new pages get it automatically.
  const noSidebarExact = new Set([
    "/", "/landing", "/login", "/reset-password", "/404",
    "/kom-i-gang", "/onboarding", // first-run wizard: full-screen, one task per screen
    "/blog", "/blogg",
    "/about-us", "/om-oss",
    "/faq",
    "/contact", "/kontakt",
    "/privacy", "/privacy-policy", "/personvern",
    "/terms", "/terms-of-service", "/vilkar",
    "/cookie-policy", "/salgsbetingelser",
  ]);
  const noSidebarPrefixes = ["/blog/", "/blogg/"];
  const isNoSidebar =
    noSidebarExact.has(location) ||
    noSidebarPrefixes.some((path) => location.startsWith(path));

  // Public marketing pages that show the public top nav (GlobalNav).
  const publicNavExact = new Set([
    "/blog", "/blogg",
    "/about-us", "/om-oss",
    "/faq",
    "/contact", "/kontakt",
    "/privacy", "/privacy-policy", "/personvern",
    "/terms", "/terms-of-service", "/vilkar",
    "/cookie-policy", "/salgsbetingelser",
  ]);
  const publicNavPrefixes = ["/blog/", "/blogg/"];

  // Sidebar is fixed on every app page; public/auth pages are the only exceptions.
  const shouldShowDashboardNav = !isNoSidebar;
  const shouldShowGlobalNav =
    publicNavExact.has(location) ||
    publicNavPrefixes.some((path) => location.startsWith(path));
  
  // New shell: only for app pages. Public, auth, legal and blog pages keep the
  // current look untouched, because `.penna-app` (and its tokens) never wraps
  // them and AppSidebar is not mounted there.
  if (NEW_SHELL && shouldShowDashboardNav) {
    return (
      <div className="penna-app min-h-screen">
        <AppSidebar />
        <div className="md:ml-64">
          <RouteErrorBoundary resetKey={location}>
            {children}
          </RouteErrorBoundary>
        </div>
      </div>
    );
  }

  return (
    <>
      {shouldShowDashboardNav && <DashboardNav />}
      {shouldShowGlobalNav && <GlobalNav />}
      <div 
        className={
          shouldShowDashboardNav 
            ? `transition-all duration-300 ${sidebarCollapsed ? "md:ml-16" : "md:ml-60"}`
            : ""
        }
      >
        <RouteErrorBoundary resetKey={location}>
          {children}
        </RouteErrorBoundary>
      </div>
    </>
  );
}