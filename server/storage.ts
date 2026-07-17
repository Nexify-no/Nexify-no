/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Preconfigured storage helpers (S3-compatible object storage)
// Uses the storage proxy (Authorization: Bearer <token>)

import { ENV } from './_core/env';

type StorageConfig = { baseUrl: string; apiKey: string };

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

/**
 * Upload to real S3-compatible object storage (Cloudflare R2 recommended) when
 * configured via env. Returns the public URL, or null if not configured.
 * R2:  R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL
 * S3:  S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION, S3_PUBLIC_URL
 */
async function putToObjectStore(
  key: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<string | null> {
  const bucket = process.env.R2_BUCKET || process.env.S3_BUCKET;
  // Accept R2-, S3-, or standard AWS-named credentials so any common storage
  // config works (prod often sets the standard AWS_* names).
  const accessKeyId =
    process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const r2Account = process.env.R2_ACCOUNT_ID;
  // Endpoint is REQUIRED only for R2 / custom S3-compatible stores. Standard AWS
  // S3 has no custom endpoint — the SDK derives it from the region.
  const explicitEndpoint =
    process.env.S3_ENDPOINT ||
    (r2Account ? `https://${r2Account}.r2.cloudflarestorage.com` : undefined);
  if (!bucket || !accessKeyId || !secretAccessKey) {
    console.warn("[storage] object store not configured", {
      bucket: !!bucket, accessKeyId: !!accessKeyId, secretAccessKey: !!secretAccessKey,
    });
    return null;
  }
  const region = process.env.S3_REGION || process.env.AWS_REGION || (explicitEndpoint ? "auto" : "us-east-1");
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data as any);
  const publicBaseEarly = process.env.R2_PUBLIC_URL || process.env.S3_PUBLIC_URL;

  // ── Standard AWS S3 path (no custom endpoint) ────────────────────────────
  if (!explicitEndpoint) {
    console.log("[storage] uploading to AWS S3", { region, bucket });
    const client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType })
    );
    if (publicBaseEarly) return `${publicBaseEarly.replace(/\/+$/, "")}/${key}`;
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  const endpoint = explicitEndpoint;

  // R2 jurisdictions (default vs EU) are isolated: a bucket only exists on one
  // endpoint. The configured S3_ENDPOINT may point at the wrong one ("bucket does
  // not exist"), so try the configured endpoint AND its jurisdiction sibling
  // (toggle the `.eu.` segment) before giving up — no manual env fix needed.
  const candidates = Array.from(new Set([
    endpoint,
    endpoint.includes(".eu.r2.cloudflarestorage.com")
      ? endpoint.replace(".eu.r2.cloudflarestorage.com", ".r2.cloudflarestorage.com")
      : endpoint.replace(".r2.cloudflarestorage.com", ".eu.r2.cloudflarestorage.com"),
  ]));

  const publicBase = process.env.R2_PUBLIC_URL || process.env.S3_PUBLIC_URL;
  let lastErr: any = null;
  for (const ep of candidates) {
    console.log("[storage] uploading to object store", { endpoint: ep, bucket });
    try {
      const client = new S3Client({
        region, endpoint: ep,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
      });
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType })
      );
      if (publicBase) return `${publicBase.replace(/\/+$/, "")}/${key}`;
      return `${ep.replace(/\/+$/, "")}/${bucket}/${key}`;
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || e?.name || "");
      // Only try the sibling jurisdiction on a bucket-not-found error.
      if (/NoSuchBucket|bucket does not exist/i.test(msg)) continue;
      throw e;
    }
  }
  throw lastErr || new Error("object store upload failed");
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);

  // Prefer real object storage (Cloudflare R2 / S3) when configured.
  try {
    const objUrl = await putToObjectStore(key, data, contentType);
    if (objUrl) return { key, url: objUrl };
  } catch (e) {
    console.warn("[storage] object-store upload failed, trying legacy proxy:", (e as Error)?.message);
  }

  // Legacy storage proxy fallback.
  const { baseUrl, apiKey } = getStorageConfig();
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}