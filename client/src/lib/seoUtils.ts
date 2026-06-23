/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * SEO Utilities for blog posts and pages
 */

export interface SEOMetaTags {
  title: string;
  description: string;
  keywords?: string[];
  author?: string;
  image?: string;
  url?: string;
  type?: "article" | "website" | "product";
  publishedDate?: string;
  modifiedDate?: string;
  language?: string;
}

export interface ArticleSchema {
  headline: string;
  description: string;
  image?: string;
  author: {
    name: string;
    url?: string;
  };
  datePublished: string;
  dateModified?: string;
  publisher: {
    name: string;
    logo?: string;
  };
  url: string;
  articleBody?: string;
  keywords?: string[];
}

/**
 * Generate meta tags for SEO
 */
export function generateMetaTags(seo: SEOMetaTags): void {
  // Set title
  document.title = seo.title;

  // Set or update meta tags
  const metaTags = [
    { name: "description", content: seo.description },
    { name: "keywords", content: seo.keywords?.join(", ") || "" },
    { name: "author", content: seo.author || "" },
    { name: "language", content: seo.language || "no" },
    { property: "og:title", content: seo.title },
    { property: "og:description", content: seo.description },
    { property: "og:type", content: seo.type || "website" },
    { property: "og:image", content: seo.image || "" },
    { property: "og:url", content: seo.url || window.location.href },
    { property: "twitter:title", content: seo.title },
    { property: "twitter:description", content: seo.description },
    { property: "twitter:image", content: seo.image || "" },
    { property: "twitter:card", content: "summary_large_image" },
  ];

  metaTags.forEach(({ name, property, content }) => {
    if (!content) return;

    const selector = property ? `meta[property="${property}"]` : `meta[name="${name || ''}"]`;
    let element = document.querySelector(selector) as HTMLMetaElement;

    if (!element) {
      element = document.createElement("meta");
      if (property) {
        element.setAttribute("property", property);
      } else {
        if (name) element.setAttribute("name", name);
      }
      document.head.appendChild(element);
    }

    element.content = content;
  });
}

/**
 * Generate JSON-LD structured data for articles
 */
export function generateArticleSchema(article: ArticleSchema): void {
  const schema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.headline,
    description: article.description,
    image: article.image,
    author: {
      "@type": "Person",
      name: article.author.name,
      url: article.author.url,
    },
    datePublished: article.datePublished,
    dateModified: article.dateModified || article.datePublished,
    publisher: {
      "@type": "Organization",
      name: article.publisher.name,
      logo: {
        "@type": "ImageObject",
        url: article.publisher.logo,
      },
    },
    url: article.url,
    articleBody: article.articleBody,
    keywords: article.keywords?.join(", "),
  };

  // Remove existing schema if present
  const existingScript = document.querySelector('script[type="application/ld+json"]');
  if (existingScript) {
    existingScript.remove();
  }

  // Create and append new schema
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
}

/**
 * Generate breadcrumb schema for navigation
 */
export function generateBreadcrumbSchema(
  breadcrumbs: Array<{ name: string; url: string }>
): void {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
}

/**
 * Calculate reading time in minutes
 */
export function calculateReadingTime(text: string): number {
  const wordsPerMinute = 200;
  const wordCount = text.trim().split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

/**
 * Generate canonical URL
 */
export function setCanonicalUrl(url: string): void {
  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;

  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }

  canonical.href = url;
}

/**
 * Generate sitemap entry
 */
export interface SitemapEntry {
  url: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}

export function generateSitemapXml(entries: SitemapEntry[]): string {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) => `
  <url>
    <loc>${entry.url}</loc>
    ${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ""}
    ${entry.changefreq ? `<changefreq>${entry.changefreq}</changefreq>` : ""}
    ${entry.priority ? `<priority>${entry.priority}</priority>` : ""}
  </url>`
  )
  .join("")}
</urlset>`;

  return xml;
}

/**
 * Generate robots.txt content
 */
export function generateRobotsTxt(): string {
  return `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api
Disallow: /private

Sitemap: https://innlegg.no/sitemap.xml
`;
}