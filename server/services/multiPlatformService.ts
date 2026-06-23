/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Multi-Platform Content Distribution Service
 * Handles posting content to multiple social media platforms simultaneously
 */

import { postToFacebookPage, schedulePostToFacebook, FacebookPostOptions } from "../facebookService";
import { sendTelegramMessage } from "../telegramService";

export interface MultiPlatformContent {
  platforms: PlatformConfig[];
  content: string;
  scheduledTime?: Date;
  metadata?: {
    title?: string;
    description?: string;
    imageUrl?: string;
    linkUrl?: string;
  };
}

export interface PlatformConfig {
  platform: "facebook" | "telegram" | "twitter" | "linkedin" | "instagram";
  enabled: boolean;
  config: Record<string, any>;
}

export interface DistributionResult {
  platform: string;
  success: boolean;
  postId?: string;
  error?: string;
  timestamp: Date;
}

/**
 * Distribute content to multiple platforms
 */
export async function distributeContent(
  content: MultiPlatformContent
): Promise<DistributionResult[]> {
  const results: DistributionResult[] = [];

  for (const platform of content.platforms) {
    if (!platform.enabled) continue;

    try {
      let result: DistributionResult;

      switch (platform.platform) {
        case "facebook":
          result = await distributeFacebook(content, platform.config);
          break;
        case "telegram":
          result = await distributeTelegram(content, platform.config);
          break;
        case "twitter":
          result = await distributeTwitter(content, platform.config);
          break;
        case "linkedin":
          result = await distributeLinkedIn(content, platform.config);
          break;
        case "instagram":
          result = await distributeInstagram(content, platform.config);
          break;
        default:
          result = {
            platform: platform.platform,
            success: false,
            error: "Unknown platform",
            timestamp: new Date(),
          };
      }

      results.push(result);
    } catch (error) {
      results.push({
        platform: platform.platform,
        success: false,
        error: String(error),
        timestamp: new Date(),
      });
    }
  }

  return results;
}

/**
 * Distribute to Facebook
 */
async function distributeFacebook(
  content: MultiPlatformContent,
  config: Record<string, any>
): Promise<DistributionResult> {
  const { pageId, pageAccessToken } = config;

  if (!pageId || !pageAccessToken) {
    return {
      platform: "facebook",
      success: false,
      error: "Missing Facebook credentials",
      timestamp: new Date(),
    };
  }

  const facebookOptions: FacebookPostOptions = {
    message: content.content,
    link: content.metadata?.linkUrl,
    picture: content.metadata?.imageUrl,
    caption: content.metadata?.title,
    description: content.metadata?.description,
  };

  try {
    let result;

    if (content.scheduledTime && content.scheduledTime > new Date()) {
      result = await schedulePostToFacebook(
        pageId,
        pageAccessToken,
        facebookOptions,
        content.scheduledTime
      );
    } else {
      result = await postToFacebookPage(
        pageId,
        pageAccessToken,
        facebookOptions
      );
    }

    return {
      platform: "facebook",
      success: result.success,
      postId: result.postId,
      error: result.error,
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      platform: "facebook",
      success: false,
      error: String(error),
      timestamp: new Date(),
    };
  }
}

/**
 * Distribute to Telegram
 */
async function distributeTelegram(
  content: MultiPlatformContent,
  config: Record<string, any>
): Promise<DistributionResult> {
  const { chatId } = config;

  if (!chatId) {
    return {
      platform: "telegram",
      success: false,
      error: "Missing Telegram chat ID",
      timestamp: new Date(),
    };
  }

  try {
    let message = content.content;

    if (content.metadata?.title) {
      message = `*${content.metadata.title}*\n\n${message}`;
    }

    if (content.metadata?.linkUrl) {
      message += `\n\n[Link](${content.metadata.linkUrl})`;
    }

    const success = await sendTelegramMessage(chatId, message, {
      parse_mode: "Markdown",
    });

    return {
      platform: "telegram",
      success,
      error: success ? undefined : "Failed to send Telegram message",
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      platform: "telegram",
      success: false,
      error: String(error),
      timestamp: new Date(),
    };
  }
}

/**
 * Distribute to Twitter (placeholder - requires Twitter API v2)
 */
async function distributeTwitter(
  _content: MultiPlatformContent,
  _config: Record<string, any>
): Promise<DistributionResult> {
  // Twitter integration would require Twitter API v2 setup
  // This is a placeholder for future implementation
  return {
    platform: "twitter",
    success: false,
    error: "Twitter integration not yet implemented",
    timestamp: new Date(),
  };
}

/**
 * Distribute to LinkedIn (placeholder - requires LinkedIn API)
 */
async function distributeLinkedIn(
  _content: MultiPlatformContent,
  _config: Record<string, any>
): Promise<DistributionResult> {
  // LinkedIn integration would require LinkedIn API setup
  // This is a placeholder for future implementation
  return {
    platform: "linkedin",
    success: false,
    error: "LinkedIn integration not yet implemented",
    timestamp: new Date(),
  };
}

/**
 * Distribute to Instagram (placeholder - requires Instagram API)
 */
async function distributeInstagram(
  _content: MultiPlatformContent,
  _config: Record<string, any>
): Promise<DistributionResult> {
  // Instagram integration would require Instagram API setup
  // This is a placeholder for future implementation
  return {
    platform: "instagram",
    success: false,
    error: "Instagram integration not yet implemented",
    timestamp: new Date(),
  };
}

/**
 * Get distribution status summary
 */
export function getDistributionSummary(
  results: DistributionResult[]
): {
  total: number;
  successful: number;
  failed: number;
  successRate: number;
} {
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return {
    total: results.length,
    successful,
    failed,
    successRate: results.length > 0 ? (successful / results.length) * 100 : 0,
  };
}

/**
 * Retry failed distributions
 */
export async function retryFailedDistributions(
  results: DistributionResult[],
  content: MultiPlatformContent,
  platforms: PlatformConfig[]
): Promise<DistributionResult[]> {
  const failedPlatforms = results
    .filter((r) => !r.success)
    .map((r) => r.platform);

  const retryPlatforms = platforms.filter((p) =>
    failedPlatforms.includes(p.platform)
  );

  const retryContent: MultiPlatformContent = {
    ...content,
    platforms: retryPlatforms,
  };

  return distributeContent(retryContent);
}