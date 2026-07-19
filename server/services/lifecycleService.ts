/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 *
 * Automated customer-journey emails ("livssyklus"): a behavior-aware sequence
 * that teaches new Penna users and follows up automatically toward their first
 * published post — then re-engages them if they go quiet. Runs once a day
 * (scheduler), sends at most ONE step per user per run, paced ≥2 days apart,
 * each step exactly once (DB-level claim), and only to users who haven't opted
 * out. All copy is Norwegian bokmål, du-form, in Penna's voice.
 */
import type { LifecycleUserState } from "../db";

const DAY = 24 * 60 * 60 * 1000;
/** Minimum gap between two lifecycle emails to the same user (paces the drip). */
const MIN_GAP_DAYS = 2;
/** Throttle between individual sends so we never burst the mail provider. */
const SEND_THROTTLE_MS = 200;

interface BuiltEmail {
  subject: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaHref: string;
}

interface LifecycleStep {
  key: string;
  /** Days since signup this step becomes due … */
  minDays: number;
  /** … and after which it's too late to start (don't back-fill old accounts). */
  maxDays: number;
  eligible: (s: LifecycleUserState) => boolean;
  build: (s: LifecycleUserState, site: string) => BuiltEmail;
}

const firstName = (name: string) => (name || "").trim().split(" ")[0] || "der";
const p = (html: string) =>
  `<p style="font-size:15px; line-height:1.6; color:#374151;">${html}</p>`;
const h1 = (html: string) =>
  `<h1 style="color:#0B132B; font-size:22px; line-height:1.3;">${html}</h1>`;

/**
 * The journey. Order matters: the engine sends the FIRST unsent + due + eligible
 * step, so users advance one step at a time, ≥2 days apart. Behavior predicates
 * keep it honest — we never tell someone to "make your first post" once they
 * have, or "connect LinkedIn" once they have.
 */
export const LIFECYCLE_STEPS: LifecycleStep[] = [
  {
    key: "edu_first_post",
    minDays: 1,
    maxDays: 10,
    eligible: (s) => !s.hasPosted,
    build: (s, site) => ({
      subject: "Ditt første innlegg tar under ett minutt ✍️",
      bodyHtml:
        h1(`Kom i gang, ${firstName(s.name)}`) +
        p("Penna kan lære om bedriften din fra nettsiden din, og skrive de første innleggene for deg — i din egen tone.") +
        p("Legg inn nettadressen din, bekreft det Penna fant, og få ferdige innlegg på sekunder. Du eier alt som lages."),
      ctaLabel: "Lag mitt første innlegg →",
      ctaHref: `${site}/kom-i-gang`,
    }),
  },
  {
    key: "edu_first_post_nudge",
    minDays: 3,
    maxDays: 14,
    eligible: (s) => !s.hasPosted,
    build: (s, site) => ({
      subject: "Har du 60 sekunder? Idéen din venter",
      bodyHtml:
        h1("Fra idé til ferdig innlegg") +
        p("Du trenger ikke en ferdig tekst — bare en kort idé. Skriv «tips om regnskap for småbedrifter», så gjør Penna resten på norsk.") +
        p("Tips: velg tonen som passer deg, fra profesjonell til uformell. Penna husker den til neste gang."),
      ctaLabel: "Skriv en idé →",
      ctaHref: `${site}/generer`,
    }),
  },
  {
    key: "edu_connect_linkedin",
    minDays: 2,
    maxDays: 30,
    eligible: (s) => s.hasPosted && !s.hasLinkedIn,
    build: (_s, site) => ({
      subject: "La Penna publisere for deg — koble til LinkedIn",
      bodyHtml:
        h1("Sett innleggene på autopilot") +
        p("Du har laget innhold — bra jobba! Kobler du til LinkedIn, kan Penna publisere de godkjente innleggene dine automatisk, på beste tidspunkt.") +
        p("Det tar noen sekunder, og du bestemmer fortsatt hva som publiseres."),
      ctaLabel: "Koble til LinkedIn →",
      ctaHref: `${site}/innstillinger`,
    }),
  },
  {
    key: "edu_voice",
    minDays: 5,
    maxDays: 45,
    eligible: (s) => s.hasPosted,
    build: (_s, site) => ({
      subject: "Visste du at Penna kan lære din stemme?",
      bodyHtml:
        h1("Innhold som høres ut som deg") +
        p("Lim inn et par tekster du har skrevet, så lærer Penna stilen din — ordvalg, tone og rytme. Da blir innleggene dine gjenkjennelige, ikke generisk AI-tekst.") +
        p("Jo mer Penna kjenner stemmen din, jo mindre trenger du å redigere."),
      ctaLabel: "Tren din stemme →",
      ctaHref: `${site}/stemme`,
    }),
  },
  {
    key: "edu_trends",
    minDays: 8,
    maxDays: 60,
    eligible: () => true,
    build: (_s, site) => ({
      subject: "Aldri mer «hva skal jeg skrive om?»",
      bodyHtml:
        h1("Se hva som trender akkurat nå") +
        p("Kildeoversikten i Penna samler hva som er aktuelt i Norge og globalt — fra Google Trends og nyheter til sosiale medier — på ett sted.") +
        p("Finn et tema som passer bedriften din, og lag et innlegg om det med ett trykk."),
      ctaLabel: "Utforsk trender →",
      ctaHref: `${site}/trender`,
    }),
  },
  {
    key: "reengage",
    minDays: 12,
    maxDays: 60,
    // Was active, but has gone quiet for a while (not just signed up and idle).
    eligible: (s) => {
      const daysSinceSeen = (Date.now() - new Date(s.lastSignedIn).getTime()) / DAY;
      return daysSinceSeen >= 10 && daysSinceSeen <= 45;
    },
    build: (s, site) => ({
      subject: "Vi savner deg — her er tre idéer til uka",
      bodyHtml:
        h1(`Klar for et nytt innlegg, ${firstName(s.name)}?`) +
        p("Det har gått en liten stund. Trenger du en start, prøv en av disse: en kundehistorie, et vanlig spørsmål du får, eller et tips fra bransjen din.") +
        p("Skriv én linje, så har Penna et ferdig innlegg klart på sekunder."),
      ctaLabel: "Lag et innlegg →",
      ctaHref: `${site}/generer`,
    }),
  },
];

/** Pick the single step (if any) that is due for a user right now. */
export function pickDueStep(s: LifecycleUserState, now = Date.now()): LifecycleStep | null {
  if (!s.verified) return null; // don't send journey mail to unverified email accounts
  if (s.lastLifecycleAt && now - new Date(s.lastLifecycleAt).getTime() < MIN_GAP_DAYS * DAY) {
    return null; // paced: already got a lifecycle email within the last 2 days
  }
  const ageDays = (now - new Date(s.createdAt).getTime()) / DAY;
  for (const step of LIFECYCLE_STEPS) {
    if (s.sentKeys.includes(step.key)) continue;
    if (ageDays < step.minDays || ageDays > step.maxDays) continue;
    if (!step.eligible(s)) continue;
    return step;
  }
  return null;
}

/**
 * Daily runner: fetch eligible users, decide the due step per user, claim it
 * (idempotent), and send. Fail-soft per user. Returns a small summary for logs.
 */
export async function runLifecycleEmails(): Promise<{ scanned: number; sent: number }> {
  const { getLifecycleUserStates, claimLifecycleEmail } = await import("../db");
  const { sendBrandedEmail } = await import("../_core/email");
  const site = process.env.PUBLIC_SITE_URL || process.env.VITE_APP_URL || "https://penna.no";

  const states = await getLifecycleUserStates();
  let sent = 0;

  for (const s of states) {
    const step = pickDueStep(s);
    if (!step) continue;

    // Claim BEFORE sending: the UNIQUE(user_id, email_key) row is what guarantees
    // a step is delivered at most once, even across overlapping/retried runs.
    const claimed = await claimLifecycleEmail(s.userId, step.key);
    if (!claimed) continue;

    try {
      const built = step.build(s, site);
      const ok = await sendBrandedEmail(s.email, built.subject, {
        bodyHtml: built.bodyHtml,
        ctaLabel: built.ctaLabel,
        ctaHref: built.ctaHref,
      });
      if (ok) sent++;
      else console.warn(`[Lifecycle] send returned false for ${s.email} (${step.key})`);
    } catch (e) {
      console.error(`[Lifecycle] send failed for ${s.email} (${step.key})`, e);
    }
    await new Promise((res) => setTimeout(res, SEND_THROTTLE_MS));
  }

  return { scanned: states.length, sent };
}
