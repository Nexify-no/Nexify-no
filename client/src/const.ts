/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL - redirects to Google OAuth
export const getLoginUrl = () => {
  return "/login";
};