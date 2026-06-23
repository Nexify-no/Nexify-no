/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Stripe Service for Innlegg/Nexify AI
 * 
 * Handles checkout sessions, subscriptions, and customer management
 */

import Stripe from "stripe";
import { STRIPE_PRODUCTS, ProductKey } from "./products";

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export interface CreateCheckoutSessionParams {
  userId: number;
  userEmail: string;
  userName?: string;
  productKey: ProductKey;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  url: string;
}

/**
 * Create a Stripe Checkout Session for subscription
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<CheckoutSessionResult> {
  const { userId, userEmail, userName, productKey, successUrl, cancelUrl } = params;
  const product = STRIPE_PRODUCTS[productKey];

  if (!product) {
    throw new Error(`Invalid product key: ${productKey}`);
  }

  // Create or retrieve Stripe Price
  // In production, you should create prices in Stripe Dashboard and use their IDs
  const priceData: Stripe.Checkout.SessionCreateParams.LineItem.PriceData = {
    currency: "nok",
    product_data: {
      name: product.name,
      description: product.description,
    },
    unit_amount: product.priceNOK * 100, // Stripe uses cents
    recurring: {
      interval: product.interval,
    },
  };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    allow_promotion_codes: true,
    customer_email: userEmail,
    client_reference_id: userId.toString(),
    metadata: {
      user_id: userId.toString(),
      customer_email: userEmail,
      customer_name: userName || "",
      product_key: productKey,
    },
    line_items: [
      {
        price_data: priceData,
        quantity: 1,
      },
    ],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session URL");
  }

  return {
    sessionId: session.id,
    url: session.url,
  };
}

/**
 * Retrieve a checkout session by ID
 */
export async function getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription", "customer"],
  });
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return stripe.subscriptions.cancel(subscriptionId);
}

/**
 * Get subscription details
 */
export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Create a customer portal session for managing subscription
 */
export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

/**
 * Verify webhook signature and construct event
 */
export function constructWebhookEvent(
  payload: Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

export { stripe };