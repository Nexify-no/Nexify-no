/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * RSS Feed Generator
 * Generates dynamic RSS feed for blog posts
 */

import { getDb } from "./db";

export interface RSSItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  author?: string;
  category?: string;
  guid: string;
}

/**
 * Generate RSS feed content
 */
export async function generateRSSFeed(): Promise<string> {
  const baseUrl = "https://innlegg.no";
  const items: RSSItem[] = [];

  // Fetch blog posts
  try {
    const db = await getDb();
    if (db) {
      const posts = await (db as any).query.blogs.findMany({
        columns: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          authorName: true,
          category: true,
          createdAt: true,
        },
        limit: 50, // Limit to 50 most recent posts
      });

      posts.forEach((post: any) => {
        items.push({
          title: post.title,
          description: post.excerpt,
          link: `${baseUrl}/blog/${post.slug}`,
          pubDate: new Date(post.createdAt).toUTCString(),
          author: post.authorName,
          category: post.category,
          guid: `${baseUrl}/blog/${post.slug}`,
        });
      });
    }
  } catch (error) {
    console.error("Error fetching blog posts for RSS feed:", error);
  }

  // Generate RSS XML
  const rss = generateRSSXml(items, baseUrl);
  return rss;
}

/**
 * Generate RSS XML string
 */
function generateRSSXml(items: RSSItem[], baseUrl: string): string {
  const itemsXml = items
    .map(
      (item) => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <description>${escapeXml(item.description)}</description>
      <link>${item.link}</link>
      <pubDate>${item.pubDate}</pubDate>
      ${item.author ? `<author>${escapeXml(item.author)}</author>` : ""}
      ${item.category ? `<category>${escapeXml(item.category)}</category>` : ""}
      <guid isPermaLink="true">${item.guid}</guid>
    </item>`
    )
    .join("");

  const currentYear = new Date().getFullYear();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Innlegg - Din AI Innholdsassistent</title>
    <link>${baseUrl}</link>
    <description>Oppdag hvordan AI kan hjelpe deg med å lage engasjerende innhold for sosiale medier</description>
    <language>no</language>
    <copyright>Copyright © ${currentYear} Innlegg. All rights reserved.</copyright>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <image>
      <url>${baseUrl}/logo.png</url>
      <title>Innlegg - Din AI Innholdsassistent</title>
      <link>${baseUrl}</link>
    </image>
${itemsXml}
  </channel>
</rss>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generate Atom feed (alternative to RSS)
 */
export async function generateAtomFeed(): Promise<string> {
  const baseUrl = "https://innlegg.no";
  const items: RSSItem[] = [];

  // Fetch blog posts
  try {
    const db = await getDb();
    if (db) {
      const posts = await (db as any).query.blogs.findMany({
        columns: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          authorName: true,
          createdAt: true,
          updatedAt: true,
        },
        limit: 50,
      });

      posts.forEach((post: any) => {
        items.push({
          title: post.title,
          description: post.excerpt,
          link: `${baseUrl}/blog/${post.slug}`,
          pubDate: new Date(post.createdAt).toISOString(),
          author: post.authorName,
          guid: `${baseUrl}/blog/${post.slug}`,
        });
      });
    }
  } catch (error) {
    console.error("Error fetching blog posts for Atom feed:", error);
  }

  // Generate Atom XML
  const atom = generateAtomXml(items, baseUrl);
  return atom;
}

/**
 * Generate Atom XML string
 */
function generateAtomXml(items: RSSItem[], baseUrl: string): string {
  const entriesXml = items
    .map(
      (item) => `
  <entry>
    <title>${escapeXml(item.title)}</title>
    <link href="${item.link}" />
    <id>${item.guid}</id>
    <published>${item.pubDate}</published>
    <updated>${item.pubDate}</updated>
    <summary>${escapeXml(item.description)}</summary>
    ${item.author ? `<author><name>${escapeXml(item.author)}</name></author>` : ""}
  </entry>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Innlegg - Din AI Innholdsassistent</title>
  <link href="${baseUrl}" />
  <link href="${baseUrl}/feed.xml" rel="self" />
  <id>${baseUrl}</id>
  <updated>${new Date().toISOString()}</updated>
  <author>
    <name>Innlegg Team</name>
  </author>
${entriesXml}
</feed>`;
}