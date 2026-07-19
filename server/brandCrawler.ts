import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_PAGES = 8;
const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 12_000;
const PRIORITY = /(?:about|om-oss|services|tjenester|products|produkter|pricing|priser|case|referanser|faq|blogg?|kontakt)/i;

export type CrawledBrandPage = {
  url: string;
  title: string;
  description: string;
  text: string;
};

export type CrawledBrandSite = {
  rootUrl: string;
  pages: CrawledBrandPage[];
  colors: string[];
  fonts: string[];
  logoUrl?: string;
};

export function normalizeWebsiteUrl(value: string): URL {
  const raw = value.trim();
  if (/^[a-z][a-z\d+.-]*:/i.test(raw) && !/^https?:/i.test(raw)) {
    throw new Error("Bare HTTP- og HTTPS-adresser støttes.");
  }
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Bare HTTP- og HTTPS-adresser støttes.");
  if (url.username || url.password) throw new Error("Nettadressen kan ikke inneholde brukernavn eller passord.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("Nettadressen bruker en port som ikke støttes.");
  url.hash = "";
  return url;
}

function isUnsafeIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19));
}

export function isUnsafeAddress(ip: string): boolean {
  if (isIP(ip) === 4) return isUnsafeIPv4(ip);
  const value = ip.toLowerCase();
  return value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd") ||
    /^fe[89ab]/.test(value) || value.startsWith("2001:db8") ||
    (value.startsWith("::ffff:") && isUnsafeIPv4(value.slice(7)));
}

async function assertPublicUrl(url: URL) {
  if (["localhost", "localhost.localdomain"].includes(url.hostname.toLowerCase())) {
    throw new Error("Lokale eller private nettadresser er ikke tillatt.");
  }
  let addresses: Awaited<ReturnType<typeof lookup>>;
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("Fant ikke nettstedet. Kontroller adressen og prøv igjen.");
  }
  if (!addresses.length || addresses.some(({ address }) => isUnsafeAddress(address))) {
    throw new Error("Lokale eller private nettadresser er ikke tillatt.");
  }
}

async function safeFetch(start: URL): Promise<{ response: Response; finalUrl: URL }> {
  let current = start;
  for (let redirects = 0; redirects <= 4; redirects++) {
    await assertPublicUrl(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(current, {
        signal: controller.signal,
        redirect: "manual",
        headers: { "user-agent": "PennaBrandBot/1.0 (+https://penna.no)" },
      });
    } finally {
      clearTimeout(timer);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Nettstedet svarte med en ugyldig videresending.");
      current = normalizeWebsiteUrl(new URL(location, current).toString());
      continue;
    }
    return { response, finalUrl: current };
  }
  throw new Error("Nettstedet videresendte for mange ganger.");
}

async function readBoundedText(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let output = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BYTES) {
      await reader.cancel();
      throw new Error("Nettsiden er for stor til å analyseres.");
    }
    output += decoder.decode(value, { stream: true });
  }
  return output + decoder.decode();
}

function decodeEntities(value: string) {
  return value.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}

function attr(tag: string, name: string): string {
  return tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1]?.trim() ?? "";
}

function extract(html: string, url: URL) {
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const meta = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]*>/i)?.[0] ?? "";
  const description = decodeEntities(attr(meta, "content"));
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["']/gi)].map((m) => {
    try { return new URL(m[1], url); } catch { return null; }
  }).filter((v): v is URL => !!v && /^https?:$/.test(v.protocol) && v.origin === url.origin);
  const logoTag = html.match(/<(?:img|link)[^>]+(?:class|id|rel)=["'][^"']*logo[^"']*["'][^>]*>/i)?.[0];
  let logoUrl: string | undefined;
  const logoSrc = logoTag ? (attr(logoTag, "src") || attr(logoTag, "href")) : "";
  try { if (logoSrc) logoUrl = new URL(logoSrc, url).toString(); } catch { /* ignore */ }
  const colors = [...html.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toUpperCase());
  const fonts = [...html.matchAll(/font-family\s*:\s*([^;}]+)/gi)].flatMap((m) => m[1].split(","))
    .map((f) => f.replace(/["']/g, "").trim()).filter((f) => f && !/^(inherit|initial|sans-serif|serif)$/i.test(f));
  const cleaned = html
    .replace(/<(script|style|noscript|svg|iframe|nav|footer)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ").replace(/<[^>]+>/g, " ");
  const text = decodeEntities(cleaned).replace(/\s+/g, " ").trim().slice(0, 25_000);
  return { title, description, text, links, logoUrl, colors, fonts };
}

export async function crawlBrandSite(input: string): Promise<CrawledBrandSite> {
  const root = normalizeWebsiteUrl(input);
  const queue: URL[] = [root];
  const seen = new Set<string>();
  const pages: CrawledBrandPage[] = [];
  const colors = new Set<string>();
  const fonts = new Set<string>();
  let logoUrl: string | undefined;

  while (queue.length && pages.length < MAX_PAGES) {
    const requested = queue.shift()!;
    const key = `${requested.origin}${requested.pathname.replace(/\/$/, "") || "/"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const { response, finalUrl } = await safeFetch(requested);
      if (!response.ok) continue;
      if (!(response.headers.get("content-type") ?? "").toLowerCase().includes("text/html")) continue;
      const declared = Number(response.headers.get("content-length") ?? 0);
      if (declared > MAX_BYTES) continue;
      const html = await readBoundedText(response);
      const data = extract(html, finalUrl);
      if (data.text.length < 80) continue;
      pages.push({ url: finalUrl.toString(), title: data.title, description: data.description, text: data.text });
      data.colors.slice(0, 20).forEach((v) => colors.add(v));
      data.fonts.slice(0, 10).forEach((v) => fonts.add(v));
      logoUrl ||= data.logoUrl;
      const candidates = data.links.filter((link) => !seen.has(`${link.origin}${link.pathname.replace(/\/$/, "") || "/"}`));
      candidates.sort((a, b) => Number(PRIORITY.test(b.pathname)) - Number(PRIORITY.test(a.pathname)));
      queue.push(...candidates.slice(0, 30));
    } catch (error) {
      if (pages.length === 0 && queue.length === 0) throw error;
    }
  }
  if (!pages.length) throw new Error("Fant ikke lesbart innhold på nettstedet.");
  return { rootUrl: root.toString(), pages, colors: [...colors].slice(0, 8), fonts: [...fonts].slice(0, 6), logoUrl };
}
