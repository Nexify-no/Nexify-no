/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * One gate every publish and every schedule must pass through (PR #82).
 *
 * Two things went wrong before this existed:
 *
 *  1. `publishToSpecific` — the generic publish path — resolved its provider
 *     token from `userId` alone (`publishingService.publishToSpecificPlatforms`
 *     still does). It had no idea brands existed, so a Penna post could go out
 *     through Ballong's connected LinkedIn. The brand guard lived only in
 *     `linkedin.createPost`.
 *  2. Double-submit protection depended on the CLIENT sending an
 *     `idempotencyKey`. When it didn't, two clicks meant two live posts.
 *
 * So the rules live here, server-side, and both publish paths plus scheduling
 * call them. Multi-brand OFF is unchanged: `resolvePublishBrand` returns null and
 * every check degrades to the previous account-wide behaviour.
 */

import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { posts, publications } from "../../drizzle/schema";
import { getDb } from "../db";
import {
  assertBrandOwnsConnection,
  getDestination,
  logSecurityEvent,
  type Platform,
} from "./socialDestinations";

/**
 * How long two identical publish attempts are treated as the same click.
 *
 * Long enough to cover a double-click, a stuck spinner and an impatient retry;
 * short enough that deliberately re-publishing the same post later still works.
 */
export const DUPLICATE_WINDOW_MS = 60_000;

/**
 * A stable key for a publish with no saved post: platform + a hash of the exact
 * text. Two clicks send identical content, so they collide; a genuinely
 * different ad-hoc post does not.
 */
export function adHocKey(platform: Platform, content: string): string {
  const normalised = content.replace(/\s+/g, " ").trim();
  let h = 0;
  for (let i = 0; i < normalised.length; i++) {
    h = (Math.imul(31, h) + normalised.charCodeAt(i)) | 0;
  }
  return `adhoc-${platform}-${(h >>> 0).toString(36)}`;
}

export type PublishDestination = {
  id: number;
  brandId: number | null;
  destinationId: string | null;
  destinationName: string | null;
  /** Drives the provider target (person vs Company Page vs FB Page). */
  destinationType: string | null;
};

/**
 * The brand this publish belongs to, or null when multi-brand is off.
 *
 * The POST's own brand always wins. Falling back to "whatever brand is active
 * right now" is how a post written for one brand goes out as another: the user
 * switches brand in another tab, then clicks publish on a list that was rendered
 * before the switch.
 */
export async function resolvePublishBrand(
  accountId: number,
  postId?: number | null,
): Promise<number | null> {
  const { ENV } = await import("../_core/env");
  if (!ENV.featureMultiBrand) return null;

  const db = await getDb();
  if (db && postId) {
    const [owned] = await db
      .select({ brandId: posts.brandId })
      .from(posts)
      .where(and(eq(posts.id, postId), eq(posts.userId, accountId)))
      .limit(1);
    if (!owned) throw new Error("Innlegget finnes ikke.");
    if (owned.brandId != null) return owned.brandId;
  }

  const { getActiveBrandId } = await import("./brands");
  return getActiveBrandId(accountId);
}

/**
 * The destination this brand publishes to on `platform`, or a refusal.
 *
 * Refusing when nothing is connected is the point: `publishToSpecificPlatforms`
 * would otherwise pick up ANY token the account owns, so an unconnected brand
 * silently published through a sibling brand's account.
 */
export async function requireDestination(
  accountId: number,
  brandId: number | null,
  platform: Platform,
  postId?: number | null,
): Promise<PublishDestination | null> {
  // Multi-brand off: destinations are not modelled per brand, keep old behaviour.
  if (brandId == null) return null;

  const destination = await getDestination(accountId, brandId, platform);
  if (!destination) {
    throw new Error(
      `Ingen ${platform}-konto er koblet til denne merkevaren. Koble til en konto først.`,
    );
  }
  // Belt and braces: getDestination already filters by brand, but this is the
  // check that logs a security event if the two ever disagree.
  assertBrandOwnsConnection({
    accountId,
    postBrandId: brandId,
    connectionBrandId: destination.brandId,
    platform,
    postId: postId ?? undefined,
  });
  return {
    id: destination.id,
    brandId: destination.brandId,
    destinationId: destination.destinationId,
    destinationName: destination.destinationName,
    destinationType: destination.destinationType,
  };
}

/**
 * Refuse to publish an unverifiable claim (PR #83).
 *
 * `high_risk` means an undocumented customer story, an undocumented price, or an
 * unprovable superlative — the three things that turn a marketing post into a
 * statement the business cannot stand behind. Approval already blocks these
 * inside a plan, but publishing a SAVED post had no such check, so the claim only
 * had to survive one hop into "Mine innlegg".
 *
 * Re-checked live against the account's current Merkehjerne, which is what makes
 * the fix work both ways: delete the claim, or add it as a sourced fact, and the
 * post becomes publishable without anyone clearing a flag by hand.
 */
export async function assertContentIsPublishable(input: {
  accountId: number;
  postId?: number | null;
  content: string;
  /**
   * The brand this publish belongs to — from resolvePublishBrand, which every
   * caller already computes. Never the active brand: see brandFactsForUser.
   */
  brandId?: number | null;
}): Promise<void> {
  try {
    const { brandFactsForUser, reverifyPost } = await import("./verification/reverify");
    const brand = await brandFactsForUser(input.accountId, input.brandId);
    // No Merkehjerne at all means nothing to check against — that is the
    // pre-brand state, and blocking every publish for it would be wrong. Logged,
    // because "skipped" and "passed" look identical from the outside and this is
    // the difference between a guard and a no-op.
    if (!brand) {
      logSecurityEvent("publish_verification_skipped", {
        accountId: input.accountId,
        postId: input.postId ?? -1,
        reason: "no_brand_profile",
      });
      return;
    }

    const verdict = input.postId
      ? await reverifyPost({
          postId: input.postId,
          userId: input.accountId,
          content: input.content,
          brand,
          persist: true,
        })
      : await reverifyPost({
          postId: 0,
          userId: input.accountId,
          content: input.content,
          brand,
          persist: false,
        });

    if (verdict?.status === "high_risk") {
      const why = verdict.issues.map((i) => i.message).slice(0, 3).join(" ");
      logSecurityEvent("high_risk_publish_blocked", {
        accountId: input.accountId,
        postId: input.postId ?? -1,
        codes: verdict.issues.map((i) => i.code).join(","),
      });
      throw new PublishBlockedError(
        why || "Innlegget inneholder en påstand som ikke kan dokumenteres. Fjern den, eller legg den til som et faktum med kilde i Merkehjernen.",
      );
    }
  } catch (e) {
    // A genuine block must propagate; anything else must not stop a publish.
    if (e instanceof PublishBlockedError) throw e;
    console.warn("[publishGuard] verification check skipped:", (e as Error)?.message);
  }
}

/** Distinguishes a deliberate refusal from an incidental failure. */
export class PublishBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishBlockedError";
  }
}

/**
 * Refuse a repeat of the same publish.
 *
 * Independent of any client-supplied key, because the key was optional and the
 * unprotected path is exactly the one a double-click takes. A `pending` row
 * counts: that is an attempt still in flight, and letting a second one past is
 * how one click became two live posts.
 */
export async function assertNotDuplicatePublish(
  accountId: number,
  postId: number | null | undefined,
  platform: Platform,
  /**
   * The content being published. Required to protect an AD-HOC publish (no saved
   * post): the "Publiser til LinkedIn" button on an unsaved draft has no postId,
   * so keying on postId alone left the most double-clickable button in the app
   * completely unprotected.
   */
  content?: string | null,
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const identity = postId
    ? eq(publications.postId, postId)
    : content?.trim()
      ? eq(publications.idempotencyKey, adHocKey(platform, content))
      : null;
  // Nothing to identify this attempt by — do not silently allow a repeat, but
  // there is genuinely no key to compare against.
  if (!identity) return;

  const [recent] = await db
    .select({ id: publications.id, status: publications.status, createdAt: publications.createdAt })
    .from(publications)
    .where(and(
      eq(publications.accountId, accountId),
      identity,
      eq(publications.platform, platform),
      inArray(publications.status, ["pending", "published"]),
      gte(publications.createdAt, new Date(Date.now() - DUPLICATE_WINDOW_MS)),
    ))
    .orderBy(desc(publications.id))
    .limit(1);

  if (recent) {
    logSecurityEvent("duplicate_publish_blocked", {
      accountId,
      platform,
      postId: postId ?? -1,
      priorStatus: recent.status,
    });
    throw new Error(
      recent.status === "pending"
        ? "Publiseringen er allerede i gang. Vent litt før du prøver igjen."
        : "Dette innlegget er allerede publisert.",
    );
  }
}

/**
 * Record the attempt BEFORE contacting the provider, so a crash mid-publish
 * leaves a `pending` trail rather than nothing. Returns the row id to close.
 *
 * `idempotencyKey` still gets its unique-index protection when supplied; the
 * server generates one otherwise so every attempt is auditable.
 */
export async function claimPublication(input: {
  accountId: number;
  brandId: number | null;
  postId: number | null | undefined;
  platform: Platform;
  destination: PublishDestination | null;
  idempotencyKey?: string | null;
  /** Used to derive a stable key when there is no saved post. */
  content?: string | null;
}): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  // A server key must be DETERMINISTIC for the same attempt, or the unique index
  // never fires and assertNotDuplicatePublish is the only protection left. For a
  // saved post that is (post, platform, minute); for an ad-hoc publish it is the
  // content hash, which is the only identity such a publish has.
  const bucket = Math.floor(Date.now() / DUPLICATE_WINDOW_MS);
  const key = input.idempotencyKey?.trim()
    || (input.postId
      ? `srv-${input.postId}-${input.platform}-${bucket}`
      : input.content?.trim()
        ? adHocKey(input.platform, input.content)
        : `srv-adhoc-${input.platform}-${bucket}`);

  const finalKey = key.slice(0, 64);
  try {
    const [inserted] = await db.insert(publications).values({
      accountId: input.accountId,
      brandId: input.brandId,
      postId: input.postId ?? 0,
      connectionId: input.destination?.id ?? null,
      platform: input.platform,
      destinationId: input.destination?.destinationId ?? null,
      destinationName: input.destination?.destinationName ?? null,
      idempotencyKey: finalKey,
      status: "pending",
    }).$returningId();
    return inserted?.id ?? null;
  } catch {
    // UNIQUE(account_id, idempotency_key) collided. That is USUALLY a duplicate —
    // but the server key is (post, platform, 60s bucket), so retrying a FAILED
    // publish inside the same minute collided too and told the user "Dette
    // innlegget er allerede publisert." about a post that never went out. Their
    // only recovery from a failure is to press the button again.
    //
    // assertNotDuplicatePublish has already refused any pending or published
    // attempt before we get here, so a row we find now can only be a failed one:
    // reuse it.
    const [prior] = await db
      .select({ id: publications.id, status: publications.status })
      .from(publications)
      .where(and(
        eq(publications.accountId, input.accountId),
        eq(publications.idempotencyKey, finalKey),
      ))
      .limit(1);
    if (prior && prior.status === "failed") {
      await db
        .update(publications)
        .set({ status: "pending", errorMessage: null })
        .where(eq(publications.id, prior.id));
      return prior.id;
    }
    throw new Error("Dette innlegget er allerede publisert.");
  }
}

/** Close a claimed publication with the provider's answer. Never throws. */
export async function settlePublication(
  publicationId: number | null,
  outcome:
    | { status: "published"; providerPostId?: string | null; providerResponse?: unknown; postId?: number | null }
    | { status: "failed"; errorMessage: string },
): Promise<void> {
  if (publicationId == null) return;
  const db = await getDb();
  if (!db) return;
  try {
    if (outcome.status === "published") {
      await db.update(publications).set({
        status: "published",
        providerPostId: outcome.providerPostId ?? null,
        providerResponse: JSON.stringify(outcome.providerResponse ?? {}).slice(0, 2_000),
        publishedAt: new Date(),
        ...(outcome.postId ? { postId: outcome.postId } : {}),
      }).where(eq(publications.id, publicationId));
    } else {
      await db.update(publications).set({
        status: "failed",
        errorMessage: outcome.errorMessage.slice(0, 500),
      }).where(eq(publications.id, publicationId));
    }
  } catch (e) {
    console.warn("[publishGuard] could not settle publication:", (e as Error)?.message);
  }
}
