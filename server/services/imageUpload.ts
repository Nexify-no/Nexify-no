/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * One raster-image upload, shared by every admin surface that needs one.
 *
 * `blogRouter.uploadImage` and `adminRouter.uploadEmailImage` had byte-identical
 * copies of this: the same filename regex, the same size cap, the same
 * content-type enum, the same base64 split, the same key shape. Two copies of a
 * validation rule is one copy that will be tightened and one that will not.
 *
 * SVG is deliberately absent from the accepted types. An SVG is an HTML document
 * with a picture's file extension, and these URLs are served from a host we own —
 * accepting one is accepting stored XSS.
 */

/** What the caller is allowed to send. Mirrored by the zod input at each router. */
export type RasterUploadInput = {
  fileName: string;
  fileData: string;
  contentType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
};

const EXTENSION: Record<RasterUploadInput["contentType"], string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Store an image and return its URL.
 *
 * `prefix` is a fixed literal chosen by the caller, never user input — the stored
 * key is `${prefix}/${timestamp}-${random}.${ext}`. The client's file name is
 * validated for shape but deliberately NOT used in the key: a caller-controlled
 * path component is how traversal and overwrite bugs get in, and the original
 * name carries no value once the file is stored.
 */
export async function uploadRasterImage(
  prefix: "blog-images" | "email-images",
  input: RasterUploadInput
): Promise<{ url: string; fileKey: string }> {
  const ext = EXTENSION[input.contentType];
  if (!ext) throw new Error(`Ustøttet filtype: ${input.contentType}`);

  const fileKey = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const base64 = input.fileData.split(",")[1] || input.fileData;
  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength === 0) throw new Error("Filen er tom eller ikke gyldig base64.");

  const { storagePut } = await import("../storage");
  const { url } = await storagePut(fileKey, buffer, input.contentType);
  return { url, fileKey };
}
