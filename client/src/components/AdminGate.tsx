/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * One admin gate, because six hand-written copies of it all had the same bug.
 *
 * Auth resolves asynchronously: `user` is null on the first render of every
 * visit, before the session has even been asked for. Every admin page tested
 * `user` directly, so each one concluded that a signed-in administrator was a
 * stranger:
 *
 *   - /admin/users  → `window.location.href = "/login"`, and /login (seeing a
 *                     valid session) bounced to /dashboard. The page was
 *                     unreachable — clicking "Users" just returned you to the
 *                     dashboard, with no error in the console and no failed
 *                     request to point at.
 *   - /admin/monitoring → `navigate("/login")`, same bounce.
 *   - /admin, /admin/dashboard, /admin/support, /admin/analytics → a full-screen
 *                     "Access Denied" that flickered away once the session
 *                     arrived.
 *
 * Two rules, and the second is the one the first version of this file got wrong:
 *
 *   1. An unanswered question is not a "no". Nothing is decided while loading.
 *   2. A FAILED question is not a "no" either. If the session request errors —
 *      a dropped connection, a 502 during a deploy — that is not evidence the
 *      person is signed out, and redirecting them to /login on it reproduces
 *      the exact bounce this file exists to prevent. Say so and offer a retry.
 */

import { useEffect } from "react";
import { AlertCircle, WifiOff } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

export type AdminGateState = "loading" | "error" | "anonymous" | "forbidden" | "ok";

/**
 * The single auth read an admin page should make.
 *
 * Backed by `auth.me` through react-query, which is what the rest of the app —
 * including the nav rendered alongside these pages — already uses. The result is
 * shared from one cache instead of each page opening its own session request,
 * so moving between admin pages no longer re-resolves auth or flashes a spinner.
 */
export function useAdminGate() {
  const { user, loading, error, refresh } = useAuth();
  const state: AdminGateState = loading
    ? "loading"
    : error
      ? "error"
      : !user
        ? "anonymous"
        : (user as { role?: string }).role !== "admin"
          ? "forbidden"
          : "ok";
  return { state, user, isAdmin: state === "ok", retry: refresh };
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
    </div>
  );
}

/** What to render for every state except `ok`. */
export function AdminGateScreen({
  state,
  onRetry,
}: {
  state: Exclude<AdminGateState, "ok">;
  onRetry?: () => void;
}) {
  // The redirect belongs in an effect: navigating during render warns in React
  // and can loop against the router.
  useEffect(() => {
    if (state === "anonymous") window.location.href = getLoginUrl();
  }, [state]);

  // `anonymous` is already navigating away — show the spinner rather than an
  // accusatory "no access" for the half-second before the page changes.
  if (state === "loading" || state === "anonymous") return <Spinner />;

  if (state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <WifiOff className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Fikk ikke kontakt</h1>
          <p className="text-muted-foreground mt-2">
            Vi klarte ikke å bekrefte innloggingen din. Du er ikke logget ut — prøv igjen.
          </p>
          {onRetry ? (
            <button
              onClick={onRetry}
              className="mt-6 rounded-md border px-4 py-2 text-sm hover:bg-accent"
            >
              Prøv igjen
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold">Ingen tilgang</h1>
        <p className="text-muted-foreground mt-2">Denne siden er kun for administratorer.</p>
      </div>
    </div>
  );
}

export default AdminGateScreen;
