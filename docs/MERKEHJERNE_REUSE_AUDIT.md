# Merkehjerne reuse audit (M4)

Goal: the brand profile ("Merkehjerne") should feed **every** AI tool, not just the
main generator. This audits where it was reused vs. missing, and what M4 changed.

## Findings

| AI tool | Entry point | Before M4 | After M4 |
|---|---|---|---|
| Main content generation | `contentRouter.generate` | full profile + facts (gated by `useBrandProfile`) | unchanged |
| Enkel 4-week plan (text) | `planStore.generateText` -> `promptBuilder` | frozen brand snapshot | unchanged |
| **Repurpose (Gjenbruk-Maskin)** | `contentRouter.repurpose` | generic prompt, no brand voice | brand-voice block injected |
| **Content Coach** | `coachRouter.chat` | post-stats only | brand context injected |
| **Enkel plan images** | `planStore.generateImageForPost` -> `planImagePrompt` | generic scenes | industry mood + colour palette (text-free) |

## What M4 added

A shared reuse layer, `server/services/merkehjerne/brandContext.ts`:

- `loadBrandHints(userId)` - loads the user's **ready** profile as compact hints.
- `renderBrandVoiceBlock(hints)` - pure Norwegian voice block (company, audience,
  tone, writing style, preferred/avoid words, CTAs, up to 5 **verified facts**).
- `renderBrandImageCue(hints)` - pure, **text-free** cue (industry mood + up to 3
  valid hex colours); never emits logos, names or writing.

Wired into: `repurpose`, `coach`, and the Enkel worker image path.

## Safety

The source is always the **stored, sanitized, evidence-grounded** profile
(`brand_profiles`) - never raw crawled text - so reuse adds no injection surface.
Facts are passed with an explicit "use only these, do not invent" instruction.
Image cues stay palette/industry only and keep the existing "no signs, logos,
labels or writing" guard, so no text ever renders in an image.

## Not changed (intentionally)

- Manual "Bytt bilde" (`regeneratePostImage`) still uses a plain scene; the brand
  palette applies to automatic plan images. (Follow-up candidate.)
- `contentRouter.generate` already reused the full profile and was left as-is.
