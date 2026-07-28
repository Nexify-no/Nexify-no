/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * One Meta Graph API surface for the whole app.
 *
 * Before this file the codebase spoke to Graph through three different versions
 * at once — v18.0 in the (dead) facebookService, v21.0 in OAuth and publishing,
 * v19.0 in engagement metrics — so a version bump meant finding all three, and a
 * behaviour difference between them looked like a bug in our code. Everything now
 * goes through `GRAPH_VERSION`.
 *
 * It also centralises error handling. Graph answers with HTTP 200 and an `error`
 * object about as often as it answers with a non-2xx, so `response.ok` alone is
 * not a success test; every call site that checked only `ok` was reading
 * `undefined` out of an error body and reporting success.
 */

export const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";

const GRAPH_BASE = "https://graph.facebook.com";

export function graphUrl(path: string, params?: Record<string, string>): string {
  const clean = path.startsWith("/") ? path.slice(1) : path;
  const qs = params ? `?${new URLSearchParams(params)}` : "";
  return `${GRAPH_BASE}/${GRAPH_VERSION}/${clean}${qs}`;
}

export interface GraphError {
  message: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

/**
 * Error code 190 means the token is dead — expired, revoked, or invalidated by a
 * password change. It is the one Graph failure the user can actually fix, and it
 * needs a different sentence from "something went wrong": reconnect.
 */
export const TOKEN_INVALID_CODE = 190;

export class MetaGraphError extends Error {
  readonly code?: number;
  readonly subcode?: number;
  readonly traceId?: string;

  constructor(context: string, error: GraphError | undefined, statusText?: string) {
    const base = error?.message ?? statusText ?? "ukjent feil";
    const reconnect =
      error?.code === TOKEN_INVALID_CODE
        ? " — tilkoblingen til Meta er utløpt, koble til på nytt."
        : "";
    super(`${context}: ${base}${reconnect}`);
    this.name = "MetaGraphError";
    this.code = error?.code;
    this.subcode = error?.error_subcode;
    this.traceId = error?.fbtrace_id;
  }

  get needsReconnect(): boolean {
    return this.code === TOKEN_INVALID_CODE;
  }
}

/**
 * Call Graph and return the parsed body, or throw a MetaGraphError.
 *
 * `context` is a short human phrase used as the error prefix ("Facebook-sider",
 * "Instagram-publisering") so a failure says which step broke without the caller
 * having to wrap it again.
 */
export async function graphFetch<T>(
  context: string,
  url: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    throw new MetaGraphError(context, {
      message: cause instanceof Error ? cause.message : "nettverksfeil",
    });
  }

  const body = (await response.json().catch(() => ({}))) as T & { error?: GraphError };

  // Both halves matter. A non-2xx with an unparseable body still has to fail, and
  // a 200 carrying an `error` object is a failure Graph chose to dress as success.
  if (!response.ok || body?.error) {
    throw new MetaGraphError(context, body?.error, response.statusText);
  }
  return body;
}

/** POST with a form body — the encoding every Graph write endpoint expects. */
export async function graphPost<T>(
  context: string,
  path: string,
  form: Record<string, string>,
): Promise<T> {
  return graphFetch<T>(context, graphUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
  });
}

/**
 * The permissions the Meta connect flow asks for.
 *
 *  - pages_show_list        read /me/accounts to find the user's Pages
 *  - pages_manage_posts     publish to a Page
 *  - pages_read_engagement  read the Page's own post metrics
 *  - business_management    needed when the Page is owned by a Business Manager
 *  - instagram_basic        discover the Page's linked Instagram account
 *  - instagram_content_publish  publish to that Instagram account
 *
 * All of these are Advanced Access permissions: they work in development mode for
 * accounts that admin the app, and require Meta App Review (plus Business
 * Verification of the legal entity) before any other user can grant them.
 */
export const META_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
].join(",");

/** Graph only accepts a public http(s) URL for a photo or an IG media container. */
export function isPubliclyFetchableImage(url: string | null | undefined): url is string {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}
