import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

/**
 * Regression guard for the brands.list 500 that made the brand switcher vanish.
 *
 * `ensureDefaultBrand` adopts legacy rows on first use. Since migration 0089
 * brand_profiles carries UNIQUE(user_id, brand_id), so a blanket UPDATE of every
 * unstamped row throws ER_DUP_ENTRY as soon as an account has more than one
 * profile row — which repeated "Analyser på nytt" attempts produce. The endpoint
 * then 500s, and BrandSelector rendered nothing at all.
 *
 * The real query path needs a live MySQL, which this suite deliberately does not
 * have. So these tests pin the SHAPE of the code that must not come back: they
 * fail loudly if someone reintroduces the blanket update or removes the guards.
 */

const brandsSrc = readFileSync("server/services/brands.ts", "utf8");
const indexSrc = readFileSync("server/_core/index.ts", "utf8");

describe("legacy brand adoption", () => {
  it("never blanket-updates brand_profiles by brand_id IS NULL", () => {
    const blanket = /update\(brandProfiles\)[\s\S]{0,200}isNull\(brandProfiles\.brandId\)/;
    expect(brandsSrc).not.toMatch(blanket);
  });

  it("adopts a single brand_profiles row, scoped by its id", () => {
    expect(brandsSrc).toMatch(
      /update\(brandProfiles\)[\s\S]{0,120}eq\(brandProfiles\.id,\s*oldest\.id\)/,
    );
  });

  it("routes every adoption write through the guarded helper", () => {
    const guarded = brandsSrc.match(/await adopt\(/g) ?? [];
    expect(guarded.length).toBeGreaterThanOrEqual(7);
  });

  it("swallows adoption failures so one table cannot 500 the endpoint", () => {
    expect(brandsSrc).toMatch(/const adopt = async[\s\S]{0,500}catch/);
  });
});

describe("tRPC error observability", () => {
  it("logs internal server errors instead of dropping them", () => {
    expect(indexSrc).toMatch(/onError\(\{ error, path, type \}\)/);
    expect(indexSrc).toMatch(/INTERNAL_SERVER_ERROR/);
  });

  it("does not log the raw driver message (it echoes column values)", () => {
    expect(indexSrc).not.toMatch(/console\.error\([^)]*cause\?\.\s*message/);
  });
});
