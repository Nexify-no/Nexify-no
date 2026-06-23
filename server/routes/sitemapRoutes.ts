/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Sitemap and RSS Feed Routes
 */

import { Router, Response } from "express";
import { generateSitemap } from "../sitemapGenerator";
import { generateRSSFeed, generateAtomFeed } from "../rssGenerator";

const router = Router();

/**
 * GET /sitemap.xml - Sitemap for search engines
 */
router.get("/sitemap.xml", async (req, res: Response) => {
  try {
    const sitemap = await generateSitemap();
    res.header("Content-Type", "application/xml");
    res.header("Cache-Control", "public, max-age=86400"); // Cache for 24 hours
    res.send(sitemap);
  } catch (error) {
    console.error("Error generating sitemap:", error);
    res.status(500).send("Error generating sitemap");
  }
});

/**
 * GET /feed.xml - RSS feed for blog posts
 */
router.get("/feed.xml", async (req, res: Response) => {
  try {
    const feed = await generateRSSFeed();
    res.header("Content-Type", "application/rss+xml");
    res.header("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
    res.send(feed);
  } catch (error) {
    console.error("Error generating RSS feed:", error);
    res.status(500).send("Error generating RSS feed");
  }
});

/**
 * GET /rss.xml - Alternative RSS feed endpoint
 */
router.get("/rss.xml", async (req, res: Response) => {
  try {
    const feed = await generateRSSFeed();
    res.header("Content-Type", "application/rss+xml");
    res.header("Cache-Control", "public, max-age=3600");
    res.send(feed);
  } catch (error) {
    console.error("Error generating RSS feed:", error);
    res.status(500).send("Error generating RSS feed");
  }
});

/**
 * GET /atom.xml - Atom feed for blog posts
 */
router.get("/atom.xml", async (req, res: Response) => {
  try {
    const feed = await generateAtomFeed();
    res.header("Content-Type", "application/atom+xml");
    res.header("Cache-Control", "public, max-age=3600");
    res.send(feed);
  } catch (error) {
    console.error("Error generating Atom feed:", error);
    res.status(500).send("Error generating Atom feed");
  }
});

/**
 * GET /robots.txt - Robots file for search engines
 */
router.get("/robots.txt", (req, res: Response) => {
  const robotsTxt = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api
Disallow: /private
Disallow: /settings

# Crawl delay (optional)
Crawl-delay: 1

# Sitemap
Sitemap: https://innlegg.no/sitemap.xml

# RSS Feed
# https://innlegg.no/feed.xml
# https://innlegg.no/atom.xml
`;

  res.header("Content-Type", "text/plain");
  res.header("Cache-Control", "public, max-age=604800"); // Cache for 1 week
  res.send(robotsTxt);
});

export default router;