/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Server-side rendering for the PUBLIC marketing surface
 * (/, /pricing, /faq, /about-us, /contact).
 *
 * Same rationale as blogSsr.ts: the SPA ships an empty shell, invisible to
 * Googlebot's first wave and to AI answer engines that don't run JS. Here we
 * render the real page content + correct per-page meta + JSON-LD into the raw
 * HTML. React still boots and replaces #root (createRoot — no hydration
 * mismatch). Prod-only; dev falls through to Vite.
 *
 * Content mirrors what the live React pages show (no cloaking) and is kept to
 * verifiable facts.
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import fs from "fs";
import path from "path";

const router = Router();
const SITE = process.env.PUBLIC_SITE_URL || "https://penna.no";

function shellPath(): string | null {
  const p = path.resolve(import.meta.dirname, "public", "index.html");
  return fs.existsSync(p) ? p : null;
}
let _shell: string | null = null;
function readShell(): string | null {
  if (_shell) return _shell;
  const p = shellPath();
  if (!p) return null;
  try { _shell = fs.readFileSync(p, "utf-8"); return _shell; } catch { return null; }
}

function escAttr(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escText(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function stripHomepageHead(html: string): string {
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/\s*<meta\s+name="(title|description|keywords)"[^>]*>/gi, "")
    .replace(/\s*<link\s+rel="canonical"[^>]*>/gi, "")
    .replace(/\s*<meta\s+property="(og|twitter):[^"]*"[^>]*>/gi, "");
}

function metaBlock(o: { title: string; desc: string; url: string; ogType?: string }): string {
  const img = `${SITE}/og-image.png`;
  return (
    `\n    <title>${escText(o.title)}</title>` +
    `\n    <meta name="title" content="${escAttr(o.title)}" />` +
    `\n    <meta name="description" content="${escAttr(o.desc)}" />` +
    `\n    <meta name="robots" content="index, follow" />` +
    `\n    <link rel="canonical" href="${escAttr(o.url)}" />` +
    `\n    <meta property="og:type" content="${o.ogType || "website"}" />` +
    `\n    <meta property="og:url" content="${escAttr(o.url)}" />` +
    `\n    <meta property="og:title" content="${escAttr(o.title)}" />` +
    `\n    <meta property="og:description" content="${escAttr(o.desc)}" />` +
    `\n    <meta property="og:image" content="${img}" />` +
    `\n    <meta property="og:locale" content="nb_NO" />` +
    `\n    <meta property="twitter:card" content="summary_large_image" />` +
    `\n    <meta property="twitter:title" content="${escAttr(o.title)}" />` +
    `\n    <meta property="twitter:description" content="${escAttr(o.desc)}" />` +
    `\n    <meta property="twitter:image" content="${img}" />`
  );
}

function ld(obj: unknown): string {
  return `\n    <script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

const ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Penna",
  url: SITE,
  logo: `${SITE}/apple-touch-icon.png`,
  description: "Norsk AI-tjeneste som lager profesjonelt innhold til sosiale medier på sekunder.",
  sameAs: [
    "https://www.linkedin.com/company/penna-no/",
    "https://www.instagram.com/penna.no/",
    "https://x.com/Penna0no",
  ],
  parentOrganization: { "@type": "Organization", name: "Nexify CRM Systems AS" },
  contactPoint: {
    "@type": "ContactPoint",
    email: "support@penna.no",
    telephone: "+47 921 46 050",
    contactType: "customer support",
    areaServed: "NO",
    availableLanguage: ["Norwegian", "English"],
  },
  address: {
    "@type": "PostalAddress",
    streetAddress: "Nedre Sølen 5",
    postalCode: "3913",
    addressLocality: "Porsgrunn",
    addressCountry: "NO",
  },
};

const FAQS: { q: string; a: string }[] = [
  { q: "Hva er Penna?", a: "Penna er en norsk AI-tjeneste som hjelper deg å lage profesjonelt innhold til sosiale medier (LinkedIn, X, Instagram og Facebook) på sekunder – med riktig tone for hver plattform." },
  { q: "Trenger jeg kredittkort for å prøve?", a: "Nei. Du får 2 gratis innlegg uten å oppgi betalingsinformasjon, og kan avbryte når som helst." },
  { q: "Hvilke plattformer støttes?", a: "LinkedIn, X (Twitter), Instagram og Facebook. Automatisk publisering til LinkedIn er tilgjengelig nå; flere plattformer kommer." },
  { q: "Hva koster Penna?", a: "Pro koster 199 kr/måned (15 innlegg) og Premium 399 kr/måned (30 innlegg) – begge med AI-bilder og planlegging. Alle priser er i NOK og inkluderer mva." },
  { q: "Kan jeg si opp når som helst?", a: "Ja. Det er ingen bindingstid. Du sier opp i Innstillinger og beholder tilgangen ut perioden du allerede har betalt for." },
  { q: "Hvilke betalingsmetoder kan jeg bruke?", a: "Du kan betale med kort eller Vipps." },
  { q: "Lager Penna innhold på norsk?", a: "Ja. Penna er bygget spesielt for norsk språk og tone, så innholdet høres naturlig ut – ikke maskinoversatt." },
  { q: "Kan jeg lære AI-en min egen stemme?", a: "Ja. Med Stemmetrening (Pro) lærer AI-en din unike stil, slik at innholdet alltid høres ut som deg." },
  { q: "Eier jeg innholdet som genereres?", a: "Ja, du eier 100 % av innholdet du lager med Penna og kan bruke det fritt, også kommersielt." },
  { q: "Hvordan håndteres personopplysningene mine?", a: "Vi følger GDPR. Personvernerklæringen vår viser hvilke databehandlere vi bruker og hvilke rettigheter du har. Du kan også klage til Datatilsynet." },
];

function injectBody(html: string, body: string): string {
  return html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
}
function injectHead(html: string, head: string): string {
  return html.replace("</head>", `${head}\n  </head>`);
}

// ---- / (homepage) -----------------------------------------------------------
function renderHome(): string {
  const shell = readShell();
  if (!shell) return "";
  const body =
    `<main data-ssr="home">` +
    `<h1>Fra idé til ferdig innlegg på 30 sekunder</h1>` +
    `<p>Penna er en norsk AI-plattform for innhold. Slutt å bruke timer — lag profesjonelle innlegg til LinkedIn, X (Twitter), Instagram og Facebook på minutter, i din egen stemme. Prøv 2 innlegg gratis, uten kredittkort.</p>` +
    `<h2>Slik fungerer det</h2>` +
    `<ol>` +
    `<li><strong>Velg plattform og tone</strong> — LinkedIn, X, Instagram eller Facebook; profesjonell, uformell eller vennlig.</li>` +
    `<li><strong>Skriv emne eller idé</strong> — noen ord er nok; AI forstår konteksten og utvider ideen til et komplett innlegg.</li>` +
    `<li><strong>Få innlegg + bilde</strong> — profesjonelt innlegg med AI-generert bilde, klart til å publisere.</li>` +
    `</ol>` +
    `<h2>Funksjoner</h2>` +
    `<ul>` +
    `<li>Trend og inspirasjon fra Google Trends, tilpasset ditt felt</li>` +
    `<li>Stemmetrening — AI lærer din unike stil fra tidligere innlegg</li>` +
    `<li>AI-genererte bilder til hvert innlegg</li>` +
    `<li>Innholdskalender med norske og internasjonale merkedager (17. mai, jul, Black Friday)</li>` +
    `<li>Gjenbruk-maskin: gjør gamle innlegg om til threads, carousels og video-script</li>` +
    `<li>AI Coach og analyse med scoring og forbedringstips</li>` +
    `<li>WhatsApp- og Telegram-bot: lag innhold mens du er på farten</li>` +
    `<li>4 plattformer: LinkedIn, X, Instagram og Facebook</li>` +
    `</ul>` +
    `<h2>Priser</h2>` +
    `<ul>` +
    `<li><strong>Gratis</strong> — 0 kr: 2 innlegg per måned, alle plattformer.</li>` +
    `<li><strong>Pro</strong> — 199 kr/mnd: 15 innlegg, AI-bilder, stemmetrening, trend, kalender, gjenbruk, AI coach.</li>` +
    `<li><strong>Premium</strong> — 399 kr/mnd: 30 innlegg, alt i Pro, automatisering og planlegging, månedlige rapporter.</li>` +
    `</ul>` +
    `<p>Ingen bindingstid — avbryt når som helst. <a href="/pricing">Se priser</a> · <a href="/">Start gratis</a> · <a href="/blog">Les bloggen</a></p>` +
    `</main>`;
  // Homepage shell already has correct title/meta + SoftwareApplication LD.
  // Just add Organization LD and inject the body content.
  let html = injectBody(shell, body);
  return html;
}

// ---- /pricing ---------------------------------------------------------------
function renderPricing(): string {
  const shell = readShell();
  if (!shell) return "";
  const url = `${SITE}/pricing`;
  const head =
    metaBlock({
      title: "Priser — Penna | Fra 0 kr, Pro 199 kr/mnd, Premium 399 kr/mnd",
      desc: "Penna-priser i NOK: Gratis (2 innlegg), Pro 199 kr/mnd (15 innlegg, AI-bilder, stemmetrening) og Premium 399 kr/mnd (30 innlegg). Ingen bindingstid, betal med kort eller Vipps.",
      url,
    }) +
    ld({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Penna",
      description: "AI-innholdsassistent for sosiale medier (LinkedIn, X, Instagram, Facebook).",
      brand: { "@type": "Brand", name: "Penna" },
      offers: [
        { "@type": "Offer", name: "Gratis", price: "0", priceCurrency: "NOK", url, availability: "https://schema.org/InStock" },
        { "@type": "Offer", name: "Pro", price: "199", priceCurrency: "NOK", url, availability: "https://schema.org/InStock" },
        { "@type": "Offer", name: "Premium", price: "399", priceCurrency: "NOK", url, availability: "https://schema.org/InStock" },
      ],
    });
  const body =
    `<main data-ssr="pricing">` +
    `<h1>Enkel prising</h1>` +
    `<p>Start gratis, oppgrader når du er klar. Mindre enn en kaffe per dag — spar 5+ timer hver uke. Alle priser er i NOK og inkluderer mva. Ingen bindingstid.</p>` +
    `<h2>Gratis — 0 kr</h2><ul><li>2 innlegg per måned</li><li>Alle plattformer</li><li>Grunnleggende dashboard</li></ul>` +
    `<h2>Pro — 199 kr/måned (6,63 kr/dag)</h2><ul><li>15 innlegg per måned</li><li>AI-genererte bilder inkludert</li><li>Stemmetrening (din stil)</li><li>Trend og inspirasjon</li><li>Innholdskalender</li><li>Gjenbruk-maskin</li><li>AI Coach og analyse</li><li>Prioritert support</li></ul>` +
    `<h2>Premium — 399 kr/måned (13,30 kr/dag)</h2><ul><li>30 innlegg per måned</li><li>Alt i Pro inkludert</li><li>Avansert stemmetrening</li><li>Automatisering og planlegging</li><li>Månedlige rapporter</li><li>Dedikert support</li></ul>` +
    `<p>Betal med kort eller Vipps. Ingen bindingstid — avbryt når som helst. <a href="/">Start gratis</a></p>` +
    `</main>`;
  let html = injectHead(stripHomepageHead(shell), head);
  html = injectBody(html, body);
  return html;
}

// ---- /faq -------------------------------------------------------------------
function renderFaq(): string {
  const shell = readShell();
  if (!shell) return "";
  const url = `${SITE}/faq`;
  const head =
    metaBlock({
      title: "Ofte stilte spørsmål (FAQ) — Penna",
      desc: "Svar på vanlige spørsmål om Penna: priser, plattformer, norsk innhold, stemmetrening, eierskap og personvern (GDPR).",
      url,
    }) +
    ld({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  const items = FAQS.map((f) => `<section><h2>${escText(f.q)}</h2><p>${escText(f.a)}</p></section>`).join("");
  const body = `<main data-ssr="faq"><h1>Ofte stilte spørsmål</h1>${items}<p><a href="/">Start gratis</a> · <a href="/pricing">Se priser</a></p></main>`;
  let html = injectHead(stripHomepageHead(shell), head);
  html = injectBody(html, body);
  return html;
}

// ---- /about-us --------------------------------------------------------------
function renderAbout(): string {
  const shell = readShell();
  if (!shell) return "";
  const url = `${SITE}/about-us`;
  const head =
    metaBlock({
      title: "Om oss — Penna",
      desc: "Penna er en norsk AI-tjeneste for innhold til sosiale medier, utviklet av Nexify CRM Systems AS i Porsgrunn. Vår misjon: hjelpe norske bedrifter å lage bedre innhold på kortere tid.",
      url,
    });
  const body =
    `<main data-ssr="about">` +
    `<h1>Om Penna</h1>` +
    `<p>Penna er en norsk AI-tjeneste som hjelper bedrifter og fagfolk å lage profesjonelt innhold til sosiale medier på sekunder — på naturlig norsk og i din egen stemme.</p>` +
    `<p>Penna er utviklet av <strong>Nexify CRM Systems AS</strong> (org.nr 936 300 278), et norsk teknologi- og webutviklingsselskap i Porsgrunn. Misjonen vår er enkel: gjøre god innholdsproduksjon raskere og mer tilgjengelig for norske bedrifter.</p>` +
    `<p>Kontakt: support@penna.no · +47 921 46 050 · Nedre Sølen 5, 3913 Porsgrunn. <a href="/">Prøv Penna gratis</a></p>` +
    `</main>`;
  let html = injectHead(stripHomepageHead(shell), head);
  html = injectBody(html, body);
  return html;
}

// ---- /contact ---------------------------------------------------------------
function renderContact(): string {
  const shell = readShell();
  if (!shell) return "";
  const url = `${SITE}/contact`;
  const head = metaBlock({
    title: "Kontakt — Penna",
    desc: "Kontakt Penna: support@penna.no eller +47 921 46 050. Nexify CRM Systems AS, Nedre Sølen 5, 3913 Porsgrunn.",
    url,
  });
  const body =
    `<main data-ssr="contact">` +
    `<h1>Kontakt oss</h1>` +
    `<p>Har du spørsmål om Penna? Vi hjelper deg gjerne.</p>` +
    `<ul>` +
    `<li>E-post: <a href="mailto:support@penna.no">support@penna.no</a></li>` +
    `<li>Telefon: <a href="tel:+4792146050">+47 921 46 050</a></li>` +
    `<li>Nexify CRM Systems AS, Nedre Sølen 5, 3913 Porsgrunn</li>` +
    `<li>Org.nr: 936 300 278</li>` +
    `</ul>` +
    `<p><a href="/">Tilbake til forsiden</a></p>` +
    `</main>`;
  let html = injectHead(stripHomepageHead(shell), head);
  html = injectBody(html, body);
  return html;
}

// ---- Legal pages (correct per-page meta + canonical; React renders full text) ----
function legalPage(opts: { path: string; title: string; desc: string; h1: string; intro: string }): string {
  const shell = readShell();
  if (!shell) return "";
  const url = `${SITE}${opts.path}`;
  const head = metaBlock({ title: opts.title, desc: opts.desc, url });
  const body =
    `<main data-ssr="legal">` +
    `<h1>${escText(opts.h1)}</h1>` +
    `<p>${escText(opts.intro)}</p>` +
    `<p>Nexify CRM Systems AS, org.nr 936 300 278, Nedre Sølen 5, 3913 Porsgrunn. ` +
    `Kontakt: <a href="mailto:support@penna.no">support@penna.no</a> · +47 921 46 050.</p>` +
    `<p><a href="/">Til forsiden</a> · <a href="/pricing">Se priser</a></p>` +
    `</main>`;
  let html = injectHead(stripHomepageHead(shell), head);
  html = injectBody(html, body);
  return html;
}
function renderPrivacy() { return legalPage({ path: "/privacy", title: "Personvernerklæring — Penna", desc: "Personvernerklæring for Penna: hvilke personopplysninger vi behandler, hvorfor, hvilke databehandlere vi bruker og hvilke rettigheter du har etter GDPR.", h1: "Personvernerklæring", intro: "Denne erklæringen forklarer hvordan Penna (Nexify CRM Systems AS) behandler personopplysninger i samsvar med personvernforordningen (GDPR) og norsk personvernlovgivning." }); }
function renderTerms() { return legalPage({ path: "/terms", title: "Vilkår for bruk — Penna", desc: "Vilkår for bruk av Penna — abonnement, ansvar, rettigheter og bruk av tjenesten.", h1: "Vilkår for bruk", intro: "Disse vilkårene regulerer bruken av Penna. Ved å opprette en konto eller bruke tjenesten godtar du vilkårene." }); }
function renderCookies() { return legalPage({ path: "/cookie-policy", title: "Informasjonskapsler (cookies) — Penna", desc: "Slik bruker Penna informasjonskapsler (cookies), og hvordan du styrer samtykke etter norsk lov og GDPR.", h1: "Informasjonskapsler", intro: "Penna bruker informasjonskapsler for å få nettstedet til å fungere og, med ditt samtykke, til statistikk. Du kan når som helst endre samtykket ditt." }); }
function renderSalg() { return legalPage({ path: "/salgsbetingelser", title: "Salgsbetingelser — Penna", desc: "Salgsbetingelser for Penna: abonnement, priser i NOK, betaling med kort eller Vipps, angrerett og oppsigelse.", h1: "Salgsbetingelser", intro: "Salgsbetingelsene gjelder kjøp av abonnement på Penna. Alle priser er i norske kroner og inkluderer mva. Du kan si opp når som helst." }); }

function makeHandler(render: () => string) {
  return (_req: Request, res: Response, next: NextFunction) => {
    try {
      if (!readShell()) return next();
      const html = render();
      if (!html) return next();
      res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).end(html);
    } catch (err) {
      console.error("[marketingSsr] error:", err instanceof Error ? err.message : err);
      return next();
    }
  };
}

router.get("/", makeHandler(renderHome));
router.get("/pricing", makeHandler(renderPricing));
router.get("/faq", makeHandler(renderFaq));
router.get("/about-us", makeHandler(renderAbout));
router.get("/contact", makeHandler(renderContact));
router.get("/privacy", makeHandler(renderPrivacy));
router.get("/terms", makeHandler(renderTerms));
router.get("/cookie-policy", makeHandler(renderCookies));
router.get("/salgsbetingelser", makeHandler(renderSalg));

export default router;
