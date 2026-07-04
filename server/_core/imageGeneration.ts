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
import { safeFetch } from "./urlGuard";

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

async function withImageRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: any;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const status = e?.status ?? e?.statusCode ?? e?.response?.status;
      const retriable = status === 429 || (typeof status === "number" && status >= 500 && status < 600);
      if (!retriable || i === attempts) break;
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (i - 1), 8000)));
    }
  }
  throw lastErr;
}

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  // Pick the configured provider. Defaults to OpenAI so behaviour is unchanged
  // until IMAGE_PROVIDER is set. fal.ai (FLUX) is the best quality-per-cost option.
  const buffer = await withImageRetry(() =>
    ENV.imageProvider === "fal"
      ? generateWithFal(options.prompt)
      : generateWithOpenAI(options.prompt)
  );

  // Save to object storage; if storage isn't configured/reachable (the legacy
  // forge storage proxy returns 502 on this deploy), fall back to an inline data
  // URL so the generated image still displays instead of failing the whole request.
  try {
    const { url } = await storagePut(`generated/${Date.now()}.png`, buffer, "image/png");
    return { url };
  } catch (e) {
    console.warn("[image-gen] storage upload failed, returning data URL:", (e as Error)?.message);
    return { url: `data:image/png;base64,${buffer.toString("base64")}` };
  }
}

/** OpenAI Images API (DALL·E 3 by default; set IMAGE_MODEL=gpt-image-1 to switch). */
async function generateWithOpenAI(prompt: string): Promise<Buffer> {
  // Images MUST go directly to OpenAI. A text LLM proxy (BUILT_IN_FORGE_API_URL /
  // LLM_API_URL — Ollama, Gemini, Claude, etc.) does NOT implement
  // /v1/images/generations, so routing image calls through the forge URL/key 500s.
  // Mirror the dedicated DALL-E client: OPENAI_API_KEY + api.openai.com + dall-e-3.
  const apiKey = process.env.OPENAI_API_KEY || ENV.forgeApiKey;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  const baseUrl = "https://api.openai.com";
  // Different OpenAI accounts/keys have different image models available — some
  // only have gpt-image-1, others dall-e-3/2. Try them in order and skip a model
  // that the key can't access ("The model '...' does not exist.") instead of 500ing.
  const models = ENV.imageModel ? [ENV.imageModel] : ["gpt-image-1", "dall-e-3", "dall-e-2"];
  let lastErr: Error | null = null;
  for (const model of models) {
    const response = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, prompt, n: 1, size: "1024x1024" }),
    });

    if (response.ok) {
      const result = (await response.json()) as { data: Array<{ b64_json?: string; url?: string }> };
      const item = result.data?.[0];
      if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
      if (item?.url) {
        const img = await safeFetch(item.url); // SSRF-guarded (provider-returned URL)
        if (!img.ok) throw new Error(`Failed to download generated image (${img.status})`);
        return Buffer.from(await img.arrayBuffer());
      }
      throw new Error("No image data returned from the image generation API");
    }

    const detail = await response.text().catch(() => "");
    // Model not available for this key → try the next candidate.
    if (response.status === 400 && /does not exist|do(es)? not have access|unsupported|model/i.test(detail)) {
      lastErr = new Error(`Model ${model} unavailable: ${detail.slice(0, 200)}`);
      continue;
    }
    // Surface 429 so the retry/router can map it; throw other errors as-is.
    const err: any = new Error(
      `Image generation request failed (${response.status} ${response.statusText})${detail ? `: ${detail.slice(0, 300)}` : ""}`
    );
    err.status = response.status;
    throw err;
  }
  throw lastErr || new Error("No usable image model available for this OpenAI key");
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
  const imageResponse = await safeFetch(imageUrl); // SSRF-guarded (provider-returned URL)
  if (!imageResponse.ok) {
    throw new Error(`Failed to download fal.ai image: ${imageResponse.statusText}`);
  }
  return Buffer.from(await imageResponse.arrayBuffer());
}