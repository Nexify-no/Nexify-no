/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { platformManager } from "./platformOAuthService";
import { graphPost, graphUrl, graphFetch, isPubliclyFetchableImage } from "./metaGraph";

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
  /**
   * Whether the post's image actually made it onto the platform.
   *
   * Distinct from `success` on purpose: a post can publish fine and still lose
   * its picture, which is exactly the failure that went unnoticed on Facebook for
   * the life of the feature. `undefined` means the platform has no image concept
   * on this path; `false` means there WAS an image and it did not go.
   */
  imageAttached?: boolean;
  timestamp: Date;
}

// LinkedIn Publishing
export class LinkedInPublisher {
  async publish(accessToken: string, content: PublishContent, authorUrn?: string | null): Promise<PublishResult> {
    try {
      const postContent = this.formatContent(content);

      // Delegate to the canonical Posts API implementation (/rest/posts). When an
      // explicit author is supplied (a Company Page urn:li:organization:xxx) we post
      // as that Page; otherwise resolve the member's own URN via OpenID.
      const { getLinkedInProfile, createLinkedInPost } = await import("../linkedinService");
      let author = authorUrn || null;
      if (!author) {
        const profile = await getLinkedInProfile(accessToken);
        author = `urn:li:person:${profile.sub}`;
      }
      const result = await createLinkedInPost(accessToken, "", postContent, author, content.imageUrl);

      return {
        platform: "linkedin",
        success: true,
        postId: result.id,
        imageAttached: result.imageAttached,
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

      const response = await fetch("https://api.x.com/2/tweets", {
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
        throw new Error(`X API error: ${error}`);
      }

      const data = await response.json() as { data: { id: string } };
      return {
        platform: "twitter",
        success: true,
        postId: data.data.id,
        // Deliberately `false`, not `undefined`, when the post carried an image.
        //
        // Attaching media to a post on X is a separate upload (POST media/upload
        // → media_ids) that this publisher does not yet do, so the image is
        // dropped. `undefined` means "this platform has no image concept" per the
        // PublishResult contract above — claiming that here would make the
        // scheduler's image-loss warning silently inert and let the product tell
        // a user their picture went out when it did not.
        imageAttached: content.imageUrl ? false : undefined,
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
    const parts = [content.content];
    if (content.hashtags && content.hashtags.length > 0) {
      parts.push(content.hashtags.map((tag) => `#${tag}`).join(" "));
    }
    // The link was dropped entirely — LinkedInPublisher appends it, this did not,
    // so "read more at …" posts went out with nothing to read.
    if (content.link) parts.push(content.link);
    const text = parts.join(" ");

    return text.length > X_MAX_WEIGHTED_LENGTH ? truncateForX(text) : text;
  }
}

/** X counts weighted characters, not JS string length. */
const X_MAX_WEIGHTED_LENGTH = 280;

/**
 * Truncate to X's limit without splitting a character in half.
 *
 * `text.substring(0, 277)` — the previous implementation — indexes UTF-16 code
 * units, so a cut landing inside a surrogate pair produced a lone surrogate and
 * X rejected the whole post with an opaque 400. Splitting by code point and
 * trimming back to a word boundary keeps the result both valid and readable.
 *
 * This is still an approximation of X's weighted count (a URL always counts as
 * 23, most emoji as 2), so it can leave a post shorter than strictly necessary.
 * Erring short is the right direction: too long is a rejection, too short is a
 * slightly tighter post.
 */
function truncateForX(text: string): string {
  const ELLIPSIS = "…";
  const budget = X_MAX_WEIGHTED_LENGTH - ELLIPSIS.length;
  const codePoints = Array.from(text);
  if (codePoints.length <= X_MAX_WEIGHTED_LENGTH) return text;

  let cut = codePoints.slice(0, budget).join("");
  const lastSpace = cut.lastIndexOf(" ");
  // Only snap to a word boundary when one is reasonably near the end; otherwise
  // a single long token would shrink the post to almost nothing.
  if (lastSpace > budget * 0.8) cut = cut.slice(0, lastSpace);
  return cut.trimEnd() + ELLIPSIS;
}

/**
 * Instagram publishing, through the Facebook Graph Content Publishing API.
 *
 * The previous implementation talked to `graph.instagram.com` and asked `/me` for
 * an account id. That is the Basic Display surface: it can read a profile and it
 * cannot publish anything, so every Instagram post this app "published" was a
 * request that could not have succeeded. Publishing goes through
 * graph.facebook.com against the Instagram PROFESSIONAL account id linked to a
 * Facebook Page, using that Page's token — which is what the connect flow stores.
 *
 * The API is two calls, not one: create a media container, then publish it.
 */
export class InstagramPublisher {
  async publish(
    accessToken: string,
    content: PublishContent,
    instagramAccountId?: string,
  ): Promise<PublishResult> {
    try {
      if (!instagramAccountId) {
        throw new Error(
          "Ingen Instagram-konto er koblet til. Koble en Instagram Professional-konto til Facebook-siden din.",
        );
      }

      // Instagram has no text-only post. Saying so plainly beats letting Graph
      // reject it with "media_type is required", and beats the old behaviour of
      // publishing nothing while reporting success.
      if (!isPubliclyFetchableImage(content.imageUrl)) {
        throw new Error(
          "Instagram krever et bilde. Legg til et bilde i innlegget før du publiserer til Instagram.",
        );
      }

      const container = await graphPost<{ id?: string }>(
        "Instagram-media",
        `${instagramAccountId}/media`,
        {
          image_url: content.imageUrl,
          caption: this.formatContent(content),
          access_token: accessToken,
        },
      );
      if (!container.id) throw new Error("Instagram-media: ingen container-id returnert");

      // Wait for Graph to finish downloading the image.
      //
      // `/media` returns a container id immediately while the download is still
      // IN_PROGRESS, and publishing an unfinished container fails with "Media ID
      // is not available". A small warm CDN image usually wins the race, which is
      // exactly why this is easy to omit and then fails only on the large or slow
      // images — in the scheduler, unattended, as a permanent `failed` row for a
      // post that would have succeeded a second later.
      await this.awaitContainerReady(container.id, accessToken);

      const published = await graphPost<{ id?: string }>(
        "Instagram-publisering",
        `${instagramAccountId}/media_publish`,
        {
          creation_id: container.id,
          access_token: accessToken,
        },
      );

      return {
        platform: "instagram",
        success: true,
        postId: published.id ?? "",
        imageAttached: true,
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

  /**
   * Poll the container until Graph reports FINISHED.
   *
   * Bounded on purpose: this runs inside the publish path, and a container that
   * is still IN_PROGRESS after ~15s is far more likely to be a broken image URL
   * than a slow one. Failing with the last known status beats blocking a cron
   * tick indefinitely, and beats calling media_publish on a container that will
   * reject it.
   */
  private async awaitContainerReady(
    containerId: string,
    accessToken: string,
    attempts = 6,
    delayMs = 2500,
  ): Promise<void> {
    let lastStatus = "UNKNOWN";
    for (let i = 0; i < attempts; i++) {
      const status = await graphFetch<{ status_code?: string; status?: string }>(
        "Instagram-status",
        graphUrl(containerId, { fields: "status_code,status", access_token: accessToken }),
      );
      lastStatus = status.status_code ?? "UNKNOWN";
      if (lastStatus === "FINISHED") return;
      if (lastStatus === "ERROR" || lastStatus === "EXPIRED") {
        throw new Error(`Instagram kunne ikke hente bildet (${status.status ?? lastStatus}).`);
      }
      // No sleep after the final check — it would only delay the error.
      if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new Error(
      `Instagram rakk ikke å behandle bildet i tide (status ${lastStatus}). Prøv et mindre bilde.`,
    );
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
  async publish(accessToken: string, content: PublishContent, pageId?: string): Promise<PublishResult> {
    try {
      let targetPageId = pageId;

      if (!targetPageId) {
        // Legacy fallback: older connections stored a USER token without a page id.
        // New connections store a PAGE token + accountId, skipping this lookup.
        const pagesData = await graphFetch<{ data?: Array<{ id: string }> }>(
          "Facebook-sider",
          graphUrl("me/accounts", { access_token: accessToken }),
        );
        if (!pagesData.data || pagesData.data.length === 0) {
          throw new Error("Ingen Facebook-side funnet (du må være administrator for en side).");
        }
        targetPageId = pagesData.data[0].id;
      }

      const postContent = this.formatContent(content);

      // ── The image ────────────────────────────────────────────────────────
      //
      // This method used to accept `content.imageUrl` and never read it. Every
      // Facebook post the product has ever made came out as text, on every path,
      // while the preview in the app showed the picture — because /feed has no
      // parameter that attaches a photo. A photo post is a different endpoint.
      //
      // `/{page-id}/photos` with `url` has Graph fetch the image itself, so the
      // URL must be publicly reachable; `caption` carries the text, and the
      // result is one photo post rather than a text post with a link preview.
      //
      // A link and an image are mutually exclusive on this API. When the post has
      // both, the link wins: a link post renders its own preview image anyway, and
      // silently dropping the user's link would lose the thing they were posting
      // FOR.
      const wantsImage = isPubliclyFetchableImage(content.imageUrl) && !content.link;

      if (wantsImage) {
        const photo = await graphPost<{ id?: string; post_id?: string }>(
          "Facebook-bilde",
          `${targetPageId}/photos`,
          {
            url: content.imageUrl as string,
            caption: postContent,
            published: "true",
            access_token: accessToken,
          },
        );
        return {
          platform: "facebook",
          success: true,
          // `post_id` is the feed story (page_id_post_id) that engagement metrics
          // key off; `id` is only the photo object. Preferring the photo id here
          // would silently exclude every image post from analytics.
          postId: photo.post_id ?? photo.id ?? "",
          imageAttached: true,
          timestamp: new Date(),
        };
      }

      const postData = await graphPost<{ id?: string }>(
        "Facebook",
        `${targetPageId}/feed`,
        {
          message: postContent,
          ...(content.link ? { link: content.link } : {}),
          access_token: accessToken,
        },
      );

      return {
        platform: "facebook",
        success: true,
        postId: postData.id ?? "",
        // `false` only when there WAS an image and it did not go — which is the
        // contract the field documents. A plain text post has no image to report
        // on, so it reports `undefined`; returning `false` there would train
        // every caller to ignore the flag.
        imageAttached: content.imageUrl ? false : undefined,
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
        case "linkedin": {
          const author =
            token.publishTarget === "organization" && token.organizationUrn
              ? token.organizationUrn
              : token.personUrn
                ? (token.personUrn.startsWith("urn:li:") ? token.personUrn : `urn:li:person:${token.personUrn}`)
                : null;
          result = await this.linkedinPublisher.publish(token.accessToken, content, author);
          break;
        }
        case "twitter":
          result = await this.twitterPublisher.publish(token.accessToken, content);
          break;
        case "instagram": {
          // The IG Professional account id, not the Page id. It is stored as the
          // instagram row's accountId when the Page is connected; without it the
          // publisher has nothing to post to.
          const conn = await platformManager.getPlatformConnection(userId, "instagram");
          result = await this.instagramPublisher.publish(token.accessToken, content, conn?.accountId ?? undefined);
          break;
        }
        case "facebook": {
          const conn = await platformManager.getPlatformConnection(userId, "facebook");
          result = await this.facebookPublisher.publish(token.accessToken, content, conn?.accountId ?? undefined);
          break;
        }
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

  /**
   * PR #82: `destinations` says WHERE each platform must publish, per brand.
   *
   * Without it this method derived the LinkedIn author from the account-wide
   * `linkedin_connections` row, so validating the brand's destination upstream
   * was cosmetic — the post still went wherever that single row pointed. An
   * account whose provider row had been switched to another brand's Company Page
   * published one brand's content into the other brand's feed, while the audit
   * row recorded a correct-looking destination.
   */
  async publishToSpecificPlatforms(
    userId: number,
    platforms: string[],
    content: PublishContent,
    destinations?: Map<string, { destinationId: string | null; destinationType: string | null }>,
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
        case "linkedin": {
          // The brand's destination wins. The account-wide row is only the
          // fallback for multi-brand-off installs.
          const wanted = destinations?.get(platform);
          const author = wanted?.destinationId
            ? (wanted.destinationId.startsWith("urn:li:")
                ? wanted.destinationId
                : `urn:li:${wanted.destinationType === "organization" ? "organization" : "person"}:${wanted.destinationId}`)
            : token.publishTarget === "organization" && token.organizationUrn
              ? token.organizationUrn
              : token.personUrn
                ? (token.personUrn.startsWith("urn:li:") ? token.personUrn : `urn:li:person:${token.personUrn}`)
                : null;
          result = await this.linkedinPublisher.publish(token.accessToken, content, author);
          break;
        }
        case "twitter":
          result = await this.twitterPublisher.publish(token.accessToken, content);
          break;
        case "instagram": {
          const wanted = destinations?.get(platform);
          const conn = await platformManager.getPlatformConnection(userId, "instagram");
          result = await this.instagramPublisher.publish(
            token.accessToken,
            content,
            wanted?.destinationId ?? conn?.accountId ?? undefined,
          );
          break;
        }
        case "facebook": {
          const wanted = destinations?.get(platform);
          const conn = await platformManager.getPlatformConnection(userId, "facebook");
          result = await this.facebookPublisher.publish(
            token.accessToken,
            content,
            wanted?.destinationId ?? conn?.accountId ?? undefined,
          );
          break;
        }
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
