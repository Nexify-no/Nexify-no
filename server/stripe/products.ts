/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Stripe Products and Prices Configuration
 *
 * Numbers are derived from the single pricing source of truth (@shared/pricing) so
 * the backend can never drift from the landing page / pricing page. The internal
 * product KEYS (FREE/PRO/ENTERPRISE) are kept stable for the payment + webhook
 * plumbing; the third tier is presented to users as "Premium".
 */

import { getPlan, yearlyNOK, FREE_POSTS, ANNUAL_DISCOUNT } from "@shared/pricing";

const FREE = getPlan("FREE");
const PRO = getPlan("PRO");
const PREMIUM = getPlan("PREMIUM");
const SAVE_PCT = Math.round(ANNUAL_DISCOUNT * 100); // 10

export const STRIPE_PRODUCTS = {
  // Free tier - no payment required, managed through the trial system
  FREE: {
    name: FREE.name,
    description: `${FREE.postsPerMonth} AI-genererte innlegg per måned`,
    priceNOK: FREE.monthlyNOK,
    interval: "month" as const,
    features: [
      `${FREE.postsPerMonth} AI-genererte innlegg per måned`,
      "Alle plattformer",
      "Grunnleggende support",
    ],
  },

  // Pro tier - main revenue driver
  PRO_MONTHLY: {
    name: PRO.name,
    description: `${PRO.postsPerMonth} AI-genererte innlegg per måned + alle funksjoner`,
    priceNOK: PRO.monthlyNOK,
    interval: "month" as const,
    features: [
      `${PRO.postsPerMonth} AI-genererte innlegg per måned`,
      "AI-bildegenerering",
      "Alle plattformer (LinkedIn, Instagram, Facebook, Twitter)",
      "Innholdskalender med smart planlegging",
      "Gjenbruk av innlegg",
      "Stemmetrening - AI lærer din skrivestil",
      "Trend og Inspirasjon",
      "AI Content Coach",
      "Prioritert support",
    ],
  },

  PRO_YEARLY: {
    name: `${PRO.name} Årlig`,
    description: `${PRO.postsPerMonth} innlegg/måned (spar ${SAVE_PCT}%)`,
    priceNOK: yearlyNOK(PRO.monthlyNOK), // 2149
    interval: "year" as const,
    features: [
      "Alt i Pro Månedlig",
      `Spar ${SAVE_PCT}% sammenlignet med månedlig`,
      "Prioritet i ny funksjonalitet",
    ],
  },

  // Third tier - presented as "Premium" (internal key kept as ENTERPRISE)
  ENTERPRISE_MONTHLY: {
    name: PREMIUM.name,
    description: `${PREMIUM.postsPerMonth} AI-genererte innlegg per måned for byråer og team`,
    priceNOK: PREMIUM.monthlyNOK,
    interval: "month" as const,
    features: [
      `${PREMIUM.postsPerMonth} AI-genererte innlegg per måned`,
      "Alt i Pro inkludert",
      "Multi-bruker tilgang",
      "Avansert stemmetrening",
      "Automatisering og planlegging",
      "Månedlige rapporter",
      "Dedikert support",
    ],
  },

  ENTERPRISE_YEARLY: {
    name: `${PREMIUM.name} Årlig`,
    description: `${PREMIUM.postsPerMonth} innlegg/måned (spar ${SAVE_PCT}%)`,
    priceNOK: yearlyNOK(PREMIUM.monthlyNOK), // 4309
    interval: "year" as const,
    features: [
      "Alt i Premium Månedlig",
      `Spar ${SAVE_PCT}% sammenlignet med månedlig`,
      "Kvartalsvis strategisk gjennomgang",
    ],
  },
};

export const TRIAL_LIMITS = {
  posts: FREE_POSTS,
  durationDays: 14,
};

// Subscription limits by tier (monthlyPosts mirrors @shared/pricing)
export const SUBSCRIPTION_LIMITS = {
  FREE: {
    monthlyPosts: FREE.postsPerMonth,
    platforms: 4,
    aiImages: false,
    contentCalendar: false,
    repurpose: false,
    analytics: false,
    apiAccess: false,
  },
  PRO: {
    monthlyPosts: PRO.postsPerMonth,
    platforms: 4,
    aiImages: true,
    contentCalendar: true,
    repurpose: true,
    analytics: true,
    apiAccess: false,
  },
  ENTERPRISE: {
    monthlyPosts: PREMIUM.postsPerMonth,
    platforms: 4,
    aiImages: true,
    contentCalendar: true,
    repurpose: true,
    analytics: true,
    apiAccess: true,
  },
};

export type ProductKey = keyof typeof STRIPE_PRODUCTS;
export type SubscriptionTier = "FREE" | "PRO" | "ENTERPRISE";

/**
 * Map product keys to subscription tiers
 */
export function getSubscriptionTier(productKey: ProductKey): SubscriptionTier {
  if (productKey.startsWith("ENTERPRISE")) return "ENTERPRISE";
  if (productKey.startsWith("PRO")) return "PRO";
  return "FREE";
}

/**
 * Get subscription limits for a tier
 */
export function getSubscriptionLimits(tier: SubscriptionTier) {
  return SUBSCRIPTION_LIMITS[tier];
}