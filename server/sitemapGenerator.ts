/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Sitemap Generator for SEO
 * Generates dynamic sitemap.xml for search engines
 */

import { getDb } from "./db";

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}

/**
 * Generate sitemap.xml content
 */
export async function generateSitemap(): Promise<string> {
  const baseUrl = process.env.PUBLIC_SITE_URL || "https://innlegg.no";
  const entries: SitemapEntry[] = [];

  // Static pages
  const staticPages = [
    { loc: "/", priority: 1.0, changefreq: "weekly" as const },
    { loc: "/blog", priority: 0.9, changefreq: "daily" as const },
    { loc: "/pricing", priority: 0.8, changefreq: "monthly" as const },
    { loc: "/about", priority: 0.7, changefreq: "monthly" as const },
    { loc: "/contact", priority: 0.7, changefreq: "monthly" as const },
    { loc: "/faq", priority: 0.8, changefreq: "weekly" as const },
    { loc: "/privacy", priority: 0.5, changefreq: "yearly" as const },
    { loc: "/terms", priority: 0.5, changefreq: "yearly" as const },
  ];

  entries.push(...staticPages);

  // Dynamic blog posts
  try {
    const db = await getDb();
    if (db) {
      const posts = await (db as any).query.blogs.findMany({
        columns: {
          slug: true,
          updatedAt: true,
        },
      });

      posts.forEach((post: any) => {
        entries.push({
          loc: `/blog/${post.slug}`,
          lastmod: post.updatedAt ? new Date(post.updatedAt).toISOString().split("T")[0] : undefined,
          changefreq: "monthly",
          priority: 0.7,
        });
      });
    }
  } catch (error) {
    console.error("Error fetching blog posts for sitemap:", error);
  }

  // Generate XML
  const xml = generateSitemapXml(entries, baseUrl);
  return xml;
}

/**
 * Generate sitemap XML string
 */
function generateSitemapXml(entries: SitemapEntry[], baseUrl: string): string {
  const xmlEntries = entries
    .map(
      (entry) => `
  <url>
    <loc>${baseUrl}${entry.loc}</loc>
    ${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ""}
    ${entry.changefreq ? `<changefreq>${entry.changefreq}</changefreq>` : ""}
    ${entry.priority ? `<priority>${entry.priority}</priority>` : ""}
  </url>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlEntries}
</urlset>`;
}

/**
 * Generate sitemap index for multiple sitemaps (if needed for large sites)
 */
export function generateSitemapIndex(sitemapUrls: string[]): string {
  const xmlEntries = sitemapUrls
    .map(
      (url) => `
  <sitemap>
    <loc>${url}</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
  </sitemap>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlEntries}
</sitemapindex>`;
}