/**
 * Stripe webhook signature verification — the security boundary that stops a
 * forged webhook from activating subscriptions or faking payments. Uses Stripe's
 * own generateTestHeaderString to produce a genuine signature (crypto only, no
 * network), then asserts: valid -> accepted; tampered body / wrong secret -> rejected.
 */
import { describe, it, expect, beforeAll } from "vitest";
import Stripe from "stripe";

const SECRET = "whsec_test_secret_abc1234567890";
const stripe = new Stripe("sk_test_dummy_key");

const eventPayload = JSON.stringify({
  id: "evt_test_1",
  object: "event",
  type: "checkout.session.completed",
  data: { object: { id: "cs_test_1", metadata: { user_id: "1", product_key: "PRO_MONTHLY" } } },
});

let constructWebhookEvent: (p: Buffer, sig: string, secret: string) => Stripe.Event;

beforeAll(async () => {
  // stripeService builds a Stripe client at import time from this env var.
  process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_key";
  ({ constructWebhookEvent } = await import("./stripe/stripeService"));
});

describe("Stripe webhook signature verification", () => {
  it("accepts an event signed with the correct secret", () => {
    const sig = stripe.webhooks.generateTestHeaderString({ payload: eventPayload, secret: SECRET });
    const event = constructWebhookEvent(Buffer.from(eventPayload), sig, SECRET);
    expect(event.id).toBe("evt_test_1");
    expect(event.type).toBe("checkout.session.completed");
  });

  it("rejects a tampered body that no longer matches the signature", () => {
    const sig = stripe.webhooks.generateTestHeaderString({ payload: eventPayload, secret: SECRET });
    const tampered = eventPayload.replace("PRO_MONTHLY", "ENTERPRISE_YEARLY");
    expect(() => constructWebhookEvent(Buffer.from(tampered), sig, SECRET)).toThrow();
  });

  it("rejects an event signed with a different (attacker) secret", () => {
    const forged = stripe.webhooks.generateTestHeaderString({ payload: eventPayload, secret: "whsec_attacker_secret" });
    expect(() => constructWebhookEvent(Buffer.from(eventPayload), forged, SECRET)).toThrow();
  });

  it("rejects a missing/garbage signature", () => {
    expect(() => constructWebhookEvent(Buffer.from(eventPayload), "t=1,v1=deadbeef", SECRET)).toThrow();
  });
});
