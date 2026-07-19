/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */
import { describe, it, expect } from "vitest";
import {
  LEASE_MS, MAX_ATTEMPTS, newLease, isClaimable, heartbeatExpiry, ownsLease,
  retryDecision, derivePlanStatus, sanitizeError,
} from "./planLease";

const T0 = new Date("2026-07-20T10:00:00Z");
const plus = (ms: number) => new Date(T0.getTime() + ms);

describe("planLease", () => {
  it("issues a NEW lease token on every claim", () => {
    let n = 0;
    const mk = () => `tok-${++n}`;
    const a = newLease("w1", T0, mk);
    const b = newLease("w1", T0, mk);
    expect(a.leaseToken).not.toBe(b.leaseToken);
    expect(a.lockExpiresAt.getTime()).toBe(T0.getTime() + LEASE_MS);
  });

  it("claimable only when lock expired AND backoff passed", () => {
    expect(isClaimable({ lockExpiresAt: null, nextAttemptAt: null }, T0)).toBe(true);
    expect(isClaimable({ lockExpiresAt: plus(-1), nextAttemptAt: null }, T0)).toBe(true);
    expect(isClaimable({ lockExpiresAt: plus(60_000), nextAttemptAt: null }, T0)).toBe(false); // active lease
    expect(isClaimable({ lockExpiresAt: null, nextAttemptAt: plus(30_000) }, T0)).toBe(false); // backoff pending
    expect(isClaimable({ lockExpiresAt: plus(-1), nextAttemptAt: plus(-1) }, T0)).toBe(true);
  });

  it("AI call outliving the original lease: heartbeat keeps ownership alive", () => {
    const lease = newLease("w1", T0, () => "tok");
    // Without heartbeat, after LEASE_MS the row is claimable by others.
    expect(isClaimable({ lockExpiresAt: lease.lockExpiresAt, nextAttemptAt: null }, plus(LEASE_MS + 1))).toBe(true);
    // With a heartbeat at T0+60s the expiry moves forward — still owned.
    const extended = heartbeatExpiry(plus(60_000));
    expect(isClaimable({ lockExpiresAt: extended, nextAttemptAt: null }, plus(LEASE_MS + 1))).toBe(false);
    expect(ownsLease({ leaseToken: "tok", lockExpiresAt: extended }, "tok", plus(LEASE_MS + 1))).toBe(true);
  });

  it("a stale worker (lost lease) cannot pass the ownership check", () => {
    // Lease expired → write rejected even with the right token.
    expect(ownsLease({ leaseToken: "tok", lockExpiresAt: plus(-1) }, "tok", T0)).toBe(false);
    // Row re-claimed by another worker (new token) → old token rejected.
    expect(ownsLease({ leaseToken: "tok-2", lockExpiresAt: plus(LEASE_MS) }, "tok-1", T0)).toBe(false);
    // Current owner passes.
    expect(ownsLease({ leaseToken: "tok-2", lockExpiresAt: plus(LEASE_MS) }, "tok-2", T0)).toBe(true);
  });

  it("transient failure retries with exponential backoff, permanent failure after MAX_ATTEMPTS", () => {
    const d1 = retryDecision(1, T0);
    const d2 = retryDecision(2, T0);
    if (d1.action !== "retry" || d2.action !== "retry") throw new Error("expected retries");
    expect(d1.nextAttemptAt.getTime()).toBe(T0.getTime() + 30_000);
    expect(d2.nextAttemptAt.getTime()).toBe(T0.getTime() + 60_000);
    expect(d2.nextAttemptAt.getTime()).toBeGreaterThan(d1.nextAttemptAt.getTime());
    expect(retryDecision(MAX_ATTEMPTS, T0)).toEqual({ action: "fail" });
    expect(retryDecision(MAX_ATTEMPTS + 5, T0)).toEqual({ action: "fail" });
  });

  it("never finalizes a plan while any post is pending/generating", () => {
    expect(derivePlanStatus([{ generationStatus: "done" }, { generationStatus: "generating" }])).toBe("processing");
    expect(derivePlanStatus([{ generationStatus: "done" }, { generationStatus: "pending" }])).toBe("processing");
    expect(derivePlanStatus([{ generationStatus: "done" }, { generationStatus: "done" }])).toBe("ready");
    expect(derivePlanStatus([{ generationStatus: "done" }, { generationStatus: "failed" }])).toBe("partial");
    expect(derivePlanStatus([{ generationStatus: "failed" }, { generationStatus: "failed" }])).toBe("failed");
  });

  it("sanitizes errors: short, no long quoted payloads", () => {
    const msg = sanitizeError(new Error(`LLM said "${"x".repeat(500)}" and failed`));
    expect(msg.length).toBeLessThanOrEqual(280);
    expect(msg).not.toContain("x".repeat(100));
    expect(sanitizeError("plain")).toBe("plain");
  });
});
