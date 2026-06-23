/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useLocation } from "wouter";
import GlobalNav from "./GlobalNav";
import DashboardNav from "./DashboardNav";
import { useState, useEffect } from "react";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

interface PageLayoutProps {
  children: React.ReactNode;
}

export default function PageLayout({ children }: PageLayoutProps) {
  const [location] = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === "true";
  });

  // Listen for sidebar state changes from localStorage
  useEffect(() => {
    const handleStorage = () => {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      setSidebarCollapsed(saved === "true");
    };
    
    // Check periodically for changes (since storage events don't fire in same tab)
    const interval = setInterval(handleStorage, 300);
    window.addEventListener("storage", handleStorage);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);
  
  // Pages that show DashboardNav (authenticated internal pages)
  const dashboardPages = [
    "/dashboard",
    "/generate",
    "/posts",
    "/coach",
    "/settings",
    "/account-settings",
    "/trends",
    "/voice-training",
    "/kalender",
    "/kalender-old",
    "/best-time",
    "/repurpose",
    "/telegram-bot",
    "/telegram-posts",
    "/competitor-radar",
    "/content-series",
    "/ab-testing",
    "/weekly-report",
    "/engagement-helper",
    "/idea-bank",
    "/examples",
    "/admin/analytics",
    "/admin/blog",
    "/admin/settings",
    "/admin/members",
    "/pricing",
    "/analytics",
    "/progress",
    "/subscription/success",
    "/subscription/cancel",
    "/profile"
  ];
  
  // Pages that show GlobalNav (public pages)
  const publicPages = [
    "/blog",
    "/about-us",
    "/faq",
    "/contact",
    "/privacy-policy",
    "/terms-of-service",
    "/cookie-policy",
    "/privacy",
    "/terms"
  ];
  
  const shouldShowDashboardNav = dashboardPages.some(path => location.startsWith(path));
  const shouldShowGlobalNav = publicPages.some(path => location.startsWith(path));
  
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
        {children}
      </div>
    </>
  );
}