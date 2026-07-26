/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";

/**
 * PR #84 — the Enkel journey, simplified.
 *
 *   URL → review the brand → four weeks of posts → pick posts → publish or schedule
 *
 * Structural only. The mockups' palette (#0E5C3A / #E6F0EA / #F2B233 / #FAF8F5) is
 * a global theme change, i.e. the "modern redesign" the plan says must not start
 * before #79–#83 are live in production, so it is deliberately not in this PR.
 */

const plan = readFileSync("client/src/pages/ContentPlan.tsx", "utf8");
const create = readFileSync("client/src/pages/EnkelCreate.tsx", "utf8");
const header = readFileSync("client/src/components/ActiveBrandHeader.tsx", "utf8");

describe("the active brand is always visible", () => {
  it("has its own header component, gated on multi-brand", () => {
    // With one brand the question does not exist and the header would be noise.
    expect(header).toMatch(/flags\.data\?\.enabled === true/);
    expect(header).toMatch(/if \(!enabled\) return null/);
  });

  it("names the brand, not just an id", () => {
    expect(header).toMatch(/active\?\.name/);
    expect(header).toContain("Du jobber i");
  });

  it("is mounted on both Enkel surfaces", () => {
    // The switcher lives at the BOTTOM of a collapsible sidebar, so on the pages
    // where content is approved and published the answer was off-screen.
    for (const [src, name] of [[plan, "ContentPlan"], [create, "EnkelCreate"]] as const) {
      expect(src, name).toContain("<ActiveBrandHeader");
    }
  });

  it("its switcher actually switches brand", () => {
    // The first version navigated to the channels page, so a user reading
    // "Du jobber i Ballong" who wanted Penna clicked the one control available and
    // landed somewhere that switches nothing.
    expect(header).toMatch(/brands\.setActive\.useMutation/);
    expect(header).toMatch(/aria-label="Bytt merkevare"/);
    expect(header).toMatch(/brands\.length > 1 && \(/);
  });
});

describe("one primary button", () => {
  it("Lag 4 ukers innhold works without configuring anything", () => {
    // Asking for goal, frequency and platform first made a three-screen form out
    // of "write me four weeks of content".
    expect(create).toContain("Lag 4 ukers innhold");
    expect(create).toMatch(/const effectiveGoal: Goal = goal \?\? "mixed"/);
    expect(create).toMatch(/if \(!customising\) \{/);
  });

  it("the wizard is still reachable as optional refinement", () => {
    expect(create).toContain("Tilpass mål, kanal og hyppighet");
    expect(create).toMatch(/setCustomising\(true\)/);
  });

  it("Tilbake from step 1 returns to the simple screen instead of dead-ending", () => {
    expect(create).toMatch(/if \(step > 1\) setStep[\s\S]{0,80}else setCustomising\(false\)/);
  });

  it("states the defaults it is about to use", () => {
    // A button that silently picks three settings should say which.
    expect(create).toMatch(/Standard: \{perWeek\} innlegg i uka/);
  });
});

describe("the post card carries the whole decision", () => {
  it("offers Publiser nå, Planlegg and Rediger", () => {
    for (const label of ["Publiser nå", "Planlegg", "Rediger"]) {
      expect(plan, label).toContain(label);
    }
  });

  it("says which channel and destination it would go to", () => {
    // "Klar til publisering" without naming the channel is not an answer, and with
    // several brands connected it is the thing most worth checking.
    expect(plan).toMatch(/destinations\.data\?\.platforms\?\.find/);
    expect(plan).toMatch(/destination\?\.connected/);
    expect(plan).toMatch(/ingen konto koblet til/);
  });

  it("shows the suggested date", () => {
    expect(plan).toMatch(/formatDate\(post\.suggestedDate\)/);
  });

  it("refuses both actions when there is no destination", () => {
    // PR #82 would reject the publish server-side; disabling it here means the
    // user finds out before pressing, not after.
    const matches = plan.match(/disabled=\{busy \|\| !canApprove \|\| !canSend\}/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("does NOT block on destinations when multi-brand is off", () => {
    // social.destinations is FORBIDDEN without the flag, and the two flags are
    // independent — querying it unconditionally left every card's Publiser nå and
    // Planlegg permanently disabled on a perfectly connected LinkedIn.
    expect(plan).toMatch(/enabled: multiBrand/);
    expect(plan).toMatch(/const canSend = !multiBrand \|\| destination\?\.connected === true/);
  });

  it("names the reason in visible text, not only a title on a disabled button", () => {
    // `title` on a disabled button is not exposed by most touch/AT stacks, and it
    // could only name one of the two possible causes.
    expect(plan).toMatch(/const blockedReason = !canApprove/);
    expect(plan).toMatch(/id=\{`blocked-\$\{post\.id\}`\}/);
    expect(plan).toMatch(/aria-describedby=\{blockedReason/);
  });

  it("keeps Rediger available after Planlegg", () => {
    // A week-1 post whose suggested date has passed is refused by ScheduleDialog;
    // with Rediger disabled on `saved` the user cancelled the dialog and the card
    // then offered nothing but the two actions that had just failed.
    expect(plan).toMatch(/disabled=\{busy\} onClick=\{\(\) => \{ setDraft/);
  });

  it("invalidates after saving one post, so the card is not acting on stale state", () => {
    expect(plan).toMatch(/plan\.saveOne\.useMutation\(\{ onSettled: invalidate \}\)/);
  });

  it("refuses both actions on flagged content", () => {
    // canApprove is false for high_risk (PR #83).
    expect(plan).toMatch(/canApprove = post\.generationStatus === "done" && post\.verificationStatus !== "high_risk"/);
  });

  it("saves ONE post before publishing or scheduling it", () => {
    // Publishing and scheduling are defined on saved posts; saving the whole plan
    // to act on one card is the wrong granularity.
    expect(plan).toMatch(/saveOne\.mutateAsync\(\{ planId, plannedPostId: post\.id \}\)/);
    expect(plan).toMatch(/setScheduleFor\(postId\)/);
  });

  it("surfaces a publish refusal rather than resolving silently", () => {
    // publishToSpecific RESOLVES with { success: false }.
    expect(plan).toMatch(/if \(r\.success === false\)[\s\S]{0,120}toast\.error/);
  });
});

describe("plan.saveOne", () => {
  const store = readFileSync("server/planStore.ts", "utf8");
  const fn = store.slice(store.indexOf("export async function saveOnePlannedPost"));
  const body = fn.slice(0, fn.indexOf("\n/** Real worker deps"));

  it("is idempotent — pressing Planlegg twice does not create a second draft", () => {
    expect(body).toMatch(/if \(post\.savedPostId != null\) return \{ postId: post\.savedPostId/);
  });

  it("refuses high_risk content, like the bulk path", () => {
    expect(body).toMatch(/verificationStatus === "high_risk"/);
  });

  it("carries the verdict onto the saved post", () => {
    expect(body).toMatch(/verificationStatus: post\.verificationStatus/);
  });

  it("carries the PLAN's brand onto the draft", () => {
    // brand_id NULL is what PR #79 eliminated — and worse than before, because
    // resolvePublishBrand then falls back to "whichever brand is active", so a
    // Ballong plan could be published through Penna's LinkedIn.
    expect(body).toMatch(/brandId: post\.brandId/);
    const approve = readFileSync("server/planApprove.ts", "utf8");
    expect(approve).toMatch(/brandId: post\.brandId \?\? null/);
  });

  it("resolves a lost race by using the winner's row, not by leaving two drafts", () => {
    expect(body).toMatch(/isNull\(plannedPosts\.savedPostId\)/);
    expect(body).toMatch(/\.delete\(postsTable\)/);
  });

  it("is scoped to the owner at every step", () => {
    expect(body).toMatch(/getPostForUser\(planId, plannedPostId, userId\)/);
    expect(body).toMatch(/eq\(plannedPosts\.userId, userId\)/);
  });

  it("the router maps its refusals to real messages", () => {
    const router = readFileSync("server/routers/plannedContentRouter.ts", "utf8");
    const proc = router.slice(router.indexOf("saveOne: protectedProcedure"));
    expect(proc).toMatch(/blocked === "high_risk"[\s\S]{0,240}TRPCError/);
    expect(proc).toMatch(/ikke klart ennå/);
    // Behind the same flag as the rest of Enkel.
    expect(proc).toMatch(/requireFlag\(\)/);
  });
});

describe("the plan on screen belongs to the brand in the header", () => {
  it("listPlansForUser is brand-scoped", () => {
    // /innholdsplan takes the newest plan for the USER, so unscoped this showed a
    // Ballong plan while the header said "Du jobber i Penna".
    const store = readFileSync("server/planStore.ts", "utf8");
    const fn = store.slice(store.indexOf("export async function listPlansForUser"));
    const body = fn.slice(0, fn.indexOf("\nexport "));
    expect(body).toMatch(/ownedBy\(contentPlans\.userId, contentPlans\.brandId/);
  });

  it("editing keeps an already-saved draft in sync", () => {
    // Otherwise the plan row held the fix and the saved post held the text being
    // fixed — and that older text is what publishing would have sent.
    const store = readFileSync("server/planStore.ts", "utf8");
    expect(store).toMatch(/if \(post\.savedPostId != null\)[\s\S]{0,400}generatedContent: clean/);
    // Never rewrite something already published.
    expect(store).toMatch(/eq\(postsTable\.status, "draft"\)/);
  });

  it("retrying a FAILED publish is not reported as already published", () => {
    // The server key is (post, platform, 60s bucket), so a retry inside the same
    // minute collided with the failed row — and the button is the user's only
    // recovery from a failure.
    const guard = readFileSync("server/services/publishGuard.ts", "utf8");
    expect(guard).toMatch(/prior\.status === "failed"[\s\S]{0,200}status: "pending"/);
  });

  it("the quota warning reaches the simple path", () => {
    expect(create).toMatch(/enabled: flagsQuery\.data\?\.enabled === true/);
    expect(create).toMatch(/const overBudget =/);
    expect(create).toMatch(/Planen er større enn det du har igjen/);
  });

  it("the big button waits for the Merkehjerne check", () => {
    expect(create).toMatch(/disabled=\{createPlan\.isPending \|\| brandQuery\.isLoading\}/);
  });
});

describe("advanced tools are out of the way", () => {
  it("the bulk plan actions sit behind a disclosure", () => {
    // Offering "Godkjenn alle sikre" and "Lagre i Mine innlegg" first made the
    // page look like an admin screen instead of four weeks of ready posts.
    expect(plan).toMatch(/<details[\s\S]{0,200}Flere handlinger for hele planen/);
    // Compare the BUTTON, not the prose above it that explains the change.
    const summaryIdx = plan.indexOf("Flere handlinger for hele planen");
    const buttonIdx = plan.indexOf("aria-hidden=\"true\" />Godkjenn alle sikre");
    expect(buttonIdx).toBeGreaterThan(-1);
    expect(buttonIdx).toBeGreaterThan(summaryIdx);
  });

  it("simple view mode already filters the sidebar", () => {
    // Nothing new needed here — reuse rather than reinvent.
    const nav = readFileSync("client/src/components/DashboardNav.tsx", "utf8");
    expect(nav).toMatch(/SIMPLE_HREFS/);
    expect(nav).toMatch(/viewMode === "simple" \? primaryNavItems\.filter/);
  });

  it("Fjern is offered only before approval, not next to Publiser", () => {
    expect(plan).toMatch(/\{!saved && !approved && \(/);
  });

  it("the no-auto-publish reassurance stays OUTSIDE the disclosure", () => {
    // This is the page that just gained a per-card Publiser nå; hiding that line
    // behind a collapsed section is exactly the wrong place for it.
    const detailsEnd = plan.indexOf("</details>");
    expect(plan.indexOf("Ingenting publiseres automatisk")).toBeGreaterThan(detailsEnd);
  });
});

describe("the whole thing stays behind the Enkel flag", () => {
  it("both surfaces gate on plan.flags", () => {
    for (const [src, name] of [[plan, "ContentPlan"], [create, "EnkelCreate"]] as const) {
      expect(src, name).toMatch(/trpc\.plan\.flags\.useQuery/);
      expect(src, name).toMatch(/flagsQuery\.data\?\.enabled/);
    }
  });

  it("no global theme change — the redesign waits for #79–#83 in production", () => {
    // The mockups' palette is a whole-app change; shipping it here would be
    // starting the redesign before the correctness PRs are live.
    const css = readFileSync("client/src/index.css", "utf8");
    expect(css).not.toContain("#0E5C3A");
    expect(css).not.toContain("0e5c3a");
  });
});
