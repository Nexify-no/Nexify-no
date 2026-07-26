/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

import {
  Home, PlusCircle, CalendarDays, Send, BarChart3, Tag,
  Sparkles, List, Clock, Recycle, Lightbulb, Flame, BrainCircuit,
  Mic, MessageSquare, Target, FlaskConical, Mail, Settings,
  type LucideIcon,
} from "lucide-react";

export type ViewMode = "simple" | "advanced";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavSection {
  /** Null for the top-level group, which renders without a heading. */
  title: string | null;
  items: NavItem[];
}

/**
 * Enkel: the six destinations from the approved mockups, in order.
 *
 * Every href already exists in App.tsx — this batch adds no routes and removes
 * none. Labels follow the mockups, so a few differ from the old sidebar
 * ("Mine innlegg" → "Publisert", "Dashboard" → "Oversikt").
 */
export const SIMPLE_NAV: NavItem[] = [
  { label: "Oversikt", href: "/dashboard", icon: Home },
  { label: "Nytt innhold", href: "/generer", icon: PlusCircle },
  { label: "Innholdsplan", href: "/innholdsplan", icon: CalendarDays },
  { label: "Publisert", href: "/innlegg", icon: Send },
  { label: "Resultater", href: "/analytics", icon: BarChart3 },
  { label: "Merkevare", href: "/merkehjerne", icon: Tag },
];

/**
 * Avansert: the full navigation, unchanged from DashboardNav.
 *
 * This list is asserted against in navItems.test.ts so a future edit cannot
 * silently drop a destination from the advanced sidebar.
 */
export const ADVANCED_SECTIONS: NavSection[] = [
  {
    title: null,
    items: [
      { label: "Oversikt", href: "/dashboard", icon: Home },
      { label: "Nytt innhold", href: "/generer", icon: PlusCircle },
      { label: "Publisert", href: "/innlegg", icon: Send },
    ],
  },
  {
    title: "Planlegging",
    items: [
      { label: "Lag plan", href: "/lag-plan", icon: Sparkles },
      { label: "Innholdsplan", href: "/innholdsplan", icon: List },
      { label: "Kalender", href: "/kalender", icon: CalendarDays },
      { label: "Beste tid", href: "/beste-tid", icon: Clock },
      { label: "Gjenbruk", href: "/gjenbruk", icon: Recycle },
      { label: "Innholds-serier", href: "/innholdsserier", icon: List },
      { label: "Idé-bank", href: "/ide-bank", icon: Lightbulb },
    ],
  },
  {
    title: "Inspirasjon",
    items: [
      { label: "Trender", href: "/trender", icon: Flame },
      { label: "Eksempler", href: "/eksempler", icon: Lightbulb },
    ],
  },
  {
    title: "Tilpasning",
    items: [
      { label: "Merkevare", href: "/merkehjerne", icon: BrainCircuit },
      { label: "Stemme", href: "/stemme", icon: Mic },
      { label: "Coach", href: "/coach", icon: MessageSquare },
    ],
  },
  {
    title: "Resultater",
    items: [{ label: "Resultater", href: "/analytics", icon: BarChart3 }],
  },
  {
    title: "Avansert",
    items: [
      { label: "Telegram Bot", href: "/telegram-bot", icon: Send },
      { label: "Telegram Innlegg", href: "/telegram-innlegg", icon: MessageSquare },
      { label: "Konkurrent-radar", href: "/konkurrent-radar", icon: Target },
      { label: "A/B-testing", href: "/ab-testing", icon: FlaskConical },
      { label: "Ukentlig rapport", href: "/ukentlig-rapport", icon: Mail },
      { label: "Engasjement-hjelper", href: "/engasjement-hjelper", icon: MessageSquare },
    ],
  },
];

/** Settings lives in the account area at the bottom, not in the main list. */
export const SETTINGS_ITEM: NavItem = {
  label: "Innstillinger", href: "/innstillinger", icon: Settings,
};

/**
 * The navigation for a view mode.
 *
 * `enkelPlanEnabled` mirrors the existing `plan.flags` gate: when the Enkel plan
 * feature is off, its two destinations are hidden exactly as they are today.
 */
export function navForMode(
  mode: ViewMode,
  opts: { enkelPlanEnabled: boolean },
): NavSection[] {
  const drop = (items: NavItem[]) =>
    opts.enkelPlanEnabled
      ? items
      : items.filter((i) => i.href !== "/lag-plan" && i.href !== "/innholdsplan");

  if (mode === "simple") {
    return [{ title: null, items: drop(SIMPLE_NAV) }];
  }

  return ADVANCED_SECTIONS
    .map((s) => ({ ...s, items: drop(s.items) }))
    .filter((s) => s.items.length > 0);
}

/** Active-state matching, kept identical to the current sidebar's behaviour. */
export function isNavItemActive(href: string, location: string): boolean {
  if (href === "/dashboard") return location === "/dashboard";
  return location.startsWith(href);
}
