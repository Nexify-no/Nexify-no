/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Pure image-prompt builder for Enkel plans (Fase 3c). The picture must relate to
 * the post's ACTUAL text, so the prompt leads with the generated content; when no
 * text exists yet it falls back to a generic, on-brand scene for the content type.
 * Kept free of DB/network access so it is unit-testable. All text-in-image is
 * forbidden here and again in generateImage (P0-4), so no letters ever render.
 */

/** Fallback scenes (used only when the post has no text yet). */
const IMAGE_SCENES: Record<string, string> = {
  intro: "a welcoming professional scene representing a local business and its people",
  problem: "a relatable everyday situation a customer faces, hopeful and reassuring mood",
  tips: "a clean, tidy workspace or flat-lay conveying a helpful practical idea",
  question: "an open, inviting conversational scene, warm and approachable",
  case: "a successfully completed project scene with a satisfied, accomplished mood",
  behind_scenes: "an authentic behind-the-scenes moment at a small workplace",
  faq: "a calm, clear and reassuring informational scene",
  cta: "a friendly, inviting scene that encourages getting in touch",
  seasonal: "a tasteful seasonal scene appropriate to the current time of year",
  offer: "an appealing presentation of a product or service, bright and attractive",
};

const IMAGE_PLATFORM: Record<string, "linkedin" | "instagram" | "facebook"> = {
  linkedin: "linkedin", instagram: "instagram", facebook: "facebook",
};

function styleFor(platform: string): string {
  const p = IMAGE_PLATFORM[platform] ?? "linkedin";
  return p === "linkedin"
    ? "professional business, polished and modern"
    : p === "instagram"
      ? "aesthetic, vibrant, high quality"
      : "friendly, warm, approachable";
}

/**
 * Build a text-free, CONTENT-RELATED image prompt. Leads with the post's own
 * message (collapsed + trimmed) so the picture matches what the post says; falls
 * back to a per-type scene only when content is empty.
 */
export function buildEnkelImagePrompt(input: {
  contentType: string;
  platform: string;
  content?: string | null;
  /** Optional Merkehjerne cue: industry mood + colour palette only (never text/logos). */
  brand?: { industry?: string | null; brandColors?: readonly string[] | null } | null;
}): string {
  const clean = (input.content ?? "").replace(/\s+/g, " ").trim();
  const subject = clean
    ? `a realistic photo that visually represents the topic and mood of this social media post: ${clean.slice(0, 240)}`
    : (IMAGE_SCENES[input.contentType] ?? "a clean, professional brand scene");
  const brandCue = buildBrandImageCue(input.brand);
  return `${subject}.${brandCue ? ` ${brandCue}.` : ""} Visual style: ${styleFor(input.platform)}. High quality, realistic, natural lighting, clear focal point. A clean scene with no signs, screens, logos, labels or writing of any kind.`;
}

/** Pure, text-free brand cue for the scene: industry mood + up to 3 valid hex colours. */
function buildBrandImageCue(brand?: { industry?: string | null; brandColors?: readonly string[] | null } | null): string {
  if (!brand) return "";
  const parts: string[] = [];
  const industry = typeof brand.industry === "string" ? brand.industry.trim() : "";
  if (industry) parts.push(`in the context of a ${industry.slice(0, 60)} business`);
  const colors = (brand.brandColors ?? [])
    .filter((c): c is string => typeof c === "string" && /^#[0-9A-Fa-f]{6}$/.test(c))
    .slice(0, 3);
  if (colors.length) parts.push(`with a colour palette inspired by ${colors.join(", ")}`);
  return parts.join(", ");
}
