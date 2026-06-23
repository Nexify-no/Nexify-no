/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Sentry must be initialised before express and other instrumented modules are
// imported (Sentry v8+ auto-instrumentation requirement). This module is imported
// first from index.ts (right after dotenv), so the init runs before those imports
// are evaluated. No-ops when SENTRY_DSN is unset.
import { initSentry } from "./sentry";

initSentry();