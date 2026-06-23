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
      from: fromEmail || process.env.SENDGRID_FROM_EMAIL || "noreply@innlegg.no",
      subject,
      html: htmlContent,
    };

    await sgMail.send(msg);
    console.log(`[SendGrid] Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error("[SendGrid] Failed to send email:", error);
    return false;
  }
}

/**
 * Send welcome email to new user
 */
export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Velkommen til Innlegg!</h1>
      <p>Hei ${name},</p>
      <p>Takk for at du registrerte deg på Innlegg - din AI-drevne innholdsassistent for sosiale medier.</p>
      <p>Du kan nå begynne å generere profesjonelle innlegg for LinkedIn, Twitter, Instagram og Facebook.</p>
      <a href="${process.env.VITE_APP_URL || "https://innlegg.no"}/dashboard" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">
        Gå til Dashboard
      </a>
      <p style="margin-top: 30px; color: #666; font-size: 12px;">
        Hvis du har spørsmål, kontakt oss på support@innlegg.no
      </p>
    </div>
  `;

  return sendEmail(email, "Velkommen til Innlegg!", htmlContent);
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
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Abonnement bekreftet!</h1>
      <p>Hei ${name},</p>
      <p>Takk for ditt abonnement på <strong>${planName}</strong> planen.</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Abonnementdetaljer:</strong></p>
        <p>Plan: ${planName}</p>
        <p>Beløp: ${amount} NOK</p>
      </div>
      <p>Du har nå full tilgang til alle funksjoner. Lykke til med innholdsgenereringen!</p>
      <a href="${process.env.VITE_APP_URL || "https://innlegg.no"}/dashboard" style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">
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
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Støtteticket mottatt</h1>
      <p>Hei ${name},</p>
      <p>Takk for at du kontaktet oss. Vi har mottatt ditt støtteticket.</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Ticket ID:</strong> #${ticketId}</p>
        <p><strong>Emne:</strong> ${subject}</p>
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
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Nytt svar på ditt støtteticket</h1>
      <p>Hei ${name},</p>
      <p>${isAdminReply ? "Vi har svart på ditt støtteticket:" : "Du har mottatt et nytt svar:"}</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Ticket ID:</strong> #${ticketId}</p>
        <p><strong>Svar:</strong></p>
        <p>${replyMessage}</p>
      </div>
      <a href="${process.env.VITE_APP_URL || "https://innlegg.no"}/support/tickets/${ticketId}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">
        Vis Ticket
      </a>
    </div>
  `;

  return sendEmail(email, `Nytt svar på ticket #${ticketId}`, htmlContent);
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetLink: string
): Promise<boolean> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Tilbakestill passord</h1>
      <p>Hei ${name},</p>
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
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Din ukentlige rapport</h1>
      <p>Hei ${name},</p>
      <p>Her er dine innholdsstatistikker for denne uken:</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Innlegg generert:</strong> ${stats.postsGenerated}</p>
        <p><strong>Innlegg publisert:</strong> ${stats.postsPublished}</p>
        <p><strong>Total engasjement:</strong> ${stats.totalEngagement}</p>
        <p><strong>Beste plattform:</strong> ${stats.topPlatform}</p>
      </div>
      <a href="${process.env.VITE_APP_URL || "https://innlegg.no"}/dashboard" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">
        Se Detaljert Rapport
      </a>
    </div>
  `;

  return sendEmail(email, "Din ukentlige rapport", htmlContent);
}