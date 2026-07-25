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
 * Mirror the account's provider connections into brand_social_connections.
 * Idempotent: existing rows are left untouched.
 */
export async function syncConnectionsForAccount(accountId: number): Promise<void> {
  const db = await requireDb();
  const brands = await listBrands(accountId);
  const soleBrandId = brands.length === 1 ? brands[0].id : null;

  const [li] = await db
    .select()
    .from(linkedinConnections)
    .where(eq(linkedinConnections.userId, accountId))
    .limit(1);
  if (!li) return;

  const [existing] = await db
    .select()
    .from(brandSocialConnections)
    .where(and(eq(brandSocialConnections.accountId, accountId), eq(brandSocialConnections.platform, "linkedin")))
    .limit(1);
  if (existing) return;

  const toOrg = li.publishTarget === "organization" && !!li.organizationUrn;
  await db.insert(brandSocialConnections).values({
    accountId,
    // Only adopt automatically when the mapping is unambiguous.
    brandId: li.brandId ?? soleBrandId,
    platform: "linkedin",
    providerConnectionId: li.id,
    destinationId: toOrg ? li.organizationUrn : li.personUrn,
    destinationName: toOrg ? li.organizationName : li.profileName,
    destinationType: toOrg ? "organization" : "person",
    status: (li.brandId ?? soleBrandId) ? "active" : "needs_brand_assignment",
    tokenExpiresAt: li.expiresAt ?? null,
  });
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
