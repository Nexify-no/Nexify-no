/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * One account per email address, across every sign-in method.
 *
 * The bug this fixes: `users.openId` was unique, `users.email` was not, and the
 * OAuth callbacks upserted purely on openId. So the same person signing up with
 * a password and then clicking "Logg inn med Google" got a SECOND account —
 * observed in production with three rows sharing nexifyhub.no@gmail.com. The
 * user lands in an empty account: no posts, no Merkehjerne, and — if they were
 * paying — no subscription, while Stripe keeps billing the orphaned row.
 *
 * Only /api/auth/register checked the email. Google, LinkedIn and Vipps did not.
 *
 * ── Why this is not simply "find by email and log them in" ───────────────────
 *
 * That naive version enables account pre-hijacking:
 *
 *   1. Attacker registers victim@example.com with a password. The address is
 *      not theirs, so the verification mail goes to the victim and is ignored.
 *      The account sits unverified but real, with the attacker's password.
 *   2. Victim later clicks "Sign in with Google" and the provider confirms they
 *      own victim@example.com.
 *   3. Naive linking drops the victim into the attacker's row — and the
 *      attacker's password still works. They now read everything the victim
 *      creates.
 *
 * So linking is allowed only when the provider asserts the address is verified,
 * and when we link into an account whose own email was never verified we
 * invalidate its password. The attacker's credential dies at the moment of
 * linking; the real owner keeps the account and can set a new password through
 * the normal reset flow.
 *
 * A provider that does NOT assert verification (LinkedIn does not always, Vipps
 * returns an address that is not necessarily proven) never auto-links. Those
 * users are told to sign in the way the account was created.
 */

export type IdentityProvider = "google" | "linkedin" | "vipps" | "email" | "manus";

export interface ProviderIdentity {
  provider: IdentityProvider;
  /** Stable id from the provider (Google `sub`, LinkedIn `sub`, Vipps `sub`). */
  subject: string;
  email: string | null;
  /**
   * Did the provider assert this address is verified?
   *
   * Pass the provider's own claim — never `true` as a convenience default.
   * Google sets `email_verified` on the ID token. LinkedIn's `email_verified`
   * is present but not guaranteed. Vipps does not verify the address at all.
   */
  emailVerified: boolean;
  name: string | null;
}

/** What the caller should do next. */
export type LinkDecision =
  | { action: "use_existing"; userId: number; openId: string; invalidatePassword: boolean }
  | { action: "create_new" }
  | { action: "refuse"; reason: "email_taken_by_password_account" | "email_taken_unverified_provider" };

/** The subset of a user row this decision needs. */
export interface ExistingUser {
  id: number;
  openId: string;
  email: string | null;
  passwordHash: string | null;
  emailVerified: Date | null;
}

/** Emails are compared case-insensitively and trimmed; addresses are not case-sensitive in practice. */
export function normalizeEmail(email: string | null | undefined): string | null {
  const e = String(email ?? "").trim().toLowerCase();
  return e.length > 0 ? e : null;
}

/**
 * Decide what an OAuth callback should do, given the provider identity and any
 * pre-existing account on the same address.
 *
 * Pure function — no database, no side effects — so every branch is testable.
 * The caller performs the writes.
 *
 * @param identity  what the provider told us
 * @param existing  the account already holding this email, or null
 * @param alreadyLinked  the account this provider identity is already attached
 *                       to, if any. Takes priority: a returning user must land
 *                       in the same account every time, regardless of email
 *                       changes at the provider.
 */
export function decideLink(
  identity: ProviderIdentity,
  existing: ExistingUser | null,
  alreadyLinked: ExistingUser | null = null
): LinkDecision {
  // A known identity always wins. If the person changed their Google address,
  // we must not suddenly route them somewhere else.
  if (alreadyLinked) {
    return {
      action: "use_existing",
      userId: alreadyLinked.id,
      openId: alreadyLinked.openId,
      invalidatePassword: false,
    };
  }

  const email = normalizeEmail(identity.email);
  if (!email || !existing) return { action: "create_new" };

  // The provider will not vouch for the address, so it is not proof of
  // ownership and must not open someone else's account.
  if (!identity.emailVerified) {
    return { action: "refuse", reason: "email_taken_unverified_provider" };
  }

  // Provider-verified: the person demonstrably controls this address.
  //
  // If the existing account never verified its own email, its password may
  // belong to someone who merely typed the address. Link, but kill that
  // password — the rightful owner is the one standing in front of us now.
  const invalidatePassword = existing.passwordHash !== null && existing.emailVerified === null;

  return {
    action: "use_existing",
    userId: existing.id,
    openId: existing.openId,
    invalidatePassword,
  };
}

/** Norwegian message for a refused link, shown on the login screen. */
export function refusalMessage(reason: Extract<LinkDecision, { action: "refuse" }>["reason"]): string {
  switch (reason) {
    case "email_taken_by_password_account":
    case "email_taken_unverified_provider":
      return (
        "Denne e-postadressen er allerede registrert. Logg inn med passordet ditt, " +
        "eller bruk «Glemt passord» for å få tilgang."
      );
  }
}
