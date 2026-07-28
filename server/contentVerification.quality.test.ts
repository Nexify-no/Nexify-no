/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import {
  hasDocumentedCustomerStory,
  stripMarkdown,
  verifyPostContent,
} from "./services/verification/contentVerification";
import { needsRecheck, RULES_VERSION_AT } from "./services/verification/reverify";

/**
 * PR #83 — old content, and claims nobody can stand behind.
 *
 * The two new rules are pure functions, so they are tested for real:
 *
 *   1. A customer story counts as documented only when a fact READS like one AND
 *      carries a source. The old test was `/\bkunde/` over all brand text, which
 *      "vi tar imot nye kunder" satisfied — so a fabricated customer outcome
 *      passed verification and could be approved and published.
 *   2. Markdown is stripped, because LinkedIn and Facebook render `**bold**` and
 *      `## heading` as literal characters.
 */

const fact = (statement: string, over: Record<string, unknown> = {}) => ({
  statement,
  sourceUrl: "https://bedriften.no/kunder",
  ...over,
});

describe("hasDocumentedCustomerStory", () => {
  it("accepts a sourced fact that describes a customer outcome", () => {
    expect(hasDocumentedCustomerStory({
      facts: [fact("Vi hjalp en kunde med å redusere svartiden fra 3 dager til 4 timer.")],
    })).toBe(true);
  });

  it("accepts a manually entered fact with no URL at all", () => {
    // brand.setFacts defaults sourceUrl to "", so requiring one would reject
    // exactly the fix the UI tells the user to make and leave the post
    // permanently unapprovable.
    expect(hasDocumentedCustomerStory({
      facts: [fact("Kunden oppnådde 30 % lavere kostnader.", { sourceUrl: "" })],
    })).toBe(true);
  });

  it("matches Norwegian verbs — \\b is ASCII-only, so \\bøkte\\b never could", () => {
    for (const st of [
      "Kunden vår Bedrift AS økte omsetningen 40 %.",
      "Kunden fikk 30 % lavere kostnader.",
      "En kunde ga oss 5 stjerner.",
      "Klienten reduserte svartiden.",
    ]) expect(hasDocumentedCustomerStory({ facts: [fact(st)] }), st).toBe(true);
  });

  it("REJECTS the phrase that used to be enough", () => {
    // The whole bug: "kunde" appearing anywhere in brand text passed the check.
    expect(hasDocumentedCustomerStory({ facts: [fact("Vi tar imot nye kunder hele året.")] })).toBe(false);
    expect(hasDocumentedCustomerStory({ summary: "Vi elsker våre kunder." })).toBe(false);
    expect(hasDocumentedCustomerStory({ offers: ["Kundeservice"] })).toBe(false);
  });

  it("reads FACTS only, never prose", () => {
    // Facts are the curated, user-owned part of the Merkehjerne. Summary and
    // offers are model output, and grounding a claim in them is circular.
    expect(hasDocumentedCustomerStory({
      summary: "Vi hjalp en kunde med å tredoble salget.",
    })).toBe(false);
  });

  it("rejects an empty or absent brand", () => {
    expect(hasDocumentedCustomerStory(null)).toBe(false);
    expect(hasDocumentedCustomerStory(undefined)).toBe(false);
    expect(hasDocumentedCustomerStory({ facts: [] })).toBe(false);
    expect(hasDocumentedCustomerStory({ facts: [fact("")] })).toBe(false);
  });
});

describe("an undocumented customer story is high_risk", () => {
  const story = "En kunde fortalte oss at de tredoblet salget etter samarbeidet.";

  it("flags it when the brand has no documented story", () => {
    const r = verifyPostContent({ content: story, brand: { facts: [fact("Åpningstider: 09-17.")] } });
    expect(r.status).toBe("high_risk");
    expect(r.issues.map((i) => i.code)).toContain("customer_story");
  });

  it("flags it even when brand text merely mentions customers", () => {
    // This is the case that used to pass.
    const r = verifyPostContent({ content: story, brand: { summary: "Vi hjelper kunder i hele Norge." } });
    expect(r.status).toBe("high_risk");
  });

  it("clears once the story is a documented fact", () => {
    const r = verifyPostContent({
      content: story,
      brand: { facts: [fact("Vi hjalp en kunde med å tredoble salget, se kundehistorien.")] },
    });
    expect(r.issues.map((i) => i.code)).not.toContain("customer_story");
  });

  it("does NOT fire on ordinary Norwegian prose containing the word case", () => {
    // The old STORY_RE had a bare `case` alternative, so these were high_risk.
    for (const c of [
      "Vi bygger en solid business case for kundene.",
      "I verste case er det gratis.",
    ]) expect(verifyPostContent({ content: c, brand: null }).status, c).not.toBe("high_risk");
  });

  it("names the offending phrase, so the user knows which sentence to fix", () => {
    const r = verifyPostContent({ content: story, brand: null });
    const issue = r.issues.find((i) => i.code === "customer_story");
    expect(issue?.evidence?.toLowerCase()).toContain("en kunde");
    expect(issue?.message).toMatch(/kilde|fjern/i);
  });

  it("requires review for anything not fully verified", () => {
    expect(verifyPostContent({ content: story, brand: null }).requiresReview).toBe(true);
    expect(verifyPostContent({ content: "God helg!", brand: null }).requiresReview).toBe(false);
  });
});

describe("stripMarkdown", () => {
  it("removes bold, italic and strikethrough markers but keeps every word", () => {
    // Deliberately non-lossy: struck-through text loses its markers, not its
    // words. Dropping words would change what the user approved.
    expect(stripMarkdown("**Nyhet!** Vi har _lansert_ noe ~~gammelt~~ nytt."))
      .toBe("Nyhet! Vi har lansert noe gammelt nytt.");
  });

  it("removes headings", () => {
    expect(stripMarkdown("## Store nyheter\nVi lanserer i dag.")).toBe("Store nyheter\nVi lanserer i dag.");
  });

  it("leaves a hashtag alone", () => {
    // A lone "#" is a hashtag on every platform, not a heading.
    expect(stripMarkdown("Klart for helgen #ballonger #fest")).toBe("Klart for helgen #ballonger #fest");
  });

  it("keeps a link's destination rather than silently dropping it", () => {
    expect(stripMarkdown("Les mer på [nettsiden](https://bedriften.no/nytt)."))
      .toBe("Les mer på nettsiden (https://bedriften.no/nytt).");
  });

  it("does not duplicate a URL used as its own label", () => {
    expect(stripMarkdown("[https://bedriften.no](https://bedriften.no)")).toBe("https://bedriften.no");
  });

  it("turns list bullets into plain lines", () => {
    expect(stripMarkdown("- Ballonger\n- Kaker\n* Pynt")).toBe("Ballonger\nKaker\nPynt");
  });

  it("keeps code contents", () => {
    expect(stripMarkdown("Bruk `kode123` i kassen.")).toBe("Bruk kode123 i kassen.");
  });

  it("leaves ordinary asterisks and snake_case intact", () => {
    expect(stripMarkdown("2 * 3 = 6")).toBe("2 * 3 = 6");
    expect(stripMarkdown("filnavn_med_understrek.png")).toBe("filnavn_med_understrek.png");
  });

  it("never corrupts a URL", () => {
    // The `__` rule had no lookarounds, and `/` is a non-word character — so
    // `/__cache__/` became `/cache/`: a 404 link, published, and verified as
    // though the mangled URL were the real one.
    for (const u of [
      "https://x.no/wp/__cache__/bilde.png",
      "https://bedriften.no/a/_kunder_/side",
      "https://x.no/s?q=a*b",
    ]) expect(stripMarkdown(u), u).toBe(u);
    expect(stripMarkdown("MY__VAR__NAME i teksten")).toBe("MY__VAR__NAME i teksten");
  });

  it("does not blow up on a degenerate link run", () => {
    // Nested unbounded quantifiers took 3 s at 3 200 chars and never finished at
    // 20 000 — on the main event loop, on raw model output.
    const t0 = Date.now();
    stripMarkdown("[a](".repeat(5_000));
    expect(Date.now() - t0).toBeLessThan(1_000);
  });

  it("clears a horizontal rule without leaving a residue", () => {
    expect(stripMarkdown("* * *")).toBe("");
    expect(stripMarkdown("- - -")).toBe("");
  });

  it("survives empty and non-string input", () => {
    expect(stripMarkdown("")).toBe("");
    expect(stripMarkdown(undefined as unknown as string)).toBe("");
  });

  it("collapses the blank lines its own removals leave behind", () => {
    expect(stripMarkdown("Tittel\n\n---\n\nBrødtekst")).toBe("Tittel\n\nBrødtekst");
  });

  it("never invents or loses a number", () => {
    // Stripping runs BEFORE verification, so it must not change a checkable claim.
    const before = "Vi solgte **1 200** ballonger for kr 4 990.";
    const after = stripMarkdown(before);
    for (const token of ["1 200", "4 990"]) expect(after).toContain(token);
  });
});

describe("old content is re-checked, not trusted", () => {
  it("treats a never-verified row as stale", () => {
    expect(needsRecheck(null)).toBe(true);
    expect(needsRecheck(undefined)).toBe(true);
  });

  it("treats a verdict older than the current rules as stale", () => {
    expect(needsRecheck(new Date(RULES_VERSION_AT.getTime() - 1))).toBe(true);
  });

  it("leaves a current verdict alone, so opening a plan is not a write", () => {
    expect(needsRecheck(new Date(RULES_VERSION_AT.getTime() + 1))).toBe(false);
  });

  it("an EDIT re-grades the post, so a fixed post can be approved", () => {
    // verifiedAt looked fresh after an edit, so the re-check on open skipped the
    // row: the post stayed high_risk, still quoting a sentence the user had
    // deleted, and was permanently unapprovable.
    const store = readFileSync("server/planStore.ts", "utf8");
    const fn = store.slice(store.indexOf("export async function editPostContent"));
    const body = fn.slice(0, fn.indexOf("\nexport "));
    expect(body).toContain("verifyPostContent");
    expect(body).toMatch(/verificationStatus,/);
    expect(body).toMatch(/verifiedAt: new Date\(\)/);
  });

  it("re-checks against the LIVE Merkehjerne, not the frozen snapshot", () => {
    // Otherwise "add the story as a fact" can never clear a plan flag: the check
    // keeps consulting the facts as they were when the plan was created.
    const store = readFileSync("server/planStore.ts", "utf8");
    expect(store).toMatch(/const liveBrand = await brandFactsForUser\(userId\)/);
    expect(store).toMatch(/liveBrand \?\? plan\.brandSnapshot/);
  });

  it("excludes siblings by id, not by content", () => {
    // Filtering by value removed every identical copy INCLUDING the sibling, so
    // two byte-identical posts both came back verified and bulk-approvable.
    const rv = readFileSync("server/services/verification/reverify.ts", "utf8");
    expect(rv).toMatch(/if \(id !== row\.id && text\)/);
    expect(rv).not.toMatch(/filter\(\(c\) => c !== row\.content\)/);
  });

  it("re-verification is wired into opening a plan", () => {
    const store = readFileSync("server/planStore.ts", "utf8");
    const fn = store.slice(store.indexOf("export async function getPlanForUser"));
    const body = fn.slice(0, fn.indexOf("\nexport "));
    expect(body).toContain("reverifyPlanPosts");
    // Must never stop the user opening their plan.
    expect(body).toMatch(/catch \(e\)[\s\S]{0,160}console\.warn/);
  });

  it("the findings are persisted, not just the status", () => {
    const store = readFileSync("server/planStore.ts", "utf8");
    expect(store).toMatch(/verificationIssues,/);
    expect(store).toMatch(/verifiedAt: now/);
  });
});

describe("a flagged claim cannot slip through", () => {
  it("approval still refuses high_risk", () => {
    const approve = readFileSync("server/planApprove.ts", "utf8");
    expect(approve).toMatch(/verificationStatus !== "high_risk"/);
    expect(approve).toMatch(/verificationStatus === "verified"/);
  });

  it("saving as a draft skips high_risk instead of laundering it", () => {
    // "Mine innlegg" remembers nothing about why a post was flagged, so a
    // high-risk claim used to become publishable just by changing table.
    const store = readFileSync("server/planStore.ts", "utf8");
    const fn = store.slice(store.indexOf("export async function saveApprovedAsDrafts"));
    const body = fn.slice(0, fn.indexOf("\nexport "));
    expect(body).toMatch(/verificationStatus === "high_risk"\) \{ skipped\+\+; continue; \}/);
    // And the verdict travels with the post.
    expect(body).toMatch(/verificationStatus: post\.verificationStatus/);
  });

  it("the publish check uses the POST's brand, not whichever is active", () => {
    // A scheduled Ballong post checked against Penna's facts finds Ballong's
    // documented price ungrounded, is refused, and the worker kills it with
    // "sjekk LinkedIn-tilkoblingen" — blame pointed at the wrong subsystem.
    const guard = readFileSync("server/services/publishGuard.ts", "utf8");
    expect(guard).toMatch(/brandFactsForUser\(input\.accountId, input\.brandId\)/);
    for (const path of [
      "server/routers/platformRouter.ts",
      "server/routers/linkedinRouter.ts",
      "server/schedulerService.ts",
    ]) {
      expect(readFileSync(path, "utf8"), path).toMatch(/assertContentIsPublishable\(\{[\s\S]{0,240}brandId/);
    }
  });

  it("logs when the check is SKIPPED, so a no-op is distinguishable from a pass", () => {
    const guard = readFileSync("server/services/publishGuard.ts", "utf8");
    expect(guard).toMatch(/publish_verification_skipped/);
  });

  it("reports what it held back instead of skipping in silence", () => {
    const store = readFileSync("server/planStore.ts", "utf8");
    expect(store).toMatch(/\{ saved, skipped \}|return \{ saved, skipped \}/);
    const router = readFileSync("server/routers/plannedContentRouter.ts", "utf8");
    expect(router).toMatch(/skipped/);
  });

  it("every publish path refuses an undocumented claim", () => {
    for (const path of [
      "server/routers/platformRouter.ts",
      "server/routers/linkedinRouter.ts",
      "server/schedulerService.ts",
    ]) {
      expect(readFileSync(path, "utf8"), path).toContain("assertContentIsPublishable");
    }
  });

  it("the scheduler re-checks at PUBLISH time, not only at schedule time", () => {
    // A post can sit in the calendar for weeks; the Merkehjerne may have changed,
    // and the worker publishes with nobody watching.
    //
    // This used to compare the file offsets of `assertContentIsPublishable` and
    // `createLinkedInPost(` — a proxy that broke the moment the publish call was
    // extracted into a helper defined ABOVE the worker loop, even though the
    // ordering it was protecting had not changed at all. Assert the real
    // relationship instead: inside the worker loop, the check precedes the
    // dispatch, and the dispatch is the only way a post reaches a platform.
    const worker = readFileSync("server/schedulerService.ts", "utf8");
    const check = worker.indexOf("await assertContentIsPublishable(");
    const dispatch = worker.indexOf("await publishScheduledPost(");
    expect(check, "assertContentIsPublishable is not awaited in the worker").toBeGreaterThan(-1);
    expect(dispatch, "publishScheduledPost is not awaited in the worker").toBeGreaterThan(-1);
    expect(check).toBeLessThan(dispatch);

    // And the helper must stay the single door out. A publisher invoked directly
    // from the loop would bypass the check above without failing this file.
    const loop = worker.slice(worker.indexOf("for (const sched of due)"));
    expect(loop).not.toMatch(/new (Facebook|Instagram)Publisher\(/);
    expect(loop).not.toContain("createLinkedInPost(");
  });

  it("a deliberate block is distinguishable from an incidental failure", () => {
    // Otherwise the catch-all would swallow the block itself.
    const guard = readFileSync("server/services/publishGuard.ts", "utf8");
    expect(guard).toMatch(/class PublishBlockedError/);
    expect(guard).toMatch(/if \(e instanceof PublishBlockedError\) throw e/);
  });
});

describe("no Kundecase without a documented story", () => {
  it("the plan skeleton is gated on the real check", () => {
    // `facts.length > 0` unlocked a customer-case slot from an opening hour, and
    // the model then invented the customer — flagged high_risk afterwards, i.e.
    // the right verdict at the wrong moment, after the user had paid for it.
    const router = readFileSync("server/routers/plannedContentRouter.ts", "utf8");
    expect(router).toContain("hasDocumentedCustomerStory");
    expect(router).not.toMatch(/hasCases = Array\.isArray\(brand\.facts\)/);
  });
});

describe("Markdown never reaches a platform", () => {
  it("there is ONE stripper, not three", () => {
    // openaiService handled only ** and __, and seriesRouter deleted every
    // asterisk in the text — so `## Nyheter`, `- punkt` and `[Les mer](url)` from
    // the Generate page still reached LinkedIn literally.
    const openai = readFileSync("server/openaiService.ts", "utf8");
    expect(openai).toContain("sharedStripMarkdown");
    expect(openai).not.toMatch(/\.replace\(\/__\(\.\+\?\)__\//);
    const series = readFileSync("server/routers/seriesRouter.ts", "utf8");
    expect(series).toMatch(/import \{ stripMarkdown \} from/);
    expect(series).not.toMatch(/function stripMarkdown\(/);
  });

  it("a generated post carries its verdict into Mine innlegg", () => {
    const router = readFileSync("server/routers/contentRouter.ts", "utf8");
    expect(router).toMatch(/verificationStatus: verdict\.status/);
    const ui = readFileSync("client/src/pages/Posts.tsx", "utf8");
    expect(ui).toMatch(/post\.verificationStatus/);
    expect(ui).toMatch(/verificationIssues/);
  });

  it("it is stripped once, on the way in", () => {
    // Stripping at display time only would still publish the raw source.
    const store = readFileSync("server/planStore.ts", "utf8");
    expect(store).toMatch(/const strippedContent = stripMarkdown\(rawContent\)/);
    expect(store).toMatch(/content: strippedContent/);
  });

  it("verification runs on the stripped text, which is what gets published", () => {
    const store = readFileSync("server/planStore.ts", "utf8");
    const idx = store.indexOf("const strippedContent");
    expect(idx).toBeGreaterThan(-1);
    expect(idx).toBeLessThan(store.indexOf("verifyPostContent({"));
  });
});

describe("the reason is shown, not just a badge", () => {
  const ui = readFileSync("client/src/pages/ContentPlan.tsx", "utf8");

  it("renders each finding with its offending snippet", () => {
    expect(ui).toMatch(/post\.verificationIssues/);
    expect(ui).toMatch(/issue\.message/);
    expect(ui).toMatch(/issue\.evidence/);
  });

  it("tells the user how to clear a high-risk flag", () => {
    expect(ui).toContain("Kan ikke godkjennes før dette er rettet");
    expect(ui).toMatch(/faktum med kilde i Merkehjernen/);
  });

  it("no longer hides the reason in a title tooltip", () => {
    expect(ui).not.toMatch(/title="Innhold som ikke er dokumentert/);
  });
});

describe("the migration is registered and honest", () => {
  it("adds the reason columns to both tables", () => {
    const sql = readFileSync("drizzle/0094_verification_reasons.sql", "utf8");
    expect(sql).toMatch(/ALTER TABLE `planned_posts` ADD COLUMN `verification_issues` json/);
    expect(sql).toMatch(/ALTER TABLE `posts` ADD COLUMN `verification_status`/);
  });

  it("does NOT backfill old rows as verified", () => {
    // Nothing has checked them; claiming otherwise is how an old undocumented
    // claim stays publishable.
    const sql = readFileSync("drizzle/0094_verification_reasons.sql", "utf8");
    expect(sql).not.toMatch(/UPDATE[\s\S]*verification_status\s*=\s*'verified'/i);
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
    expect(journal.entries.map((e: { tag: string }) => e.tag)).toContain("0094_verification_reasons");
  });
});
