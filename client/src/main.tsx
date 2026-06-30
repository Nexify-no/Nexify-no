/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";
import "./animations.css";
import { LanguageProvider } from "./contexts/LanguageContext";
import { HelmetProvider } from 'react-helmet-async';
import { toast } from "sonner";

// Retry only TRANSIENT failures. AI calls (post/image generation) occasionally
// fail on the very first request after a cold connection — retrying transparently
// removes the "failed first time, worked on retry" experience. We must NOT retry
// deterministic/terminal errors (validation, auth, monthly-limit, quota), which
// would waste AI spend and could double-charge.
const NON_RETRIABLE_TRPC_CODES = new Set([
  "BAD_REQUEST", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "CONFLICT",
  "PRECONDITION_FAILED", "PAYLOAD_TOO_LARGE", "UNPROCESSABLE_CONTENT",
  "METHOD_NOT_SUPPORTED", "PARSE_ERROR", "UNSUPPORTED_MEDIA_TYPE",
]);

function isRetriableError(error: unknown): boolean {
  const e = error as any;
  const msg = String(e?.message || "");
  // Terminal app-level conditions — never retry.
  if (msg === UNAUTHED_ERR_MSG) return false;
  if (/EMAIL_NOT_VERIFIED/.test(msg)) return false;
  if (/grense|kvote|quota|limit|oppgrader|upgrade|abonnement|subscription|krever Pro/i.test(msg)) return false;

  const code = e?.data?.code ?? e?.shape?.data?.code;
  if (code && NON_RETRIABLE_TRPC_CODES.has(code)) return false;

  const httpStatus = e?.data?.httpStatus ?? e?.shape?.data?.httpStatus;
  // 4xx are deterministic except 408 (timeout) and 429 (rate limit → worth a retry).
  if (typeof httpStatus === "number" && httpStatus >= 400 && httpStatus < 500
      && httpStatus !== 408 && httpStatus !== 429) return false;

  // Network/fetch failures (no tRPC shape), 5xx, 408, 429, INTERNAL_SERVER_ERROR,
  // TIMEOUT, and unparsable responses → transient, safe to retry.
  return true;
}

const backoff = (attemptIndex: number, cap: number) =>
  Math.min(1000 * 2 ** attemptIndex, cap) + Math.floor(Math.random() * 250);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => isRetriableError(error) && failureCount < 3,
      retryDelay: (i) => backoff(i, 8000),
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
    mutations: {
      retry: (failureCount, error) => isRetriableError(error) && failureCount < 2,
      retryDelay: (i) => backoff(i, 6000),
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  // Don't bounce visitors off PUBLIC pages just because a background query
  // (e.g. a consent/preferences check) returned "unauthorized". Only redirect
  // to login from protected pages. This prevents the landing page from auto-
  // navigating to /login for logged-out visitors.
  const path = window.location.pathname;
  const PUBLIC_PATHS = new Set([
    "/", "/login", "/landing", "/reset-password",
    "/pricing", "/priser",
    "/about-us", "/om-oss",
    "/faq",
    "/contact", "/kontakt",
    "/privacy", "/privacy-policy", "/personvern",
    "/terms", "/terms-of-service", "/vilkar",
    "/cookie-policy",
    "/salgsbetingelser",
  ]);
  const isPublicPath = PUBLIC_PATHS.has(path) || path.startsWith("/blog");
  if (isPublicPath) return;

  window.location.href = getLoginUrl();
};

const notifyEmailNotVerified = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (error.message !== "EMAIL_NOT_VERIFIED") return;
  toast.error(
    "Bekreft e-postadressen din for å generere innhold. Sjekk innboksen din (også søppelpost) for bekreftelseslenken.",
    { id: "email-not-verified", duration: 8000 }
  );
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    notifyEmailNotVerified(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    notifyEmailNotVerified(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </HelmetProvider>
    </QueryClientProvider>
  </trpc.Provider>
);