/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */
import { describe, it, expect } from "vitest";
import { generateContent, type GenerateContentDeps } from "./openaiService";
import { buildContentPrompt, type ContentOptions } from "./promptBuilder";

/**
 * Integration test for context isolation in the content generation path.
 *
 * The reported bug: a post about one subject came back carrying context from a
 * previous, unrelated request (and fabricated claims). This proves the opposite
 * property end-to-end: running many generations — sequentially AND in parallel,
 * for different topics and different users — never lets one request's context
 * (topic, keywords, audience, or a user's voice profile) reach another.
 *
 * We drive the REAL generateContent() and inject a recording completion so we
 * can assert on the EXACT prompt each call received. Each call is fully
 * self-contained (system+user built from its own params only) — there is no
 * shared history/cache/state, so nothing can bleed.
 */

const UNIQ = "ZQX"; // unlikely token to make cross-run contains() checks reliable

interface Spec {
  i: number;
  user: "A" | "B";
  options: ContentOptions;
  topicTok: string;
  kwTok: string;
  audTok: string;
}

function makeSpec(i: number): Spec {
  const user = i % 2 === 0 ? "A" : "B";
  const topicTok = `TOPIC_${i}_${UNIQ}`;
  const kwTok = `KW_${i}_${UNIQ}`;
  const audTok = `AUD_${i}_${UNIQ}`;
  const sig = user === "A" ? `SIG_ALPHA_${UNIQ}` : `SIG_BETA_${UNIQ}`;
  const options: ContentOptions = {
    topic: `A post about ${topicTok}`,
    platform: "linkedin",
    tone: "professional",
    keywords: [kwTok],
    targetAudience: audTok,
    goal: "engagement",
    // Only some runs use a voice profile, to prove profiles never cross users.
    voiceProfile: i % 3 === 0 ? { signaturePhrases: [sig], profileSummary: `style ${sig}` } : undefined,
  };
  return { i, user, options, topicTok, kwTok, audTok };
}

/** A recording fake completion: captures the prompt, returns a marker echoing only its own topic. */
function recorder() {
  const calls: { system: string; user: string; marker: string }[] = [];
  const createCompletion: GenerateContentDeps["createCompletion"] = async ({ system, user }) => {
    const tok = user.match(/TOPIC_\d+_ZQX/)?.[0] ?? "NONE";
    const marker = `RESULT::${tok}`;
    calls.push({ system, user, marker });
    return marker;
  };
  return { calls, createCompletion };
}

function assertIsolation(specs: Spec[], calls: { system: string; user: string }[]) {
  expect(calls.length).toBe(specs.length);
  for (const spec of specs) {
    // Find the single call that belongs to this spec (by its unique topic token).
    const mine = calls.filter((c) => (c.system + c.user).includes(spec.topicTok));
    expect(mine.length).toBe(1);
    const blob = mine[0].system + "\n" + mine[0].user;

    // Its own context is present.
    expect(blob).toContain(spec.topicTok);
    expect(blob).toContain(spec.kwTok);
    expect(blob).toContain(spec.audTok);

    // No OTHER run's topic/keyword/audience leaked in.
    for (const other of specs) {
      if (other.i === spec.i) continue;
      expect(blob).not.toContain(other.topicTok);
      expect(blob).not.toContain(other.kwTok);
      expect(blob).not.toContain(other.audTok);
    }

    // Voice profile isolation: a user's signature never appears in the other user's prompt.
    const foreignSig = spec.user === "A" ? `SIG_BETA_${UNIQ}` : `SIG_ALPHA_${UNIQ}`;
    expect(blob).not.toContain(foreignSig);
    if (!spec.options.voiceProfile) {
      expect(blob).not.toContain(`SIG_ALPHA_${UNIQ}`);
      expect(blob).not.toContain(`SIG_BETA_${UNIQ}`);
    }

    // Anti-fabrication grounding block is always present.
    expect(blob).toContain("Do NOT invent customer stories");
  }
}

describe("content generation context isolation", () => {
  it("20 PARALLEL generations for different topics/users never cross context", async () => {
    const specs = Array.from({ length: 20 }, (_, i) => makeSpec(i));
    const { calls, createCompletion } = recorder();

    const results = await Promise.all(
      specs.map((s) => generateContent(s.options, { createCompletion })),
    );

    // Each result maps to its OWN topic (no cross-wiring under concurrency).
    results.forEach((r, idx) => expect(r).toBe(`RESULT::${specs[idx].topicTok}`));
    assertIsolation(specs, calls);
  });

  it("20 SEQUENTIAL generations for different topics/users never cross context", async () => {
    const specs = Array.from({ length: 20 }, (_, i) => makeSpec(i + 100));
    const { calls, createCompletion } = recorder();

    const results: string[] = [];
    for (const s of specs) {
      results.push(await generateContent(s.options, { createCompletion }));
    }

    results.forEach((r, idx) => expect(r).toBe(`RESULT::${specs[idx].topicTok}`));
    assertIsolation(specs, calls);
  });

  it("buildContentPrompt is pure: prompts for two topics share no context, and stat angle no longer invites fabrication", () => {
    // The topic is anchored on the USER turn, keywords on the system turn — so
    // isolation has to be asserted over the whole prompt, not `system` alone.
    // (Checking `system` for the topic can never pass, and made the negative
    // assertions vacuous.)
    const pa = buildContentPrompt({ topic: "AlphaSubject", platform: "linkedin", keywords: ["akw"], angle: "shocking_stat" });
    const pb = buildContentPrompt({ topic: "BetaSubject", platform: "linkedin", keywords: ["bkw"] });
    // Rebuild A *after* B so the "A does not mention B" direction is a real check
    // on shared state rather than a statement about the order of two consts.
    const pa2 = buildContentPrompt({ topic: "AlphaSubject", platform: "linkedin", keywords: ["akw"], angle: "shocking_stat" });
    expect(`${pa2.system}\n${pa2.user}`).toBe(`${pa.system}\n${pa.user}`);

    const a = `${pa2.system}\n${pa2.user}`;
    const b = `${pb.system}\n${pb.user}`;
    expect(a).toContain("AlphaSubject");
    expect(a).not.toContain("BetaSubject");
    expect(a).not.toContain("bkw");
    expect(b).not.toContain("AlphaSubject");
    expect(b).not.toContain("akw");
    // shocking_stat must no longer instruct to open on an invented statistic.
    expect(a).not.toContain("Open on a surprising statistic");
    expect(a).toContain("never invent numbers");
  });
});
