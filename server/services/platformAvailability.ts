/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { isMetaConfigured } from "./metaConfig";
import { isXConfigured } from "./xConfig";

export interface PlatformAvailability {
  linkedin: boolean;
  facebook: boolean;
  instagram: boolean;
  twitter: boolean;
}

/**
 * Which channels THIS installation can connect — derived from configuration, not
 * from a hand-maintained list.
 *
 * Both failure modes have already happened on the settings screen. Three cards
 * were hardcoded "(kommer snart)" and stayed grey for weeks after Facebook
 * actually shipped; and every card rendered as live whether or not an app
 * existed behind it, so an unconfigured channel looked connectable until the
 * user clicked and got an error.
 *
 * Reading the credentials fixes both directions at once: set the env vars and the
 * card opens, unset them and it closes. Only presence is exposed, never a value.
 */
export function getPlatformAvailability(): PlatformAvailability {
  // Instagram is not a separate connection — Meta reaches it through the
  // Facebook Page it is linked to, on the same app. It is available exactly when
  // Facebook is, and any other answer would be a lie in one direction or the other.
  const meta = isMetaConfigured();
  return {
    linkedin: Boolean(process.env.LINKEDIN_CLIENT_ID?.trim() && process.env.LINKEDIN_CLIENT_SECRET?.trim()),
    facebook: meta,
    instagram: meta,
    twitter: isXConfigured(),
  };
}
