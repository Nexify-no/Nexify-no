/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * Admin-editable e-mail copy.
 *
 * Every e-mail Penna sends lived as a template literal in `server/_core/email.ts`.
 * Changing one word meant a code change, a review and a deploy, so in practice
 * the copy never changed. This makes the copy data.
 *
 * Three rules hold the whole thing up, and each exists because the alternative
 * breaks something a customer depends on:
 *
 * **1. The built-in copy is always the fallback.** No override row, the row is
 * disabled, the row fails validation, the render throws, the database is down —
 * every one of those paths sends the built-in e-mail. A password reset that does
 * not arrive because somebody mistyped a template is not an acceptable failure
 * mode, so it is not a reachable one.
 *
 * **2. Required placeholders are enforced on save.** A password-reset e-mail
 * without `{{resetLink}}` is not a stylistic choice, it is a locked-out customer.
 * The registry declares which placeholders an e-mail cannot function without and
 * `validateTemplate` refuses to store a body that dropped one. Refusing at save
 * time — while the admin is looking at the editor — beats discovering it from a
 * support ticket.
 *
 * **3. Two trust levels, two mechanisms.** The BODY is admin-authored copy: it
 * may contain markup, and it is sanitised (`sanitizeHtml`) so a stored template
 * can never carry an active payload. The VALUES substituted into it — a customer's
 * name, a ticket reply, a plan name — are untrusted and HTML-ESCAPED. Conflating
 * the two is how a support reply saying `<a href="...">Reset your password</a>`
 * ends up as a working phishing link inside a genuine Penna e-mail. (It did: the
 * built-in `sendSupportTicketReplyEmail` interpolated the reply text raw.)
 */

import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { emailTemplates } from "../../drizzle/schema";
import { sanitizeHtml } from "../_core/sanitizeHtml";
import { escapeHtml, safeCtaHref } from "./adminEmail";

/** A placeholder an admin may use in a template body, subject, or CTA href. */
export type TemplateVariable = {
  /** Written as `{{key}}` in the template. */
  key: string;
  /** Shown next to the insert button in the editor. */
  label: string;
  /** Used for the preview and the test send. */
  sample: string;
};

export type BuiltInTemplate = {
  key: string;
  name: string;
  /** When this e-mail is sent, in the admin's words. */
  description: string;
  variables: TemplateVariable[];
  /**
   * Placeholders the e-mail is useless without. A body/CTA that contains none of
   * them is refused at save time.
   */
  required: string[];
  /** Marketing copy can be reworded freely; a legal notice has constraints. */
  note?: string;
};

export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  {
    key: "welcome",
    name: "Velkommen",
    description: "Sendes én gang, rett etter registrering.",
    variables: [
      { key: "name", label: "Navn", sample: "Tamer" },
      { key: "siteUrl", label: "Nettsted", sample: "https://penna.no" },
      { key: "dashboardUrl", label: "Lenke til dashbord", sample: "https://penna.no/dashboard" },
    ],
    required: [],
  },
  {
    key: "verify_email",
    name: "Bekreft e-post",
    description: "Sendes ved registrering. Lenken utløper etter 24 timer.",
    variables: [
      { key: "name", label: "Navn", sample: "Tamer" },
      { key: "verifyLink", label: "Bekreftelseslenke", sample: "https://penna.no/verify?token=eksempel" },
    ],
    // Without the link the e-mail cannot do the one thing it exists for.
    required: ["verifyLink"],
    note: "Bekreftelseslenken må være med — uten den kan ingen fullføre registreringen.",
  },
  {
    key: "password_reset",
    name: "Tilbakestill passord",
    description: "Sendes når noen ber om nytt passord. Lenken utløper etter 24 timer.",
    variables: [
      { key: "name", label: "Navn", sample: "Tamer" },
      { key: "resetLink", label: "Tilbakestillingslenke", sample: "https://penna.no/reset-password?token=eksempel" },
    ],
    required: ["resetLink"],
    note: "Lenken må være med — uten den er kunden låst ute.",
  },
  {
    key: "subscription_confirmation",
    name: "Abonnement bekreftet",
    description: "Sendes etter en fullført betaling.",
    variables: [
      { key: "name", label: "Navn", sample: "Tamer" },
      { key: "planName", label: "Plan", sample: "Pro" },
      { key: "amount", label: "Beløp (NOK)", sample: "299" },
      { key: "dashboardUrl", label: "Lenke til dashbord", sample: "https://penna.no/dashboard" },
    ],
    required: [],
  },
  {
    key: "subscription_active_reminder",
    name: "Abonnementet er aktivt",
    description: "Halvårlig påminnelse. Lovpålagt (digitalytelsesloven).",
    variables: [
      { key: "name", label: "Navn", sample: "Tamer" },
      { key: "billingUrl", label: "Lenke til fakturering", sample: "https://penna.no/settings/billing" },
    ],
    // The statute is specifically about telling people how to cancel. The wording
    // is yours; the way out is not optional.
    required: ["billingUrl"],
    note:
      "Teksten kan endres, men lenken til fakturering/oppsigelse må være med — det er selve poenget med den lovpålagte påminnelsen.",
  },
  {
    key: "support_ticket_confirmation",
    name: "Supportsak mottatt",
    description: "Sendes når en kunde oppretter en supportsak.",
    variables: [
      { key: "name", label: "Navn", sample: "Tamer" },
      { key: "ticketId", label: "Saksnummer", sample: "1042" },
      { key: "ticketSubject", label: "Emne", sample: "Kan ikke koble til LinkedIn" },
    ],
    required: [],
  },
  {
    key: "support_ticket_reply",
    name: "Nytt svar på supportsak",
    description: "Sendes når det kommer et svar på en supportsak.",
    variables: [
      { key: "name", label: "Navn", sample: "Tamer" },
      { key: "ticketId", label: "Saksnummer", sample: "1042" },
      { key: "replyText", label: "Svaret", sample: "Vi har sett på saken og LinkedIn-koblingen er nå fornyet." },
      { key: "ticketUrl", label: "Lenke til saken", sample: "https://penna.no/support/tickets/1042" },
    ],
    required: ["replyText"],
  },
  {
    key: "weekly_ritual",
    name: "Ukens innlegg",
    description: "Mandager 08:00. Påminnelse om å lage ukens innhold.",
    variables: [
      { key: "firstName", label: "Fornavn", sample: "Tamer" },
      { key: "generateUrl", label: "Lenke til generering", sample: "https://penna.no/generer" },
      { key: "settingsUrl", label: "Lenke til varslingsinnstillinger", sample: "https://penna.no/innstillinger" },
    ],
    // Marketing mail: the recipient must be able to find the way out.
    required: ["settingsUrl"],
    note: "Lenken til varslingsinnstillinger må være med i markedsførings-e-post.",
  },
  {
    key: "linkedin_expiry",
    name: "LinkedIn-token utløper",
    description: "Daglig 09:00, til brukere hvis LinkedIn-tilgang snart utløper.",
    variables: [
      { key: "firstName", label: "Fornavn", sample: "Tamer" },
      { key: "when", label: "Når (utløper om N dager / har utløpt)", sample: "utløper om 5 dager" },
      { key: "settingsUrl", label: "Lenke til innstillinger", sample: "https://penna.no/innstillinger" },
    ],
    required: ["settingsUrl"],
  },
  {
    key: "weekly_report",
    name: "Ukentlig rapport",
    description: "Sendes til brukere som har slått på ukerapport.",
    variables: [
      { key: "name", label: "Navn", sample: "Tamer" },
      { key: "postsGenerated", label: "Innlegg generert", sample: "12" },
      { key: "postsPublished", label: "Innlegg publisert", sample: "8" },
      { key: "totalEngagement", label: "Totalt engasjement", sample: "431" },
      { key: "topPlatform", label: "Beste plattform", sample: "LinkedIn" },
      { key: "dashboardUrl", label: "Lenke til dashbord", sample: "https://penna.no/dashboard" },
    ],
    required: [],
  },
];

export function findBuiltIn(key: string): BuiltInTemplate | undefined {
  return BUILT_IN_TEMPLATES.find((t) => t.key === key);
}

/** Every `{{placeholder}}` that appears in a string, in order of appearance. */
export function placeholdersIn(text: string): string[] {
  return [...text.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)].map((m) => m[1]);
}

export type ValidationError = { field: "subject" | "body" | "ctaHref" | "name"; message: string };

/**
 * Refuse a template that cannot work, while the admin is still looking at it.
 *
 * For a custom template there is no declared variable set, so unknown
 * placeholders are the admin's business — but for an override, a typo like
 * `{{firstname}}` would ship as literal text to every customer. Better to say so.
 */
export function validateTemplate(input: {
  name: string;
  subject: string;
  bodyHtml: string;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  builtIn?: BuiltInTemplate;
}): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!input.name.trim()) errors.push({ field: "name", message: "Navn kan ikke være tomt." });
  if (!input.subject.trim()) errors.push({ field: "subject", message: "Emnefeltet kan ikke være tomt." });

  // An empty body is almost certainly a mistake, and it is indistinguishable from
  // a successful send at the recipient's end.
  const textContent = input.bodyHtml.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  if (!textContent) errors.push({ field: "body", message: "Innholdet kan ikke være tomt." });

  const used = new Set([
    ...placeholdersIn(input.subject),
    ...placeholdersIn(input.bodyHtml),
    ...placeholdersIn(input.ctaHref ?? ""),
    ...placeholdersIn(input.ctaLabel ?? ""),
  ]);

  if (input.builtIn) {
    const known = new Set(input.builtIn.variables.map((v) => v.key));
    for (const p of used) {
      if (!known.has(p)) {
        errors.push({
          field: "body",
          message: `Ukjent variabel {{${p}}}. Tilgjengelige: ${[...known].map((k) => `{{${k}}}`).join(", ")}`,
        });
      }
    }
    for (const req of input.builtIn.required) {
      if (!used.has(req)) {
        errors.push({
          field: "body",
          message: `{{${req}}} må være med. ${input.builtIn.note ?? ""}`.trim(),
        });
      }
    }
  }

  // A CTA needs both halves or neither; a labelled button with no target is a
  // dead end, and a target with no label is invisible.
  const hasLabel = Boolean(input.ctaLabel?.trim());
  const hasHref = Boolean(input.ctaHref?.trim());
  if (hasLabel !== hasHref) {
    errors.push({
      field: "ctaHref",
      message: "En knapp trenger både tekst og lenke — eller ingen av dem.",
    });
  }
  // If the href is a literal URL (not a placeholder), it must be http(s) now
  // rather than silently disappearing at send time.
  if (hasHref && placeholdersIn(input.ctaHref!).length === 0 && !safeCtaHref(input.ctaHref!)) {
    errors.push({ field: "ctaHref", message: "Lenken må være en gyldig http- eller https-adresse." });
  }

  return errors;
}

/**
 * Substitute `{{key}}` with the ESCAPED value.
 *
 * Escaping here is the point: these values are a customer's name, a support
 * reply, a plan name. They are not markup and must never become markup.
 * A missing key is left as-is rather than blanked, so a mistake is visible in the
 * preview instead of producing a sentence with a hole in it.
 */
export function substitute(text: string, vars: Record<string, string | number | null | undefined>): string {
  return text.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (whole, key: string) => {
    const value = vars[key];
    if (value === undefined || value === null) return whole;
    return escapeHtml(String(value));
  });
}

/** Subject lines are plain text — escaping there would show `&amp;` to the reader. */
export function substitutePlain(
  text: string,
  vars: Record<string, string | number | null | undefined>
): string {
  return text.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (whole, key: string) => {
    const value = vars[key];
    return value === undefined || value === null ? whole : String(value);
  });
}

export type StoredTemplate = {
  id: number;
  templateKey: string | null;
  name: string;
  subject: string;
  bodyHtml: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  kind: "override" | "custom";
  enabled: boolean;
  updatedAt: Date | null;
};

/** The override for a built-in key, or null when there is none in force. */
export async function getOverride(key: string): Promise<StoredTemplate | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const [row] = await db
      .select()
      .from(emailTemplates)
      .where(and(eq(emailTemplates.templateKey, key), eq(emailTemplates.kind, "override")))
      .limit(1);
    if (!row) return null;
    if (!row.enabled) return null;
    return toStored(row);
  } catch (error) {
    // The built-in copy is the fallback for every failure, including this one.
    console.error("[emailTemplates] could not read override, using built-in:", error);
    return null;
  }
}

function toStored(row: typeof emailTemplates.$inferSelect): StoredTemplate {
  return {
    id: row.id,
    templateKey: row.templateKey,
    name: row.name,
    subject: row.subject,
    bodyHtml: row.bodyHtml,
    ctaLabel: row.ctaLabel,
    ctaHref: row.ctaHref,
    kind: row.kind,
    enabled: Boolean(row.enabled),
    updatedAt: row.updatedAt ?? null,
  };
}

export type RenderedEmail = { subject: string; bodyHtml: string; ctaLabel?: string; ctaHref?: string };

/**
 * Render a stored template with a set of values.
 *
 * Sanitises on READ as well as on write: a row stored before the allow-list was
 * last tightened would otherwise keep whatever it was saved with.
 */
export function renderStored(
  tpl: Pick<StoredTemplate, "subject" | "bodyHtml" | "ctaLabel" | "ctaHref">,
  vars: Record<string, string | number | null | undefined>
): RenderedEmail {
  const bodyHtml = sanitizeHtml(substitute(tpl.bodyHtml, vars));
  const href = tpl.ctaHref ? safeCtaHref(substitutePlain(tpl.ctaHref, vars)) : undefined;
  // The label is ESCAPED, not sanitised. `pennaEmailShell` drops it straight into
  // `>${label}<`, so it is the one stored field that reaches HTML with no filter
  // of its own — a label of `Klikk</a><a href="http://evil/">Nytt passord</a>`
  // would put a second, attacker-chosen link inside a genuine, DKIM-signed Penna
  // e-mail. It is a button caption: it has no business containing markup at all.
  const label = href && tpl.ctaLabel ? escapeHtml(substitute(tpl.ctaLabel, vars)) : undefined;
  return {
    subject: substitutePlain(tpl.subject, vars),
    bodyHtml,
    ctaLabel: label,
    ctaHref: href,
  };
}

/**
 * The whole override path in one call, for `_core/email.ts` to use.
 *
 * Returns null whenever the built-in should be used — no row, disabled, invalid,
 * or anything thrown. Callers do not need to handle errors; that is deliberate,
 * because the caller is a transactional send.
 */
export async function renderOverride(
  key: string,
  vars: Record<string, string | number | null | undefined>
): Promise<RenderedEmail | null> {
  try {
    const tpl = await getOverride(key);
    if (!tpl) return null;

    const builtIn = findBuiltIn(key);
    // Re-validate at SEND time, not just at save time. The registry's required
    // placeholders can change in a later release while a row saved against the
    // old rules sits in the database.
    const errors = validateTemplate({ ...tpl, builtIn });
    if (errors.length > 0) {
      console.error(
        `[emailTemplates] override "${key}" is invalid, using built-in:`,
        errors.map((e) => e.message).join("; ")
      );
      return null;
    }

    const rendered = renderStored(tpl, vars);
    // A required placeholder that resolved to nothing is the same failure as one
    // that was never there. Check the OUTPUT, not just the template.
    for (const req of builtIn?.required ?? []) {
      const value = vars[req];
      if (value === undefined || value === null || String(value).trim() === "") {
        console.error(`[emailTemplates] override "${key}" needs ${req} but it was empty; using built-in`);
        return null;
      }
    }
    return rendered;
  } catch (error) {
    console.error(`[emailTemplates] override "${key}" failed to render, using built-in:`, error);
    return null;
  }
}

/** Sample values for the preview and the test send. */
export function sampleVars(key: string): Record<string, string> {
  const builtIn = findBuiltIn(key);
  if (!builtIn) return { name: "Tamer", siteUrl: "https://penna.no" };
  return Object.fromEntries(builtIn.variables.map((v) => [v.key, v.sample]));
}

/** Everything the admin page lists: each built-in, plus every custom template. */
export async function listTemplates() {
  const db = await getDb();
  // Degrade to "no overrides" rather than failing the page. A missing table or a
  // database hiccup should mean the admin sees the built-ins listed as standard —
  // not an empty screen, which is what makes a whole feature look broken.
  let rows: (typeof emailTemplates.$inferSelect)[] = [];
  try {
    if (db) rows = await db.select().from(emailTemplates).limit(200);
  } catch (error) {
    console.error("[emailTemplates] could not list templates:", error);
  }
  const byKey = new Map(rows.filter((r) => r.templateKey).map((r) => [r.templateKey as string, r]));

  return {
    builtIns: BUILT_IN_TEMPLATES.map((b) => {
      const row = byKey.get(b.key);
      return {
        ...b,
        overridden: Boolean(row),
        enabled: row ? Boolean(row.enabled) : false,
        stored: row ? toStored(row) : null,
      };
    }),
    custom: rows.filter((r) => r.kind === "custom").map(toStored),
  };
}

export async function saveTemplate(input: {
  id?: number;
  templateKey?: string | null;
  name: string;
  subject: string;
  bodyHtml: string;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  enabled?: boolean;
  adminUserId: number;
}): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const builtIn = input.templateKey ? findBuiltIn(input.templateKey) : undefined;
  if (input.templateKey && !builtIn) {
    throw new Error(`Ukjent mal-nøkkel «${input.templateKey}».`);
  }

  // Say it, do not silently drop it. `sanitizeHtml` strips `data:` URIs, so an
  // image pasted straight into the editor would vanish between pressing Save and
  // seeing the result, with no explanation. Checked on the RAW input, before the
  // sanitiser removes the evidence.
  if (/<img[^>]+src\s*=\s*["']?\s*data:/i.test(input.bodyHtml)) {
    throw new Error(
      "Bilder kan ikke limes inn direkte — bruk bildeknappen, så lastes de opp og hostes. " +
        "Gmail og Outlook blokkerer innebygde base64-bilder."
    );
  }

  // Sanitise BEFORE validating, so the admin is judged on what will actually be
  // stored — otherwise a body whose only content was a stripped `<script>` would
  // pass the "not empty" check and then be saved empty.
  const bodyHtml = sanitizeHtml(input.bodyHtml);
  const errors = validateTemplate({ ...input, bodyHtml, builtIn });
  if (errors.length > 0) {
    throw new Error(errors.map((e) => e.message).join(" "));
  }

  const values = {
    templateKey: input.templateKey ?? null,
    name: input.name.trim(),
    subject: input.subject.trim(),
    bodyHtml,
    ctaLabel: input.ctaLabel?.trim() || null,
    ctaHref: input.ctaHref?.trim() || null,
    kind: (input.templateKey ? "override" : "custom") as "override" | "custom",
    enabled: input.enabled === false ? 0 : 1,
    updatedByUserId: input.adminUserId,
  };

  if (input.id) {
    // Scope the UPDATE by kind as well as id. Without this,
    // `{ id: <a custom draft>, templateKey: "password_reset" }` silently rewrites
    // a marketing draft into the password-reset override — `deleteCustomTemplate`
    // already guards this way and the update had no reason not to.
    const scope = input.templateKey
      ? and(eq(emailTemplates.id, input.id), eq(emailTemplates.templateKey, input.templateKey))
      : and(eq(emailTemplates.id, input.id), isNull(emailTemplates.templateKey));
    const res: unknown = await db.update(emailTemplates).set(values).where(scope);
    const affected =
      (res as { affectedRows?: number }[])?.[0]?.affectedRows ??
      (res as { affectedRows?: number })?.affectedRows ??
      0;
    if (affected === 0) {
      throw new Error("Malen finnes ikke, eller den er av en annen type enn forventet.");
    }
    return { id: input.id };
  }

  if (input.templateKey) {
    // One override per built-in. The unique key makes this safe against a double
    // submit; onDuplicateKeyUpdate turns the race into an update instead of an error.
    await db
      .insert(emailTemplates)
      .values(values)
      .onDuplicateKeyUpdate({ set: { ...values, updatedAt: new Date() } });
    const [row] = await db
      .select({ id: emailTemplates.id })
      .from(emailTemplates)
      .where(eq(emailTemplates.templateKey, input.templateKey))
      .limit(1);
    return { id: row?.id ?? 0 };
  }

  const inserted = await db.insert(emailTemplates).values(values).$returningId();
  return { id: inserted[0]?.id ?? 0 };
}

/** Drop an override so the built-in copy is used again. */
export async function resetOverride(key: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!findBuiltIn(key)) throw new Error(`Ukjent mal-nøkkel «${key}».`);
  await db
    .delete(emailTemplates)
    .where(and(eq(emailTemplates.templateKey, key), eq(emailTemplates.kind, "override")));
}

/** Delete a custom template. Overrides are reset, never deleted, via resetOverride. */
export async function deleteCustomTemplate(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(emailTemplates)
    .where(and(eq(emailTemplates.id, id), eq(emailTemplates.kind, "custom"), isNull(emailTemplates.templateKey)));
}
