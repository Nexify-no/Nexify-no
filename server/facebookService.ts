/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Facebook Graph API Service
 * Handles communication with Facebook API for content posting and page management
 */

import crypto from "crypto";

const FACEBOOK_API_VERSION = "v18.0";
const FACEBOOK_GRAPH_URL = `https://graph.facebook.com/${FACEBOOK_API_VERSION}`;

export interface FacebookPageToken {
  pageId: string;
  accessToken: string;
  pageName: string;
  expiresAt?: Date;
}

export interface FacebookPostOptions {
  message: string;
  link?: string;
  picture?: string;
  caption?: string;
  description?: string;
  type?: "status" | "link" | "photo" | "video";
}

export interface FacebookPageInfo {
  id: string;
  name: string;
  category: string;
  picture?: {
    data: {
      height: number;
      width: number;
      is_silhouette: boolean;
      url: string;
    };
  };
}

/**
 * Get user's Facebook pages
 */
export async function getFacebookPages(userAccessToken: string): Promise<FacebookPageInfo[]> {
  try {
    const response = await fetch(
      `${FACEBOOK_GRAPH_URL}/me/accounts?access_token=${userAccessToken}&fields=id,name,category,picture`,
      { method: "GET" }
    );

    const data = await response.json();
    if (!data.ok && data.error) {
      console.error("[Facebook] Error fetching pages:", data.error);
      return [];
    }

    return data.data || [];
  } catch (error) {
    console.error("[Facebook] Failed to fetch pages:", error);
    return [];
  }
}

/**
 * Post content to Facebook page
 */
export async function postToFacebookPage(
  pageId: string,
  pageAccessToken: string,
  options: FacebookPostOptions
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const body: Record<string, any> = {
      message: options.message,
      access_token: pageAccessToken,
    };

    // Add optional fields
    if (options.link) body.link = options.link;
    if (options.picture) body.picture = options.picture;
    if (options.caption) body.caption = options.caption;
    if (options.description) body.description = options.description;

    const response = await fetch(`${FACEBOOK_GRAPH_URL}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (data.error) {
      console.error("[Facebook] Error posting:", data.error);
      return {
        success: false,
        error: data.error.message || "Failed to post to Facebook",
      };
    }

    return {
      success: true,
      postId: data.id,
    };
  } catch (error) {
    console.error("[Facebook] Failed to post:", error);
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Schedule a post for later
 */
export async function schedulePostToFacebook(
  pageId: string,
  pageAccessToken: string,
  options: FacebookPostOptions,
  scheduledTime: Date
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const body: Record<string, any> = {
      message: options.message,
      access_token: pageAccessToken,
      scheduled_publish_time: Math.floor(scheduledTime.getTime() / 1000),
      is_hidden: false,
    };

    // Add optional fields
    if (options.link) body.link = options.link;
    if (options.picture) body.picture = options.picture;
    if (options.caption) body.caption = options.caption;
    if (options.description) body.description = options.description;

    const response = await fetch(`${FACEBOOK_GRAPH_URL}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (data.error) {
      console.error("[Facebook] Error scheduling post:", data.error);
      return {
        success: false,
        error: data.error.message || "Failed to schedule post",
      };
    }

    return {
      success: true,
      postId: data.id,
    };
  } catch (error) {
    console.error("[Facebook] Failed to schedule post:", error);
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Get page insights (analytics)
 */
export async function getPageInsights(
  pageId: string,
  pageAccessToken: string,
  metric: string = "page_fans,page_impressions,page_engaged_users"
): Promise<any> {
  try {
    const response = await fetch(
      `${FACEBOOK_GRAPH_URL}/${pageId}/insights?metric=${metric}&access_token=${pageAccessToken}`,
      { method: "GET" }
    );

    const data = await response.json();
    if (data.error) {
      console.error("[Facebook] Error fetching insights:", data.error);
      return null;
    }

    return data.data || [];
  } catch (error) {
    console.error("[Facebook] Failed to fetch insights:", error);
    return null;
  }
}

/**
 * Delete a Facebook post
 */
export async function deleteFromFacebook(
  postId: string,
  pageAccessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${FACEBOOK_GRAPH_URL}/${postId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: pageAccessToken }),
    });

    const data = await response.json();

    if (data.error) {
      console.error("[Facebook] Error deleting post:", data.error);
      return {
        success: false,
        error: data.error.message || "Failed to delete post",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("[Facebook] Failed to delete post:", error);
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Verify Facebook webhook signature
 */
export function verifyFacebookWebhookSignature(
  body: string,
  signature: string,
  appSecret: string
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", appSecret)
    .update(body)
    .digest("hex");

  return signature === `sha256=${expectedSignature}`;
}

/**
 * Handle Facebook webhook events
 */
export function handleFacebookWebhookEvent(event: any): void {
  try {
    if (event.object === "page") {
      for (const entry of event.entry) {
        for (const messaging_event of entry.messaging) {
          if (messaging_event.message) {
            const senderId = messaging_event.sender.id;
            const message = messaging_event.message.text;

            console.log(
              `[Facebook] Received message from ${senderId}: ${message}`
            );

            // Handle incoming message
            // This can be extended to trigger content generation or other actions
          }

          if (messaging_event.postback) {
            const senderId = messaging_event.sender.id;
            const payload = messaging_event.postback.payload;

            console.log(
              `[Facebook] Received postback from ${senderId}: ${payload}`
            );

            // Handle postback events
          }
        }
      }
    }
  } catch (error) {
    console.error("[Facebook] Error handling webhook event:", error);
  }
}

/**
 * Send a message to a Facebook user
 */
export async function sendFacebookMessage(
  recipientId: string,
  message: string,
  pageAccessToken: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch(`${FACEBOOK_GRAPH_URL}/me/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
        access_token: pageAccessToken,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error("[Facebook] Error sending message:", data.error);
      return {
        success: false,
        error: data.error.message || "Failed to send message",
      };
    }

    return {
      success: true,
      messageId: data.message_id,
    };
  } catch (error) {
    console.error("[Facebook] Failed to send message:", error);
    return {
      success: false,
      error: String(error),
    };
  }
}