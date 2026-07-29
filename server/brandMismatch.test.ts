/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Brand separation, at the one table where getting it wrong is invisible.
 *
 * Observed in production: the brand switcher said "Penna.no" while the
 * Merkehjerne on the same screen said "Ballong For Fest AS · ballongforfest.no",
 * and the generator wrote balloon content for Penna's channels. A post published
 * that way is what the customer sees; the Merkehjerne is what produced it.
 *
 * Cause: `ensureDefaultBrand` adopted an unowned brand_profiles row into
 * whichever brand happened to be active. Every OTHER table's adoption sat behind
 * an `unambiguous` guard whose own comment names this exact failure — "guessing
 * is how Ballong's posts ended up under Penna" — and brand_profiles ran outside
 * it.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

import { detectBrandMismatch, normalizeHost } from "./services/merkehjerne/brandMismatch";

describe("host normalisation", () => {
  it("ignores scheme, www, case, port and trailing slash", () => {
    const forms = [
      "https://www.penna.no/",
      "http://penna.no",
      "PENNA.NO",
      "https://penna.no:443/",
      "penna.no",
    ];
    for (const form of forms) expect(normalizeHost(form)).toBe("penna.no");
  });

  it("returns null for empty or unparseable input", () => {
    expect(normalizeHost("")).toBeNull();
    expect(normalizeHost(null)).toBeNull();
    expect(normalizeHost("   ")).toBeNull();
  });

  it("keeps different hosts different", () => {
    expect(normalizeHost("https://ballongforfest.no")).not.toBe(normalizeHost("https://penna.no"));
  });
});

describe("the production case", () => {
  it("flags a Ballong Merkehjerne attached to the Penna brand", () => {
    const result = detectBrandMismatch({
      brandName: "Penna.no",
      brandWebsiteUrl: "https://penna.no",
      profileCompanyName: "Ballong For Fest AS",
      profileWebsiteUrl: "https://ballongforfest.no/",
    });
    expect(result.mismatch).toBe(true);
    // The banner names what it found, so the user can see the mismatch rather
    // than take our word for it.
    expect(result.profileDescribes).toBe("Ballong For Fest AS");
  });

  it("flags it on the host alone, even when the company name is missing", () => {
    expect(
      detectBrandMismatch({
        brandName: "Penna.no",
        brandWebsiteUrl: "https://penna.no",
        profileCompanyName: null,
        profileWebsiteUrl: "https://ballongforfest.no",
      }).mismatch,
    ).toBe(true);
  });
});

describe("it stays quiet when it should", () => {
  it("accepts the same site written differently", () => {
    expect(
      detectBrandMismatch({
        brandName: "Penna",
        brandWebsiteUrl: "penna.no",
        profileCompanyName: "Penna",
        profileWebsiteUrl: "https://www.penna.no/",
      }).mismatch,
    ).toBe(false);
  });

  it("accepts a company-form suffix, via the substring rule", () => {
    expect(
      detectBrandMismatch({
        brandName: "Penna AS",
        brandWebsiteUrl: null,
        profileCompanyName: "Penna",
        profileWebsiteUrl: null,
      }).mismatch,
    ).toBe(false);
  });

  it("accepts a longer legal name that contains the brand", () => {
    expect(
      detectBrandMismatch({
        brandName: "Penna",
        brandWebsiteUrl: null,
        profileCompanyName: "Penna Norge",
        profileWebsiteUrl: null,
      }).mismatch,
    ).toBe(false);
  });

  it("says nothing about the auto-created default brand", () => {
    // "Min bedrift" is what ensureDefaultBrand names a brand when it has nothing
    // to name it after. It carries no claim, so it can contradict nothing.
    expect(
      detectBrandMismatch({
        brandName: "Min bedrift",
        brandWebsiteUrl: null,
        profileCompanyName: "Ballong For Fest AS",
        profileWebsiteUrl: null,
      }).mismatch,
    ).toBe(false);
  });

  it("says nothing when there is no evidence on one side", () => {
    expect(
      detectBrandMismatch({
        brandName: null,
        brandWebsiteUrl: null,
        profileCompanyName: "Ballong For Fest AS",
        profileWebsiteUrl: "https://ballongforfest.no",
      }).mismatch,
    ).toBe(false);
  });

  it("lets the host settle it when a rename made the names differ", () => {
    // Renaming a brand does not make it a different company.
    expect(
      detectBrandMismatch({
        brandName: "Penna (nytt navn)",
        brandWebsiteUrl: "https://penna.no",
        profileCompanyName: "Penna.no",
        profileWebsiteUrl: "https://penna.no",
      }).mismatch,
    ).toBe(false);
  });
});

describe("adoption no longer guesses which brand a Merkehjerne belongs to", () => {
  const source = () => readFileSync("server/services/brands.ts", "utf8");

  it("adopts brand_profiles only when the account has exactly one brand", () => {
    // The load-bearing assertion. brand_profiles adoption used to run before
    // `unambiguous` was even computed, so an account with several brands still
    // had its unowned Merkehjerne stamped onto the active one.
    const src = source();
    const guard = src.indexOf("const unambiguous = all.length === 1;");
    const adoption = src.indexOf('adopt("brand_profiles"');
    expect(guard).toBeGreaterThan(-1);
    expect(adoption).toBeGreaterThan(guard);

    // …and inside the branch, not merely after it.
    const branch = src.indexOf("if (unambiguous) {");
    const branchEnd = src.indexOf('adopt("linkedin_connections"');
    expect(adoption).toBeGreaterThan(branch);
    expect(adoption).toBeLessThan(branchEnd);
  });

  it("still refuses to overwrite a brand that already has a Merkehjerne", () => {
    // UNIQUE(user_id, brand_id) since 0089 — and overwriting would destroy a
    // profile the user confirmed.
    expect(source()).toMatch(/if \(taken\) return;/);
  });

  it("adopts at most one row", () => {
    // A blanket UPDATE would give several unstamped rows the same brand and
    // collide on the unique key.
    const src = source();
    const block = src.slice(src.indexOf('adopt("brand_profiles"'), src.indexOf('adopt("posts"'));
    expect(block).toContain("orderBy(brandProfiles.id)");
    expect(block).toContain("limit(1)");
  });
});

describe("the Merkehjerne page reports it", () => {
  const page = () => readFileSync("client/src/pages/BrandBrain.tsx", "utf8");

  it("renders the mismatch banner from the server's verdict", () => {
    // Deciding this client-side would test a different row than the generator
    // reads.
    // Asserting the identifier merely APPEARS passed with the render short-
    // circuited to `false && ...`. Anchor on the ternary that actually decides.
    expect(page()).toMatch(
      /\{\(profile as any\)\.brandMismatch\s*\n?\s*\?\s*brandMismatchBanner\(/,
    );
  });

  it("tells the user what it will cost them, not just that something is off", () => {
    expect(page()).toMatch(/feil stemme, tjenester og målgruppe/);
    expect(page()).toMatch(/Analyser på nytt/);
  });

  it("shows the banner on the ready screen too, not only the review screen", () => {
    // A confirmed-but-mismatched Merkehjerne never shows the review screen, so a
    // banner only there would never be seen by the account that has the problem.
    const src = page();
    const occurrences = src.match(/brandMismatchBanner\(/g) ?? [];
    // One definition + two render sites.
    expect(occurrences.length).toBe(3);
  });
});

describe("the address it re-analyses can be corrected", () => {
  const page = () => readFileSync("client/src/pages/BrandBrain.tsx", "utf8");

  it("does not re-run the stored URL blindly", () => {
    // The load-bearing one. "Analyser på nytt" called runAnalyze(profile.websiteUrl),
    // so a Merkehjerne built from the wrong site could only ever be rebuilt from
    // the wrong site — and the mismatch banner's single instruction ("analyse the
    // right address") was impossible to follow.
    expect(page()).not.toMatch(/runAnalyze\(profile\.websiteUrl\)/);
  });

  it("offers an editable address prefilled from the profile", () => {
    const src = page();
    expect(src).toContain("reanalyzeUrl");
    expect(src).toMatch(/runAnalyze\(reanalyzeUrl\)/);
    // Prefilled, because seeing the wrong address is what tells the user it is wrong.
    expect(src).toMatch(/setReanalyzeUrl\(profile\.websiteUrl\)/);
  });

  it("refuses to submit an empty address", () => {
    expect(page()).toMatch(/!reanalyzeUrl\.trim\(\) \|\| analyze\.isPending/);
  });
});
