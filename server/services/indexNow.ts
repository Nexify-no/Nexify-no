/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * IndexNow integration.
 *
 * IndexNow lets us instantly notify Bing, Yandex, DuckDuckGo and other
 * participating engines whenever content is published or updated, instead
 * of waiting for them to re-crawl. The key is NOT a secret — it is hosted
 * publicly at https://penna.no/<key>.txt to prove domain ownership.
 */

const HOST = "penna.no";

// Public IndexNow key (also hosted at /<key>.txt). Overridable via env.
export const INDEXNOW_KEY =
  process.env.INDEXNOW_KEY || "33b29b52d08adffa40b30702a5522e94";

export function getIndexNowKey(): string {
  return INDEXNOW_KEY;
}

/**
 * Submit one or more absolute URLs to IndexNow. Fire-and-forget:
 * never throws, never blocks the caller's response.
 */
export async function submitToIndexNow(urls: string[]): Promise<void> {
  const list = (urls || []).filter((u) => typeof u === "string" && u.startsWith("https://"));
  if (list.length === 0) return;
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: HOST,
        key: INDEXNOW_KEY,
        keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
        urlList: list,
      }),
    });
    console.log(`[IndexNow] Submitted ${list.length} URL(s) — HTTP ${res.status}`);
  } catch (err) {
    // Never let a notification failure affect the main request.
    console.error("[IndexNow] Submit failed:", err instanceof Error ? err.message : err);
  }
}

/** Convenience: submit a single blog post by slug. */
export async function submitBlogPostToIndexNow(slug: string): Promise<void> {
  if (!slug) return;
  await submitToIndexNow([`https://${HOST}/blog/${slug}`]);
}
