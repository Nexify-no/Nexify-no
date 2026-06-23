/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Subscription Notification Service
 * 
 * Sends notifications for subscription events using the built-in notification system
 */

import { notifyOwner } from "./_core/notification";

export interface SubscriptionNotificationData {
  userName: string;
  userEmail: string;
  planName: string;
  amount: string;
  currency: string;
}

/**
 * Notify owner when a new subscription is created
 */
export async function notifyNewSubscription(data: SubscriptionNotificationData): Promise<boolean> {
  const { userName, userEmail, planName, amount, currency } = data;
  
  return notifyOwner({
    title: `🎉 Ny Pro-abonnent: ${userName}`,
    content: `
**Ny abonnement aktivert!**

- **Bruker:** ${userName}
- **E-post:** ${userEmail}
- **Plan:** ${planName}
- **Beløp:** ${amount} ${currency}
- **Tidspunkt:** ${new Date().toLocaleString("nb-NO")}

Gratulerer med en ny Pro-kunde! 🚀
    `.trim(),
  });
}

/**
 * Notify owner when a subscription is cancelled
 */
export async function notifySubscriptionCancelled(data: {
  userName: string;
  userEmail: string;
  reason?: string;
}): Promise<boolean> {
  const { userName, userEmail, reason } = data;
  
  return notifyOwner({
    title: `❌ Abonnement kansellert: ${userName}`,
    content: `
**Abonnement kansellert**

- **Bruker:** ${userName}
- **E-post:** ${userEmail}
- **Tidspunkt:** ${new Date().toLocaleString("nb-NO")}
${reason ? `- **Årsak:** ${reason}` : ""}

Vurder å sende en oppfølgings-e-post for å forstå hvorfor.
    `.trim(),
  });
}

/**
 * Notify owner when a payment fails
 */
export async function notifyPaymentFailed(data: {
  userName: string;
  userEmail: string;
  errorMessage?: string;
}): Promise<boolean> {
  const { userName, userEmail, errorMessage } = data;
  
  return notifyOwner({
    title: `⚠️ Betaling mislyktes: ${userName}`,
    content: `
**Betaling mislyktes**

- **Bruker:** ${userName}
- **E-post:** ${userEmail}
- **Tidspunkt:** ${new Date().toLocaleString("nb-NO")}
${errorMessage ? `- **Feil:** ${errorMessage}` : ""}

Brukeren kan trenge hjelp med å oppdatere betalingsinformasjon.
    `.trim(),
  });
}

/**
 * Send daily subscription summary to owner
 */
export async function sendDailySubscriptionSummary(stats: {
  totalSubscribers: number;
  newToday: number;
  cancelledToday: number;
  revenue: string;
}): Promise<boolean> {
  const { totalSubscribers, newToday, cancelledToday, revenue } = stats;
  
  return notifyOwner({
    title: `📊 Daglig abonnementsrapport`,
    content: `
**Daglig oppsummering - ${new Date().toLocaleDateString("nb-NO")}**

- **Totalt aktive abonnenter:** ${totalSubscribers}
- **Nye i dag:** ${newToday}
- **Kansellert i dag:** ${cancelledToday}
- **Estimert månedlig inntekt:** ${revenue}

Ha en fin dag! 🌟
    `.trim(),
  });
}