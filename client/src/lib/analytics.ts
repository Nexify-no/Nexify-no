/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Google Analytics 4 Helper Functions
 * Provides utility functions for tracking events and user interactions
 */

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

/**
 * Track a custom event in Google Analytics
 */
export function trackEvent(
  eventName: string,
  eventParams?: Record<string, any>
): void {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", eventName, eventParams);
  }
}

/**
 * Track page view
 */
export function trackPageView(pagePath: string, pageTitle?: string): void {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("config", import.meta.env.VITE_GA4_ID || "", {
      page_path: pagePath,
      page_title: pageTitle || document.title,
    });
  }
}

/**
 * Track user sign up
 */
export function trackSignUp(method: string): void {
  trackEvent("sign_up", {
    method,
  });
}

/**
 * Track user login
 */
export function trackLogin(method: string): void {
  trackEvent("login", {
    method,
  });
}

/**
 * Track user logout
 */
export function trackLogout(): void {
  trackEvent("logout");
}

/**
 * Track content generation
 */
export function trackContentGeneration(
  platform: string,
  tone: string,
  hasImage: boolean
): void {
  trackEvent("content_generated", {
    platform,
    tone,
    has_image: hasImage,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Track subscription event
 */
export function trackSubscription(planName: string, price: number): void {
  trackEvent("purchase", {
    currency: "NOK",
    value: price,
    items: [
      {
        item_id: planName,
        item_name: planName,
        price,
        quantity: 1,
      },
    ],
  });
}

/**
 * Track error event
 */
export function trackError(errorType: string, errorMessage: string): void {
  trackEvent("exception", {
    description: `${errorType}: ${errorMessage}`,
    fatal: false,
  });
}

/**
 * Track feature usage
 */
export function trackFeatureUsage(featureName: string, metadata?: Record<string, any>): void {
  trackEvent("feature_used", {
    feature_name: featureName,
    ...metadata,
  });
}

/**
 * Set user properties
 */
export function setUserProperties(properties: Record<string, any>): void {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("set", {
      user_properties: properties,
    });
  }
}

/**
 * Set user ID for cross-device tracking
 */
export function setUserId(userId: string): void {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("config", import.meta.env.VITE_GA4_ID || "", {
      user_id: userId,
    });
  }
}