/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Which platforms the scheduler can actually publish to.
 *
 * Content can be GENERATED for more platforms than can be PUBLISHED to — Twitter
 * has a connect flow and a preview but no verified publish path — and conflating
 * the two is what let the app accept a scheduled Twitter post and then never
 * publish it. Keep the distinction explicit and in one place; the server enforces
 * the same list in `schedulingRouter` and `schedulerService`.
 */
export const SCHEDULABLE_PLATFORMS = ["linkedin", "facebook", "instagram"] as const;

export type SchedulablePlatform = (typeof SCHEDULABLE_PLATFORMS)[number];

export function isSchedulable(platform: string): platform is SchedulablePlatform {
  return (SCHEDULABLE_PLATFORMS as readonly string[]).includes(platform);
}

/** Why a platform cannot be scheduled, in the user's language. */
export function schedulingUnavailableReason(platform: string): string {
  return `Planlegging er ikke tilgjengelig for ${platform} ennå. Du kan fortsatt publisere manuelt.`;
}
