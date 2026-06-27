/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Server-side rendering for the PUBLIC blog surface (/blog and /blog/:slug).
 *
 * Why: penna.no is a Vite/React SPA. The raw HTML it serves is an empty
 * shell (`<div id="root"></div>`) — the real content only appears after the
 * browser runs the JS bundle. That is invisible to:
 *   - Googlebot's first crawl wave (HTML-only; JS render is queued/delayed,
 *     which is especially slow for a brand-new, no-authority domain), and
 *   - AI answer engines (GPTBot, ClaudeBot, PerplexityBot, Bingbot/Copilot)
 *     which mostly do NOT execute JavaScript at all.
 *
 * This middleware renders the article's text + metadata + JSON-LD directly
 * into the HTML the server sends, so crawlers and answer engines see real
 * content. The React app still boots and replaces #root on mount (the client
 * uses createRoot().render(), not hydrateRoot — so there is no hydration
 * mismatch). The logged-in app surface stays a normal SPA.
 *
 * Activates only in production (when the built shell exists). In dev it falls
 * through to the Vite middleware untouched.
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import fs from "fs";
import path from "path";
import { sanitizeHtml } from "../_core/sanitizeHtml";

const router = Router();

const SITE = process.env.PUBLIC_SITE_URL || "https://penna.no";

/** Path to the built SPA shell. null in dev (→ fall through to Vite). */
function shellPath(): string | null {
  const p = path.resolve(import.meta.dirname, "public", "index.html");
  return fs.existsSync(p) ? p : null;
}

let _shell: string | null = null;
function readShell(): string | null {
  if (_shell) return _shell;
  const p = shellPath();
  if (!p) return null;
  try {
    _shell = fs.readFileSync(p, "utf-8");
    return _shell;
  } catch {
    return null;
  }
}

function escAttr(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function escText(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function stripTags(s: string): string {
  return String(s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function parseTags(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  const s = String(raw).trim();
  if (s.startsWith("[")) {
    try { const a = JSON.parse(s); if (Array.isArray(a)) return a.map(String); } catch { /* fall through */ }
  }
  return s.split(",").map((t) => t.trim()).filter(Boolean);
}

/** Build FAQPage entities from a "Vanlige spørsmål" Q&A block in the content. */
function extractFaq(content: string): { q: string; a: string }[] {
  const faqs: { q: string; a: string }[] = [];
  const re = /<p>\s*<strong>([^<]*\?)<\/strong>\s*<br\s*\/?>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const q = stripTags(m[1]);
    const a = stripTags(m[2]);
    if (q && a) faqs.push({ q, a });
  }
  return faqs;
}

/** Replace the homepage-specific head tags so we don't ship duplicates. */
function stripHomepageHead(html: string): string {
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/\s*<meta\s+name="(title|description|keywords)"[^>]*>/gi, "")
    .replace(/\s*<link\s+rel="canonical"[^>]*>/gi, "")
    .replace(/\s*<meta\s+property="(og|twitter):[^"]*"[^>]*>/gi, "");
}

function renderArticle(post: any): string {
  const shell = readShell();
  if (!shell) return "";

  const title = `${post.title} | Penna`;
  const desc = stripTags(post.excerpt || "").slice(0, 160);
  const url = `${SITE}/blog/${post.slug}`;
  const img = `${SITE}/og-image.png`;
  const iso = post.createdAt ? new Date(post.createdAt).toISOString() : undefined;
  const tags = parseTags(post.tags);
  const safeContent = sanitizeHtml(post.content || "");

  const articleLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: desc,
    image: img,
    url,
    inLanguage: "nb-NO",
    author: { "@type": "Organization", name: post.authorName || "Penna", url: SITE },
    publisher: {
      "@type": "Organization",
      name: "Penna",
      logo: { "@type": "ImageObject", url: `${SITE}/apple-touch-icon.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };
  if (iso) { articleLd.datePublished = iso; articleLd.dateModified = iso; }

  const faqs = extractFaq(post.content || "");
  const faqLd = faqs.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }
    : null;

  let head =
    `\n    <title>${escText(title)}</title>` +
    `\n    <meta name="title" content="${escAttr(title)}" />` +
    `\n    <meta name="description" content="${escAttr(desc)}" />` +
    `\n    <meta name="robots" content="index, follow" />` +
    `\n    <link rel="canonical" href="${escAttr(url)}" />` +
    `\n    <meta property="og:type" content="article" />` +
    `\n    <meta property="og:url" content="${escAttr(url)}" />` +
    `\n    <meta property="og:title" content="${escAttr(post.title)}" />` +
    `\n    <meta property="og:description" content="${escAttr(desc)}" />` +
    `\n    <meta property="og:image" content="${escAttr(img)}" />` +
    `\n    <meta property="og:locale" content="nb_NO" />` +
    `\n    <meta property="twitter:card" content="summary_large_image" />` +
    `\n    <meta property="twitter:title" content="${escAttr(post.title)}" />` +
    `\n    <meta property="twitter:description" content="${escAttr(desc)}" />` +
    `\n    <meta property="twitter:image" content="${escAttr(img)}" />` +
    `\n    <script type="application/ld+json">${JSON.stringify(articleLd)}</script>`;
  if (faqLd) head += `\n    <script type="application/ld+json">${JSON.stringify(faqLd)}</script>`;

  const tagHtml = tags.length
    ? `<p class="ssr-tags">Emner: ${tags.map(escText).join(", ")}</p>`
    : "";
  const body =
    `<main data-ssr="blog-article">` +
    `<article>` +
    `<nav aria-label="brødsmuler"><a href="/">Hjem</a> / <a href="/blog">Blogg</a> / <span>${escText(post.title)}</span></nav>` +
    `<h1>${escText(post.title)}</h1>` +
    `<p class="ssr-excerpt">${escText(stripTags(post.excerpt || ""))}</p>` +
    `<div class="ssr-content">${safeContent}</div>` +
    tagHtml +
    `<p><a href="/blog">← Tilbake til bloggen</a> · <a href="/">Prøv Penna gratis →</a></p>` +
    `</article></main>`;

  let html = stripHomepageHead(shell);
  html = html.replace("</head>", `${head}\n  </head>`);
  html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  return html;
}

function renderIndex(posts: any[]): string {
  const shell = readShell();
  if (!shell) return "";
  const title = "Blogg — tips og guider om innholdsproduksjon med AI | Penna";
  const desc =
    "Praktiske guider om AI-innhold, LinkedIn, Instagram og sosiale medier for norske bedrifter. Lær å lage bedre innlegg på kortere tid med Penna.";
  const url = `${SITE}/blog`;
  const img = `${SITE}/og-image.png`;

  const items = posts
    .map(
      (p) =>
        `<li><a href="/blog/${escAttr(p.slug)}"><h2>${escText(p.title)}</h2></a>` +
        `<p>${escText(stripTags(p.excerpt || "").slice(0, 200))}</p></li>`
    )
    .join("");

  const head =
    `\n    <title>${escText(title)}</title>` +
    `\n    <meta name="title" content="${escAttr(title)}" />` +
    `\n    <meta name="description" content="${escAttr(desc)}" />` +
    `\n    <meta name="robots" content="index, follow" />` +
    `\n    <link rel="canonical" href="${escAttr(url)}" />` +
    `\n    <meta property="og:type" content="website" />` +
    `\n    <meta property="og:url" content="${escAttr(url)}" />` +
    `\n    <meta property="og:title" content="${escAttr(title)}" />` +
    `\n    <meta property="og:description" content="${escAttr(desc)}" />` +
    `\n    <meta property="og:image" content="${escAttr(img)}" />` +
    `\n    <meta property="og:locale" content="nb_NO" />` +
    `\n    <meta property="twitter:card" content="summary_large_image" />` +
    `\n    <meta property="twitter:title" content="${escAttr(title)}" />` +
    `\n    <meta property="twitter:description" content="${escAttr(desc)}" />` +
    `\n    <meta property="twitter:image" content="${escAttr(img)}" />`;

  const body =
    `<main data-ssr="blog-index"><h1>Penna Blogg</h1>` +
    `<p>${escText(desc)}</p><ul>${items}</ul></main>`;

  let html = stripHomepageHead(shell);
  html = html.replace("</head>", `${head}\n  </head>`);
  html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  return html;
}

// GET /blog/:slug — server-render a single article.
router.get("/blog/:slug", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!readShell()) return next(); // dev → Vite SPA
    const slug = String(req.params.slug || "").trim();
    if (!slug) return next();

    const { getDb } = await import("../db");
    const { blogPosts } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return next();

    // Read-only fetch (does NOT increment view_count — avoids bot inflation).
    const rows = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1);
    const post = rows[0];
    if (!post || post.published !== 1) return next();

    const html = renderArticle(post);
    if (!html) return next();
    res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).end(html);
  } catch (err) {
    console.error("[blogSsr] article error:", err instanceof Error ? err.message : err);
    return next(); // never break the page — fall through to the SPA
  }
});

// GET /blog — server-render the blog index (list of articles).
router.get("/blog", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    if (!readShell()) return next();
    const { getAllBlogPosts } = await import("../db");
    const posts = await getAllBlogPosts();
    const html = renderIndex(posts);
    if (!html) return next();
    res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).end(html);
  } catch (err) {
    console.error("[blogSsr] index error:", err instanceof Error ? err.message : err);
    return next();
  }
});

export default router;
