/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import sgMail from "@sendgrid/mail";

/**
 * Initialize SendGrid with API key
 */
export function initializeSendGrid(): void {
  const sendGridApiKey = process.env.SENDGRID_API_KEY;

  if (!sendGridApiKey) {
    console.warn("[SendGrid] SENDGRID_API_KEY not configured - email service disabled");
    return;
  }

  sgMail.setApiKey(sendGridApiKey);
  console.log("[SendGrid] Initialized successfully");
}

/**
 * Is outbound email actually configured?
 *
 * `sendEmail` returns `false` and logs a warning when it is not — it never
 * throws. That is the right default for automated lifecycle mail (a missing key
 * must not crash the scheduler), but it is the wrong default for a human
 * pressing Send: they would be told 200 messages went out when the transport was
 * never wired up. The admin path checks this first and refuses instead.
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.SENDGRID_API_KEY);
}

/**
 * Send a simple email
 */
export async function sendEmail(
  to: string,
  subject: string,
  htmlContent: string,
  fromEmail?: string
): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn("[SendGrid] Email not sent - API key not configured");
    return false;
  }

  try {
    const msg = {
      to,
      from: fromEmail || process.env.SENDGRID_FROM_EMAIL || "noreply@penna.no",
      subject,
      html: htmlContent,
    };

    await sgMail.send(msg);
    console.log(`[SendGrid] Email sent to ${to}`);
    return true;
  } catch (error) {
    const err = error as { code?: number; message?: string; response?: { body?: unknown } };
    console.error(
      "[SendGrid] Failed to send email:",
      err?.code ?? "",
      err?.response?.body ? JSON.stringify(err.response.body) : err?.message ?? String(error),
    );
    return false;
  }
}

/** Canonical site URL for links inside emails. */
function siteUrl(): string {
  return process.env.PUBLIC_SITE_URL || process.env.VITE_APP_URL || "https://penna.no";
}

/**
 * Shared Penna email shell: wordmark header, a body, an optional gradient CTA,
 * and a footer with an unsubscribe/settings link. Keeps every lifecycle/journey
 * email visually consistent and on-brand. `bodyHtml` is trusted (server-authored
 * copy only — never user input).
 */
export function pennaEmailShell(opts: {
  bodyHtml: string;
  ctaLabel?: string;
  ctaHref?: string;
  footerNote?: string;
}): string {
  const site = siteUrl();
  const cta =
    opts.ctaLabel && opts.ctaHref
      ? `<div style="text-align:center; margin: 28px 0;">
           <a href="${opts.ctaHref}" style="display:inline-block; padding:14px 28px; background:linear-gradient(90deg,#2563EB,#7C3AED); color:#ffffff; text-decoration:none; border-radius:10px; font-weight:700; font-size:16px;">${opts.ctaLabel}</a>
         </div>`
      : "";
  const footer =
    opts.footerNote ??
    `Du får denne e-posten fordi du har en Penna-konto. Vil du ikke ha slike tips? <a href="${site}/innstillinger" style="color:#2563EB;">Endre varslingsinnstillingene</a>.`;
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; color:#0B132B;">
      <div style="text-align:center; padding: 8px 0 4px;">
        <span style="font-size: 22px; font-weight: 700; color:#2563EB;">Penna</span>
      </div>
      ${opts.bodyHtml}
      ${cta}
      <hr style="border:none; border-top:1px solid #E8EEF7; margin: 28px 0 14px;" />
      <p style="color:#9AA6BF; font-size:12px; line-height:1.6;">${footer}</p>
    </div>
  `;
}

/**
 * Send a Penna-branded email whose inner body is already server-authored HTML.
 * Used by the lifecycle/customer-journey sequence.
 */
export async function sendBrandedEmail(
  to: string,
  subject: string,
  opts: { bodyHtml: string; ctaLabel?: string; ctaHref?: string; footerNote?: string }
): Promise<boolean> {
  return sendEmail(to, subject, pennaEmailShell(opts));
}


/**
 * Send a built-in e-mail, letting an admin-authored override replace the copy.
 *
 * `fallback` is not an error path, it is THE path whenever anything at all is
 * unusual: no override row, the row disabled, invalid, a placeholder that
 * resolved to nothing, the database unreachable, an exception anywhere in the
 * render. A customer waiting on a password reset must not depend on a template
 * edit having been correct.
 *
 * Imported lazily: `services/emailTemplates` reaches the database, and `_core`
 * must not pull that in at module load.
 */
async function withOverride(
  key: string,
  to: string,
  vars: Record<string, string | number | null | undefined>,
  fallback: () => Promise<boolean>
): Promise<boolean> {
  try {
    const { renderOverride } = await import("../services/emailTemplates");
    const rendered = await renderOverride(key, vars);
    if (rendered) {
      return sendEmail(
        to,
        rendered.subject,
        pennaEmailShell({
          bodyHtml: rendered.bodyHtml,
          ctaLabel: rendered.ctaLabel,
          ctaHref: rendered.ctaHref,
        })
      );
    }
  } catch (error) {
    console.error(`[email] override "${key}" unavailable, sending built-in:`, error);
  }
  return fallback();
}

/**
 * Escape a value that is about to be interpolated into one of the built-in
 * template literals below.
 *
 * These are all `${name}`-style interpolations of values that came from a
 * customer — a display name, a support reply, a ticket subject. None of them was
 * escaped, so a reply containing `<a href="http://evil/">Reset your password</a>`
 * became a working link inside a genuine, correctly-signed Penna e-mail. That is
 * a phishing primitive handed out by our own transport.
 */
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Send welcome email to new user
 */
export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  const site = siteUrl();
  return withOverride(
    "welcome",
    email,
    { name, siteUrl: site, dashboardUrl: `${site}/dashboard` },
    () => sendWelcomeEmailBuiltIn(email, name)
  );
}

async function sendWelcomeEmailBuiltIn(email: string, name: string): Promise<boolean> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Velkommen til Penna!</h1>
      <p>Hei ${esc(name)},</p>
      <p>Takk for at du registrerte deg på Penna - din AI-drevne innholdsassistent for sosiale medier.</p>
      <p>Du kan nå begynne å generere profesjonelle innlegg for LinkedIn, Twitter, Instagram og Facebook.</p>
      <a href="${siteUrl()}/dashboard" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">
        Gå til Dashboard
      </a>
      <p style="margin-top: 30px; color: #666; font-size: 12px;">
        Hvis du har spørsmål, kontakt oss på support@penna.no
      </p>
    </div>
  `;

  return sendEmail(email, "Velkommen til Penna!", htmlContent);
}

/**
 * Weekly "Monday ritual" re-engagement email — nudges the user to create the
 * week's posts. Caller (scheduler) already filtered by notification preferences.
 */
export async function sendWeeklyRitualEmail(email: string, name: string): Promise<boolean> {
  const site = siteUrl();
  const firstName = (name || "").split(" ")[0] || "der";
  return withOverride(
    "weekly_ritual",
    email,
    { firstName, generateUrl: `${site}/generer`, settingsUrl: `${site}/innstillinger` },
    () => sendWeeklyRitualEmailBuiltIn(email, name)
  );
}

async function sendWeeklyRitualEmailBuiltIn(email: string, name: string): Promise<boolean> {
  const site = siteUrl();
  const firstName = (name || "").split(" ")[0] || "der";
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #0B132B;">
      <div style="text-align:center; padding: 8px 0 4px;">
        <span style="font-size: 22px; font-weight: 700; color:#2563EB;">Penna</span>
      </div>
      <h1 style="color:#0B132B; font-size: 22px;">Klar for ukens innlegg, ${esc(firstName)}? ✍️</h1>
      <p style="font-size:15px; line-height:1.6; color:#374151;">Ny uke, nytt innhold. Det tar bare et par minutter å lage ukens innlegg for LinkedIn, X, Instagram og Facebook — i din egen stemme.</p>
      <p style="font-size:15px; line-height:1.6; color:#374151;">Trykk under, skriv en kort idé, og la Penna gjøre resten.</p>
      <div style="text-align:center; margin: 28px 0;">
        <a href="${site}/generer" style="display:inline-block; padding:14px 28px; background:linear-gradient(90deg,#2563EB,#7C3AED); color:#ffffff; text-decoration:none; border-radius:10px; font-weight:700; font-size:16px;">Lag ukens innlegg →</a>
      </div>
      <p style="font-size:13px; line-height:1.6; color:#6B7280;">Tips: planlegg innleggene i Kalenderen, så publiseres de automatisk på beste tidspunkt.</p>
      <hr style="border:none; border-top:1px solid #E8EEF7; margin: 28px 0 14px;" />
      <p style="color:#9AA6BF; font-size:12px; line-height:1.6;">Du får denne e-posten fordi du har en Penna-konto. Vil du ikke ha ukentlige påminnelser? <a href="${site}/innstillinger" style="color:#2563EB;">Endre varslingsinnstillingene</a>.</p>
    </div>
  `;
  return sendEmail(email, "Klar for ukens innlegg? ✍️", htmlContent);
}

/**
 * Remind a user that their LinkedIn connection is about to expire (or has).
 */
export async function sendLinkedInExpiryReminderEmail(email: string, name: string, expiresAt: Date): Promise<boolean> {
  const site = siteUrl();
  const firstName = (name || "").split(" ")[0] || "der";
  const days = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
  const when = days <= 0 ? "har utl\u00f8pt" : `utl\u00f8per om ${days} ${days === 1 ? "dag" : "dager"}`;
  return withOverride(
    "linkedin_expiry",
    email,
    { firstName, when, settingsUrl: `${site}/innstillinger` },
    () => sendLinkedInExpiryReminderEmailBuiltIn(email, name, expiresAt)
  );
}

async function sendLinkedInExpiryReminderEmailBuiltIn(email: string, name: string, expiresAt: Date): Promise<boolean> {
  const site = siteUrl();
  const firstName = (name || "").split(" ")[0] || "der";
  const days = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
  const when = days <= 0 ? "har utl\u00f8pt" : `utl\u00f8per om ${days} ${days === 1 ? "dag" : "dager"}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #0B132B;">
      <div style="text-align:center; padding: 8px 0 4px;">
        <span style="font-size: 22px; font-weight: 700; color:#2563EB;">Penna</span>
      </div>
      <h1 style="color:#0B132B; font-size: 22px;">LinkedIn-tilkoblingen din ${esc(when)}</h1>
      <p style="font-size:15px; line-height:1.6; color:#374151;">Hei ${esc(firstName)}! LinkedIn-tilgangen som lar Penna publisere innlegg for deg, varer i 60 dager og fornyes ikke automatisk. For at automatisk publisering skal fortsette \u00e5 virke, m\u00e5 du koble til LinkedIn p\u00e5 nytt.</p>
      <div style="text-align:center; margin: 28px 0;">
        <a href="${site}/innstillinger" style="display:inline-block; padding:14px 28px; background:linear-gradient(90deg,#2563EB,#7C3AED); color:#ffffff; text-decoration:none; border-radius:10px; font-weight:700; font-size:16px;">Koble til LinkedIn p\u00e5 nytt \u2192</a>
      </div>
      <p style="font-size:13px; line-height:1.6; color:#6B7280;">Det tar bare noen sekunder. Frem til du kobler til p\u00e5 nytt, blir innlegg ikke publisert automatisk til LinkedIn.</p>
      <hr style="border:none; border-top:1px solid #E8EEF7; margin: 28px 0 14px;" />
      <p style="color:#9AA6BF; font-size:12px; line-height:1.6;">Du f\u00e5r denne e-posten fordi du har koblet LinkedIn til Penna-kontoen din.</p>
    </div>
  `;
  const subject = days <= 0 ? "LinkedIn-tilkoblingen din er utl\u00f8pt" : "LinkedIn-tilkoblingen din utl\u00f8per snart";
  return sendEmail(email, subject, htmlContent);
}

/**
 * Send subscription confirmation email
 */
export async function sendSubscriptionConfirmationEmail(
  email: string,
  name: string,
  planName: string,
  amount: number
): Promise<boolean> {
  const site = siteUrl();
  return withOverride(
    "subscription_confirmation",
    email,
    { name, planName, amount, dashboardUrl: `${site}/dashboard` },
    () => sendSubscriptionConfirmationEmailBuiltIn(email, name, planName, amount)
  );
}

async function sendSubscriptionConfirmationEmailBuiltIn(
  email: string,
  name: string,
  planName: string,
  amount: number
): Promise<boolean> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Abonnement bekreftet!</h1>
      <p>Hei ${esc(name)},</p>
      <p>Takk for ditt abonnement på <strong>${esc(planName)}</strong> planen.</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Abonnementdetaljer:</strong></p>
        <p>Plan: ${esc(planName)}</p>
        <p>Beløp: ${esc(amount)} NOK</p>
      </div>
      <p>Du har nå full tilgang til alle funksjoner. Lykke til med innholdsgenereringen!</p>
      <a href="${siteUrl()}/dashboard" style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">
        Gå til Dashboard
      </a>
    </div>
  `;

  return sendEmail(email, "Abonnement bekreftet!", htmlContent);
}

/**
 * Send support ticket confirmation email
 */
export async function sendSupportTicketConfirmationEmail(
  email: string,
  name: string,
  ticketId: number,
  subject: string
): Promise<boolean> {
  return withOverride(
    "support_ticket_confirmation",
    email,
    { name, ticketId, ticketSubject: subject },
    () => sendSupportTicketConfirmationEmailBuiltIn(email, name, ticketId, subject)
  );
}

async function sendSupportTicketConfirmationEmailBuiltIn(
  email: string,
  name: string,
  ticketId: number,
  subject: string
): Promise<boolean> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Støtteticket mottatt</h1>
      <p>Hei ${esc(name)},</p>
      <p>Takk for at du kontaktet oss. Vi har mottatt ditt støtteticket.</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Ticket ID:</strong> #${ticketId}</p>
        <p><strong>Emne:</strong> ${esc(subject)}</p>
      </div>
      <p>Vi vil kontakte deg snarest mulig. Takk for tålmodigheten!</p>
      <p style="margin-top: 30px; color: #666; font-size: 12px;">
        Hvis du har flere spørsmål, svar på denne e-posten eller besøk vår support side.
      </p>
    </div>
  `;

  return sendEmail(email, `Støtteticket mottatt - #${ticketId}`, htmlContent);
}

/**
 * Send support ticket reply notification
 */
export async function sendSupportTicketReplyEmail(
  email: string,
  name: string,
  ticketId: number,
  replyMessage: string,
  isAdminReply: boolean
): Promise<boolean> {
  const site = siteUrl();
  return withOverride(
    "support_ticket_reply",
    email,
    { name, ticketId, replyText: replyMessage, ticketUrl: `${site}/support/tickets/${ticketId}` },
    () => sendSupportTicketReplyEmailBuiltIn(email, name, ticketId, replyMessage, isAdminReply)
  );
}

async function sendSupportTicketReplyEmailBuiltIn(
  email: string,
  name: string,
  ticketId: number,
  replyMessage: string,
  isAdminReply: boolean
): Promise<boolean> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Nytt svar på ditt støtteticket</h1>
      <p>Hei ${esc(name)},</p>
      <p>${isAdminReply ? "Vi har svart på ditt støtteticket:" : "Du har mottatt et nytt svar:"}</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Ticket ID:</strong> #${ticketId}</p>
        <p><strong>Svar:</strong></p>
        <p>${esc(replyMessage)}</p>
      </div>
      <a href="${siteUrl()}/support/tickets/${ticketId}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">
        Vis Ticket
      </a>
    </div>
  `;

  return sendEmail(email, `Nytt svar på ticket #${ticketId}`, htmlContent);
}

/**
 * Send email verification link
 */
export async function sendVerificationEmail(
  email: string,
  name: string,
  verifyLink: string
): Promise<boolean> {
  return withOverride(
    "verify_email",
    email,
    { name, verifyLink },
    () => sendVerificationEmailBuiltIn(email, name, verifyLink)
  );
}

async function sendVerificationEmailBuiltIn(
  email: string,
  name: string,
  verifyLink: string
): Promise<boolean> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Bekreft e-postadressen din</h1>
      <p>Hei ${esc(name)},</p>
      <p>Takk for at du registrerte deg på Penna. Bekreft e-postadressen din for å fullføre oppsettet.</p>
      <a href="${verifyLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">
        Bekreft e-post
      </a>
      <p style="margin-top: 20px; color: #666;">Lenken utløper om 24 timer.</p>
      <p style="margin-top: 20px; color: #666; font-size: 12px;">
        Hvis du ikke opprettet en konto, kan du ignorere denne e-posten.
      </p>
    </div>
  `;
  return sendEmail(email, "Bekreft e-postadressen din", htmlContent);
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetLink: string
): Promise<boolean> {
  return withOverride(
    "password_reset",
    email,
    { name, resetLink },
    () => sendPasswordResetEmailBuiltIn(email, name, resetLink)
  );
}

async function sendPasswordResetEmailBuiltIn(
  email: string,
  name: string,
  resetLink: string
): Promise<boolean> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Tilbakestill passord</h1>
      <p>Hei ${esc(name)},</p>
      <p>Du mottok denne e-posten fordi du ba om å tilbakestille passordet ditt.</p>
      <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">
        Tilbakestill Passord
      </a>
      <p style="margin-top: 20px; color: #666;">Lenken utløper om 24 timer.</p>
      <p style="margin-top: 20px; color: #666; font-size: 12px;">
        Hvis du ikke ba om dette, ignorer denne e-posten.
      </p>
    </div>
  `;

  return sendEmail(email, "Tilbakestill passord", htmlContent);
}

/**
 * Send weekly report email
 */
export async function sendWeeklyReportEmail(
  email: string,
  name: string,
  stats: {
    postsGenerated: number;
    postsPublished: number;
    totalEngagement: number;
    topPlatform: string;
  }
): Promise<boolean> {
  const site = siteUrl();
  return withOverride(
    "weekly_report",
    email,
    { name, ...stats, dashboardUrl: `${site}/dashboard` },
    () => sendWeeklyReportEmailBuiltIn(email, name, stats)
  );
}

async function sendWeeklyReportEmailBuiltIn(
  email: string,
  name: string,
  stats: {
    postsGenerated: number;
    postsPublished: number;
    totalEngagement: number;
    topPlatform: string;
  }
): Promise<boolean> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Din ukentlige rapport</h1>
      <p>Hei ${esc(name)},</p>
      <p>Her er dine innholdsstatistikker for denne uken:</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Innlegg generert:</strong> ${stats.postsGenerated}</p>
        <p><strong>Innlegg publisert:</strong> ${stats.postsPublished}</p>
        <p><strong>Total engasjement:</strong> ${stats.totalEngagement}</p>
        <p><strong>Beste plattform:</strong> ${esc(stats.topPlatform)}</p>
      </div>
      <a href="${siteUrl()}/dashboard" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">
        Se Detaljert Rapport
      </a>
    </div>
  `;

  return sendEmail(email, "Din ukentlige rapport", htmlContent);
}

/**
 * Periodic reminder that a paid subscription is still active + how to cancel.
 * Required by digitalytelsesloven / Forbrukertilsynet (at least every 6 months).
 */
export async function sendSubscriptionActiveReminderEmail(email: string, name: string): Promise<boolean> {
  const site = siteUrl();
  // The wording is editable; `billingUrl` is a required placeholder, so an
  // override cannot drop the "how to cancel" link the statute is about.
  return withOverride(
    "subscription_active_reminder",
    email,
    { name: name || "der", billingUrl: `${site}/settings/billing` },
    () => sendSubscriptionActiveReminderEmailBuiltIn(email, name)
  );
}

async function sendSubscriptionActiveReminderEmailBuiltIn(email: string, name: string): Promise<boolean> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2>Hei ${esc(name || "der")}!</h2>
      <p>Dette er en vennlig påminnelse om at Penna-abonnementet ditt fortsatt er aktivt og fornyes automatisk.</p>
      <p>Du kan når som helst se abonnementet, endre plan eller si opp – like enkelt som du meldte deg på – under
      <strong>Innstillinger → Fakturering</strong> i appen. Ingen bindingstid.</p>
      <p style="color:#666;font-size:13px;">Nexify CRM Systems AS · Org.nr 936 300 278</p>
    </div>`;
  return sendEmail(email, "Påminnelse: Penna-abonnementet ditt er aktivt", htmlContent);
}
