/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Server-side HTML sanitization for stored rich-text (blog content).
 * Defense-in-depth: the DB never holds an active XSS payload, so any consumer
 * that renders the HTML (RSS, email, a future SSR path) is safe even if it
 * forgets to sanitize. Client-side DOMPurify remains as a second layer.
 */
import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "br", "hr", "blockquote",
  "strong", "b", "em", "i", "u", "s", "mark", "sub", "sup",
  "ul", "ol", "li",
  "a", "img", "figure", "figcaption",
  "code", "pre",
  "table", "thead", "tbody", "tr", "th", "td",
  "span", "div",
];

const ALLOWED_ATTR = [
  "href", "title", "target", "rel",
  "src", "alt", "width", "height",
  "class", "colspan", "rowspan",
];

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    // Block javascript:/data: URIs in href/src
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
  });
}