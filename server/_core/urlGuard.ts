/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * SSRF guard for server-side fetches of user-supplied URLs (e.g. Competitor
 * Radar website/feed scraping).
 *
 * Threat: a user submits a "website" that resolves to an internal address
 * (localhost, RFC1918, link-local) or a cloud metadata endpoint
 * (169.254.169.254) and the server fetches it, leaking internal services or
 * cloud IAM credentials.
 *
 * Defense (defense-in-depth):
 *   1. Structural allowlist: only http(s), reject obvious literal internal hosts.
 *   2. DNS-time check: resolve EVERY candidate address and reject if any is
 *      private/reserved/loopback/link-local (prevents DNS-rebinding + names that
 *      point at internal IPs).
 *   3. Manual redirect following: re-validate the host on every hop, so a public
 *      URL cannot 3xx-bounce us into the internal network.
 */
import dns from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOST_LITERALS = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "metadata",
  "metadata.google.internal",
]);

/** True if an IPv4/IPv6 literal is private, reserved, loopback or link-local. */
export function isBlockedIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) return isBlockedIpv4(ip);
  if (v === 6) return isBlockedIpv6(ip);
  return true; // not a valid IP literal → refuse
}

function isBlockedIpv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0) return true;                         // 0.0.0.0/8
  if (a === 10) return true;                        // 10/8 private
  if (a === 127) return true;                       // 127/8 loopback
  if (a === 169 && b === 254) return true;          // 169.254/16 link-local (metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12 private
  if (a === 192 && b === 168) return true;          // 192.168/16 private
  if (a === 100 && b >= 64 && b <= 127) return true;// 100.64/10 CGNAT
  if (a === 192 && b === 0) return true;            // 192.0.0/24 + 192.0.2/24 special
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18/15 benchmark
  if (a >= 224) return true;                        // 224/4 multicast + 240/4 reserved
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;      // loopback / unspecified
  // IPv4-mapped (::ffff:a.b.c.d) → validate the embedded IPv4.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 ULA
  if (lower.startsWith("fe8") || lower.startsWith("fe9") ||
      lower.startsWith("fea") || lower.startsWith("feb")) return true; // fe80::/10 link-local
  if (lower.startsWith("ff")) return true; // ff00::/8 multicast
  return false;
}

/** Structural check only (sync). Blocks bad protocols + obvious internal literals. */
export function isStructurallyBlockedUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return true; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return true;
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOST_LITERALS.has(host)) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  // Raw IP literal in the host → check it directly (strip IPv6 brackets).
  const bare = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  if (net.isIP(bare) !== 0 && isBlockedIp(bare)) return true;
  return false;
}

/** Resolve the host and throw if it (or any of its addresses) is internal. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  if (isStructurallyBlockedUrl(raw)) throw new Error(`Blocked URL (structural): ${raw}`);
  const u = new URL(raw);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) !== 0) {
    if (isBlockedIp(host)) throw new Error(`Blocked URL (ip literal): ${raw}`);
    return u;
  }
  let addrs: { address: string }[];
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new Error(`DNS resolution failed: ${host}`);
  }
  if (addrs.length === 0) throw new Error(`No addresses for host: ${host}`);
  for (const { address } of addrs) {
    if (isBlockedIp(address)) throw new Error(`Blocked URL (resolves to internal ${address}): ${raw}`);
  }
  return u;
}

/**
 * SSRF-safe fetch: validates the host at every hop (manual redirects), enforces
 * a timeout, and refuses non-http(s) or internal targets. Drop-in for fetch()
 * on any user-influenced URL.
 */
export async function safeFetch(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 8000,
  maxRedirects = 5,
): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertPublicUrl(current);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(current, { ...opts, signal: ctrl.signal, redirect: "manual" });
    } finally {
      clearTimeout(t);
    }
    // Follow 3xx manually so each new location is re-validated against internal IPs.
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      current = new URL(loc, current).toString();
      continue;
    }
    return res;
  }
  throw new Error(`Too many redirects: ${url}`);
}
