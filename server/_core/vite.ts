/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { classifyRoute, normalizePath, redirectTarget } from "../../shared/routeManifest";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

/**
 * Rewrite the shell's robots directive to noindex.
 *
 * client/index.html ships `<meta name="robots" content="index, follow">` because
 * the shell is also what the homepage uses. For app screens and for 404s we must
 * flip that, otherwise every unmatched URL is served as an indexable duplicate of
 * the homepage (soft 404) and every authenticated screen competes with the pages
 * that should actually rank.
 *
 * We also drop the canonical: pointing a 404 or a private screen at
 * https://penna.no reinforces the duplicate signal we're trying to remove.
 */
function toNoindexShell(html: string): string {
  const stripped = html
    .replace(/\s*<meta\s+name="robots"[^>]*>/gi, "")
    .replace(/\s*<link\s+rel="canonical"[^>]*>/gi, "");
  return stripped.replace(
    /<head>/i,
    '<head>\n    <meta name="robots" content="noindex, nofollow" />'
  );
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  const shellFile = path.resolve(distPath, "index.html");

  // Built once on first request, then reused. The shell is immutable per deploy.
  let indexableShell: string | null = null;
  let noindexShell: string | null = null;
  function loadShells(): boolean {
    if (indexableShell !== null) return true;
    try {
      indexableShell = fs.readFileSync(shellFile, "utf-8");
      noindexShell = toNoindexShell(indexableShell);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * SPA fallback with correct HTTP semantics.
   *
   * Previously this answered every unmatched path with `200 OK` + the indexable
   * shell, so `/anything-at-all` looked to Google like a real page. Now the
   * route manifest decides:
   *   public  → 200, indexable (SSR routers handle the important ones first)
   *   app     → 200, noindex   (the screen exists, it just isn't for crawlers)
   *   unknown → 404, noindex   (a real 404, so Google drops it)
   *
   * The client still renders its own NotFound page — the status code is what
   * changes, and that is the part crawlers act on.
   */
  app.use("*", (req, res) => {
    const pathname = req.originalUrl || req.url || "/";

    // An unmatched /api path must never receive an HTML body — API clients
    // parse JSON and would choke on the SPA shell.
    if (normalizePath(pathname).startsWith("/api")) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // Conventional aliases that were never implemented (/signup, /register, ...).
    // 301 rather than 404: these are the URLs people type and partners link.
    const redirect = redirectTarget(pathname);
    if (redirect) {
      res.redirect(301, redirect);
      return;
    }

    if (!loadShells()) {
      // No build output — fall back to the previous behaviour rather than 500.
      res.sendFile(shellFile);
      return;
    }

    const kind = classifyRoute(pathname);
    if (kind === "public") {
      res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).end(indexableShell!);
      return;
    }
    // X-Robots-Tag in addition to the meta tag: crawlers that only fetch headers
    // (and AI answer engines that don't execute JS) honour it, and it applies
    // even if the HTML rewrite above ever fails to match.
    if (kind === "app") {
      res
        .status(200)
        .set({ "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" })
        .end(noindexShell!);
      return;
    }

    res
      .status(404)
      .set({ "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" })
      .end(noindexShell!);
  });
}