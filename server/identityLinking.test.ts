/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * One account per email — and no pre-hijacking while we enforce it.
 *
 * The production symptom: three `users` rows sharing nexifyhub.no@gmail.com,
 * created by signing up with a password and then signing in with Google.
 */

import { describe, it, expect } from "vitest";
import {
  decideLink,
  normalizeEmail,
  type ExistingUser,
  type ProviderIdentity,
} from "./services/identityLinking";

const google = (over: Partial<ProviderIdentity> = {}): ProviderIdentity => ({
  provider: "google",
  subject: "1234567890",
  email: "nexifyhub.no@gmail.com",
  emailVerified: true,
  name: "Nexify Hub",
  ...over,
});

const passwordAccount = (over: Partial<ExistingUser> = {}): ExistingUser => ({
  id: 42,
  openId: "email_abc123",
  email: "nexifyhub.no@gmail.com",
  passwordHash: "$2b$12$fakehash",
  emailVerified: new Date("2026-07-01"),
  ...over,
});

describe("identity linking", () => {
  it("reproduces the production bug: a verified Google login reuses the existing account", () => {
    // Previously this path ignored `existing` entirely and inserted a new row.
    const d = decideLink(google(), passwordAccount());
    expect(d).toEqual({
      action: "use_existing",
      userId: 42,
      openId: "email_abc123",
      invalidatePassword: false,
    });
  });

  it("creates a new account when the address is genuinely unknown", () => {
    expect(decideLink(google(), null)).toEqual({ action: "create_new" });
  });

  it("creates a new account when the provider gives us no email", () => {
    expect(decideLink(google({ email: null }), passwordAccount())).toEqual({ action: "create_new" });
  });

  // ── the security half ──────────────────────────────────────────────────────

  it("refuses to link when the provider will not vouch for the address", () => {
    // LinkedIn/Vipps case. An unverified provider email is not proof of
    // ownership, so it must never open an account that already exists.
    const d = decideLink(google({ provider: "linkedin", emailVerified: false }), passwordAccount());
    expect(d).toEqual({ action: "refuse", reason: "email_taken_unverified_provider" });
  });

  it("kills the password when linking into an account that never verified its email", () => {
    // Pre-hijacking: an attacker registered the victim's address and never
    // received the verification mail. The victim now proves ownership via
    // Google. They get the account; the attacker's password must not survive.
    const attackerRow = passwordAccount({ emailVerified: null });
    const d = decideLink(google(), attackerRow);
    expect(d).toMatchObject({ action: "use_existing", userId: 42, invalidatePassword: true });
  });

  it("keeps the password when the existing account verified its own email", () => {
    // Same person, both methods, address proven on both sides. Nothing to kill.
    const d = decideLink(google(), passwordAccount({ emailVerified: new Date() }));
    expect(d).toMatchObject({ invalidatePassword: false });
  });

  it("does not touch a password that does not exist (OAuth-only account)", () => {
    const d = decideLink(google(), passwordAccount({ passwordHash: null, emailVerified: null }));
    expect(d).toMatchObject({ invalidatePassword: false });
  });

  // ── returning users ────────────────────────────────────────────────────────

  it("sends a known identity to its own account even if the email now matches another row", () => {
    // The person changed their Google address to one another account uses.
    // Identity beats email — otherwise a returning user silently switches
    // accounts and loses their work.
    const linked: ExistingUser = {
      id: 7,
      openId: "google_1234567890",
      email: "old@example.com",
      passwordHash: null,
      emailVerified: new Date(),
    };
    const d = decideLink(google(), passwordAccount(), linked);
    expect(d).toMatchObject({ action: "use_existing", userId: 7, openId: "google_1234567890" });
  });

  it("never invalidates a password on a plain returning login", () => {
    const linked = passwordAccount({ emailVerified: null });
    expect(decideLink(google(), null, linked)).toMatchObject({ invalidatePassword: false });
  });

  // ── normalisation ──────────────────────────────────────────────────────────

  it("treats addresses case-insensitively so casing cannot fork an account", () => {
    expect(normalizeEmail("  NexifyHub.NO@Gmail.com ")).toBe("nexifyhub.no@gmail.com");
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
    // A differently-cased provider email must still find the existing account.
    const d = decideLink(google({ email: "NEXIFYHUB.NO@GMAIL.COM" }), passwordAccount());
    expect(d).toMatchObject({ action: "use_existing", userId: 42 });
  });
});
