/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Image generation helper using internal ImageService
 *
 * Example usage:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "A serene landscape with mountains"
 *   });
 *
 * For editing:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "Add a rainbow to this landscape",
 *     originalImages: [{
 *       url: "https://example.com/original.jpg",
 *       mimeType: "image/jpeg"
 *     }]
 *   });
 */
import { storagePut } from "server/storage";
import { ENV } from "./env";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
};

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  // Pick the configured provider. Defaults to OpenAI so behaviour is unchanged
  // until IMAGE_PROVIDER is set. fal.ai (FLUX) is the best quality-per-cost option.
  const buffer =
    ENV.imageProvider === "fal"
      ? await generateWithFal(options.prompt)
      : await generateWithOpenAI(options.prompt);

  // Save to S3 (single storage path for every provider).
  const { url } = await storagePut(`generated/${Date.now()}.png`, buffer, "image/png");
  return { url };
}

/** OpenAI Images API (DALL·E 3 by default; set IMAGE_MODEL=gpt-image-1 to switch). */
async function generateWithOpenAI(prompt: string): Promise<Buffer> {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  // Note: image editing (originalImages) is not supported by dall-e-3 generation
  // and is ignored here; switch to the edits endpoint / gpt-image-1 if needed.
  const baseUrl = (ENV.forgeApiUrl || "https://api.openai.com").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/v1/images/generations`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify({
      model: ENV.imageModel || "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Image generation request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }

  const result = (await response.json()) as { data: Array<{ b64_json?: string }> };
  const base64Data = result.data?.[0]?.b64_json;
  if (!base64Data) {
    throw new Error("No image data returned from the image generation API");
  }
  return Buffer.from(base64Data, "base64");
}

/** fal.ai synchronous run — FLUX dev by default. Returns hosted image URLs. */
async function generateWithFal(prompt: string): Promise<Buffer> {
  if (!ENV.falApiKey) {
    throw new Error("FAL_API_KEY is not configured (required when IMAGE_PROVIDER=fal)");
  }
  const model = ENV.imageModel || "fal-ai/flux/dev";
  const response = await fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Key ${ENV.falApiKey}`,
    },
    body: JSON.stringify({
      prompt,
      image_size: "square_hd",
      num_images: 1,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `fal.ai image request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }

  const result = (await response.json()) as {
    images?: Array<{ url?: string }>;
  };
  const imageUrl = result.images?.[0]?.url;
  if (!imageUrl) {
    throw new Error("No image returned from fal.ai");
  }

  // fal returns a hosted URL — download it so we can persist to our own storage.
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download fal.ai image: ${imageResponse.statusText}`);
  }
  return Buffer.from(await imageResponse.arrayBuffer());
}