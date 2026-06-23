/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Single source of truth for subscription pricing.
 *
 * Mirror this EVERYWHERE — landing page (Home.tsx), the /pricing page, the backend
 * Stripe config (server/stripe/products.ts) and quota enforcement. Never hard-code a
 * price or post count anywhere else; import from here so the numbers can't drift.
 *
 * Yearly price = monthly × 12 × (1 − ANNUAL_DISCOUNT), rounded to whole NOK.
 */

export const ANNUAL_DISCOUNT = 0.1; // 10 % off when paying yearly

export type PlanKey = "FREE" | "PRO" | "PREMIUM";

export interface Plan {
  key: PlanKey;
  name: string;
  monthlyNOK: number;
  postsPerMonth: number;
  tagline: string;
  highlighted: boolean;
  features: string[];
  notIncluded: string[];
}

/** Yearly total (billed once a year) with the annual discount applied. */
export const yearlyNOK = (monthly: number): number =>
  Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT));

/** Effective per-month price when billed yearly. */
export const yearlyPerMonthNOK = (monthly: number): number =>
  Math.round(yearlyNOK(monthly) / 12);

export const PLANS: Plan[] = [
  {
    key: "FREE",
    name: "Gratis",
    monthlyNOK: 0,
    postsPerMonth: 2,
    tagline: "For å teste plattformen",
    highlighted: false,
    features: ["2 innlegg per måned", "Alle plattformer", "Grunnleggende dashboard"],
    notIncluded: ["Ingen AI-bilder", "Ingen stemmetrening"],
  },
  {
    key: "PRO",
    name: "Pro",
    monthlyNOK: 199,
    postsPerMonth: 15,
    tagline: "For profesjonelle innholdskapere",
    highlighted: true,
    features: [
      "15 innlegg per måned",
      "AI-genererte bilder inkludert",
      "Stemmetrening (din stil)",
      "Trend og Inspirasjon",
      "Innholdskalender",
      "Gjenbruk-maskin",
      "AI Coach & analyse",
      "Prioritert support",
    ],
    notIncluded: [],
  },
  {
    key: "PREMIUM",
    name: "Premium",
    monthlyNOK: 399,
    postsPerMonth: 30,
    tagline: "For byråer og team",
    highlighted: false,
    features: [
      "30 innlegg per måned",
      "Alt i Pro inkludert",
      "Multi-bruker tilgang",
      "Avansert stemmetrening",
      "Automatisering og planlegging",
      "Månedlige rapporter",
      "Dedikert support",
    ],
    notIncluded: [],
  },
];

/** Free-tier monthly allowance (also the trial cap). */
export const FREE_POSTS = 2;
export const TRIAL_DURATION_DAYS = 14;

export const getPlan = (key: PlanKey): Plan => {
  const plan = PLANS.find((p) => p.key === key);
  if (!plan) throw new Error(`Unknown plan: ${key}`);
  return plan;
};