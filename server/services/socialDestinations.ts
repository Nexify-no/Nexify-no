/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * Per-brand publish destinations (MB2).
 *
 * Hard rule: a post may only be published through a connection that belongs to
 * the SAME brand. `assertBrandOwnsConnection` enforces it and logs a security
 * event on mismatch — never publish across brands.
 *
 * Legacy adoption is conservative: an existing LinkedIn connection is mapped to
 * a brand only when the account has exactly ONE brand. Otherwise the row is
 * created with status `needs_brand_assignment` so the user assigns it — we never
 * guess that e.g. a Ballong account, a Penna page and a Nexify LinkedIn belong
 * to the same brand.
 */

import { and, eq } from "drizzle-orm";
import {
  brandSocialConnections,
  linkedinConnections,
  type BrandSocialConnection,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { listBrands } from "./brands";

export type Platform = "linkedin" | "facebook" | "instagram" | "twitter";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

/** Structured, PII-free security log for cross-brand publish attempts. */
export function logSecurityEvent(event: string, props: Record<string, number | string | boolean>): void {
  try {
    console.error("[security]", JSON.stringify({ evt: event, ...props }));
  } catch {
    /* logging must never break the request */
  }
}

/**
 * Reconcile the account's provider connections into brand_social_connections.
 *
 * PR #82 rewrote this. It used to (a) mirror ONLY LinkedIn and (b) return the
 * moment any linkedin row existed, so the mirror was written once and never
 * corrected. Two consequences, both shipped:
 *
 *  - Facebook, Instagram and X had no mirror row at all. Once publishing started
 *    requiring a destination, every one of them became permanently unpublishable
 *    for accounts that had them connected and working.
 *  - Disconnecting LinkedIn deleted `linkedin_connections` but left the mirror
 *    row `active`. The Kanaler page kept saying "Tilkoblet", scheduling kept
 *    succeeding, and the failure surfaced hours later in the worker — exactly
 *    what per-brand destinations are supposed to prevent.
 *
 * So: mirror every platform, and REFRESH the destination each run so the mirror
 * follows the provider row instead of freezing at first sight. A row whose
 * provider connection has disappeared is marked `revoked`, never left active.
 */
export async function syncConnectionsForAccount(accountId: number): Promise<void> {
  const db = await requireDb();
  const brands = await listBrands(accountId);
  const soleBrandId = brands.length === 1 ? brands[0].id : null;

  const { platformIntegrations } = await import("../../drizzle/schema");

  /** What the provider tables currently say, per platform. */
  const live = new Map<Platform, {
    providerConnectionId: number;
    destinationId: string | null;
    destinationName: string | null;
    destinationType: "person" | "organization" | "page" | "account";
    tokenExpiresAt: Date | null;
  }>();

  // LinkedIn lives in its own store (the "Koble til LinkedIn" flow).
  const [li] = await db
    .select()
    .from(linkedinConnections)
    .where(eq(linkedinConnections.userId, accountId))
    .limit(1);
  if (li) {
    const toOrg = li.publishTarget === "organization" && !!li.organizationUrn;
    live.set("linkedin", {
      providerConnectionId: li.id,
      destinationId: toOrg ? li.organizationUrn : li.personUrn,
      destinationName: toOrg ? li.organizationName : li.profileName,
      destinationType: toOrg ? "organization" : "person",
      tokenExpiresAt: li.expiresAt ?? null,
    });
  }

  // Everything else comes through the generic integrations table.
  const integrations = await db
    .select()
    .from(platformIntegrations)
    .where(eq(platformIntegrations.userId, accountId));
  for (const row of integrations) {
    const platform = row.platform as Platform;
    if (platform === "linkedin" && live.has("linkedin")) continue; // dedicated store wins
    live.set(platform, {
      providerConnectionId: row.id,
      destinationId: row.accountId ?? null,
      destinationName: row.accountName ?? null,
      destinationType: platform === "facebook" || platform === "instagram" ? "page" : "account",
      tokenExpiresAt: row.expiresAt ?? null,
    });
  }

  const mirrored = await db
    .select()
    .from(brandSocialConnections)
    .where(eq(brandSocialConnections.accountId, accountId));

  for (const [platform, current] of live) {
    const existing = mirrored.find((m) => m.platform === platform);
    if (!existing) {
      await db.insert(brandSocialConnections).values({
        accountId,
        // Only adopt automatically when the mapping is unambiguous. With several
        // brands the user decides — we never guess that a Ballong account, a
        // Penna page and a Nexify LinkedIn belong to the same brand.
        brandId: soleBrandId,
        platform,
        providerConnectionId: current.providerConnectionId,
        destinationId: current.destinationId,
        destinationName: current.destinationName,
        destinationType: current.destinationType,
        status: soleBrandId ? "active" : "needs_brand_assignment",
        tokenExpiresAt: current.tokenExpiresAt,
      });
      continue;
    }

    // Follow the provider row. The brand assignment is the user's decision and
    // is never overwritten here; everything else is provider truth.
    const drifted =
      existing.providerConnectionId !== current.providerConnectionId ||
      existing.destinationId !== current.destinationId ||
      existing.destinationName !== current.destinationName ||
      existing.destinationType !== current.destinationType ||
      (existing.status === "revoked" && existing.brandId != null);
    if (drifted) {
      await db
        .update(brandSocialConnections)
        .set({
          providerConnectionId: current.providerConnectionId,
          destinationId: current.destinationId,
          destinationName: current.destinationName,
          destinationType: current.destinationType,
          tokenExpiresAt: current.tokenExpiresAt,
          status: existing.brandId != null ? "active" : "needs_brand_assignment",
        })
        .where(and(
          eq(brandSocialConnections.id, existing.id),
          eq(brandSocialConnections.accountId, accountId),
        ));
    }
  }

  // A mirror row whose provider connection is gone must stop claiming to work.
  for (const m of mirrored) {
    if (live.has(m.platform as Platform) || m.status === "revoked") continue;
    await db
      .update(brandSocialConnections)
      .set({ status: "revoked" })
      .where(and(
        eq(brandSocialConnections.id, m.id),
        eq(brandSocialConnections.accountId, accountId),
      ));
  }
}

/** Connections for one brand (after syncing legacy rows). */
export async function listBrandConnections(accountId: number, brandId: number): Promise<BrandSocialConnection[]> {
  await syncConnectionsForAccount(accountId);
  const db = await requireDb();
  return db
    .select()
    .from(brandSocialConnections)
    .where(and(eq(brandSocialConnections.accountId, accountId), eq(brandSocialConnections.brandId, brandId)));
}

/** The active destination for (brand, platform), or null when not connected. */
export async function getDestination(
  accountId: number,
  brandId: number,
  platform: Platform,
): Promise<BrandSocialConnection | null> {
  const rows = await listBrandConnections(accountId, brandId);
  return rows.find((r) => r.platform === platform && r.status === "active") ?? null;
}

/**
 * MANDATORY publish guard: post.brand_id must equal connection.brand_id.
 * Throws (and logs a security event) on any mismatch.
 */
export function assertBrandOwnsConnection(input: {
  accountId: number;
  postBrandId: number | null;
  connectionBrandId: number | null;
  platform: Platform;
  postId?: number;
}): void {
  const { accountId, postBrandId, connectionBrandId, platform, postId } = input;
  if (postBrandId != null && connectionBrandId != null && postBrandId === connectionBrandId) return;
  logSecurityEvent("cross_brand_publish_blocked", {
    accountId,
    platform,
    postBrandId: postBrandId ?? -1,
    connectionBrandId: connectionBrandId ?? -1,
    postId: postId ?? -1,
  });
  throw new Error("Innlegget tilhører en annen merkevare enn kanalen du publiserer til.");
}
