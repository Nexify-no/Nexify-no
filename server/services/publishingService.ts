/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { platformManager } from "./platformOAuthService";

export interface PublishContent {
  title?: string;
  content: string;
  imageUrl?: string;
  hashtags?: string[];
  link?: string;
}

export interface PublishResult {
  platform: string;
  success: boolean;
  postId?: string;
  error?: string;
  timestamp: Date;
}

// LinkedIn Publishing
export class LinkedInPublisher {
  async publish(accessToken: string, content: PublishContent): Promise<PublishResult> {
    try {
      const postContent = this.formatContent(content);

      const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "LinkedIn-Version": "202401",
        },
        body: JSON.stringify({
          author: "urn:li:person:me",
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: {
                text: postContent,
              },
              shareMediaCategory: "NONE",
            },
          },
          visibility: {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LinkedIn API error: ${error}`);
      }

      const data = await response.json() as { id: string };
      return {
        platform: "linkedin",
        success: true,
        postId: data.id,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        platform: "linkedin",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    }
  }

  private formatContent(content: PublishContent): string {
    let text = content.content;
    if (content.hashtags && content.hashtags.length > 0) {
      text += "\n\n" + content.hashtags.map((tag) => `#${tag}`).join(" ");
    }
    if (content.link) {
      text += `\n\n${content.link}`;
    }
    return text;
  }
}

// Twitter/X Publishing
export class TwitterPublisher {
  async publish(accessToken: string, content: PublishContent): Promise<PublishResult> {
    try {
      const postContent = this.formatContent(content);

      const response = await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: postContent,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Twitter API error: ${error}`);
      }

      const data = await response.json() as { data: { id: string } };
      return {
        platform: "twitter",
        success: true,
        postId: data.data.id,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        platform: "twitter",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    }
  }

  private formatContent(content: PublishContent): string {
    let text = content.content;
    if (content.hashtags && content.hashtags.length > 0) {
      text += " " + content.hashtags.map((tag) => `#${tag}`).join(" ");
    }
    // Twitter has 280 character limit
    if (text.length > 280) {
      text = text.substring(0, 277) + "...";
    }
    return text;
  }
}

// Instagram Publishing (via Facebook Graph API)
export class InstagramPublisher {
  async publish(accessToken: string, content: PublishContent): Promise<PublishResult> {
    try {
      // First, get the Instagram Business Account ID
      const accountResponse = await fetch(
        `https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`
      );

      if (!accountResponse.ok) {
        throw new Error("Failed to get Instagram account");
      }

      const accountData = await accountResponse.json() as { id: string };
      const instagramAccountId = accountData.id;

      // Create a media container
      const postContent = this.formatContent(content);
      const containerResponse = await fetch(
        `https://graph.instagram.com/${instagramAccountId}/media?access_token=${accessToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: content.imageUrl,
            caption: postContent,
          }),
        }
      );

      if (!containerResponse.ok) {
        throw new Error("Failed to create Instagram media");
      }

      const containerData = await containerResponse.json() as { id: string };
      const mediaId = containerData.id;

      // Publish the media
      const publishResponse = await fetch(
        `https://graph.instagram.com/${instagramAccountId}/media_publish?access_token=${accessToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creation_id: mediaId,
          }),
        }
      );

      if (!publishResponse.ok) {
        throw new Error("Failed to publish Instagram media");
      }

      const publishData = await publishResponse.json() as { id: string };
      return {
        platform: "instagram",
        success: true,
        postId: publishData.id,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        platform: "instagram",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    }
  }

  private formatContent(content: PublishContent): string {
    let text = content.content;
    if (content.hashtags && content.hashtags.length > 0) {
      text += "\n\n" + content.hashtags.map((tag) => `#${tag}`).join(" ");
    }
    return text;
  }
}

// Facebook Publishing
export class FacebookPublisher {
  async publish(accessToken: string, content: PublishContent): Promise<PublishResult> {
    try {
      // Get user's pages
      const pagesResponse = await fetch(
        `https://graph.facebook.com/me/accounts?access_token=${accessToken}`
      );

      if (!pagesResponse.ok) {
        throw new Error("Failed to get Facebook pages");
      }

      const pagesData = await pagesResponse.json() as { data: Array<{ id: string }> };
      if (!pagesData.data || pagesData.data.length === 0) {
        throw new Error("No Facebook pages found");
      }

      const pageId = pagesData.data[0].id;
      const postContent = this.formatContent(content);

      // Post to the page
      const postResponse = await fetch(
        `https://graph.facebook.com/${pageId}/feed?access_token=${accessToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: postContent,
            link: content.link,
          }),
        }
      );

      if (!postResponse.ok) {
        throw new Error("Failed to post to Facebook");
      }

      const postData = await postResponse.json() as { id: string };
      return {
        platform: "facebook",
        success: true,
        postId: postData.id,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        platform: "facebook",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    }
  }

  private formatContent(content: PublishContent): string {
    let text = content.content;
    if (content.hashtags && content.hashtags.length > 0) {
      text += "\n\n" + content.hashtags.map((tag) => `#${tag}`).join(" ");
    }
    return text;
  }
}

// Publishing Manager
export class PublishingManager {
  private linkedinPublisher = new LinkedInPublisher();
  private twitterPublisher = new TwitterPublisher();
  private instagramPublisher = new InstagramPublisher();
  private facebookPublisher = new FacebookPublisher();

  async publishToAllConnectedPlatforms(
    userId: number,
    content: PublishContent
  ): Promise<PublishResult[]> {
    const platforms = await platformManager.getUserPlatforms(userId);
    const results: PublishResult[] = [];

    for (const platform of platforms) {
      const token = await platformManager.getPlatformToken(userId, platform);
      if (!token) continue;

      let result: PublishResult;
      switch (platform) {
        case "linkedin":
          result = await this.linkedinPublisher.publish(token.accessToken, content);
          break;
        case "twitter":
          result = await this.twitterPublisher.publish(token.accessToken, content);
          break;
        case "instagram":
          result = await this.instagramPublisher.publish(token.accessToken, content);
          break;
        case "facebook":
          result = await this.facebookPublisher.publish(token.accessToken, content);
          break;
        default:
          result = {
            platform,
            success: false,
            error: "Unknown platform",
            timestamp: new Date(),
          };
      }

      results.push(result);
    }

    return results;
  }

  async publishToSpecificPlatforms(
    userId: number,
    platforms: string[],
    content: PublishContent
  ): Promise<PublishResult[]> {
    const results: PublishResult[] = [];

    for (const platform of platforms) {
      const token = await platformManager.getPlatformToken(userId, platform);
      if (!token) {
        results.push({
          platform,
          success: false,
          error: "Platform not connected",
          timestamp: new Date(),
        });
        continue;
      }

      let result: PublishResult;
      switch (platform) {
        case "linkedin":
          result = await this.linkedinPublisher.publish(token.accessToken, content);
          break;
        case "twitter":
          result = await this.twitterPublisher.publish(token.accessToken, content);
          break;
        case "instagram":
          result = await this.instagramPublisher.publish(token.accessToken, content);
          break;
        case "facebook":
          result = await this.facebookPublisher.publish(token.accessToken, content);
          break;
        default:
          result = {
            platform,
            success: false,
            error: "Unknown platform",
            timestamp: new Date(),
          };
      }

      results.push(result);
    }

    return results;
  }
}

export const publishingManager = new PublishingManager();