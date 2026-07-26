import { describe, it, expect } from "vitest";
import {
  SIMPLE_NAV, ADVANCED_SECTIONS, navForMode, isNavItemActive,
} from "./navItems";

/**
 * Guards for the app shell navigation (Batch 1).
 *
 * The point of these tests is regression safety, not coverage theatre: Enkel
 * must stay at exactly the six approved destinations, and Avansert must not
 * silently lose one.
 */
describe("navForMode — Enkel", () => {
  it("shows exactly the six approved destinations, in order", () => {
    const sections = navForMode("simple", { enkelPlanEnabled: true });
    expect(sections).toHaveLength(1);
    expect(sections[0]!.items.map((i) => i.href)).toEqual([
      "/dashboard", "/generer", "/innholdsplan", "/innlegg", "/analytics", "/merkehjerne",
    ]);
  });

  it("hides the Enkel-plan destinations when the plan flag is off", () => {
    const hrefs = navForMode("simple", { enkelPlanEnabled: false })
      .flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).not.toContain("/innholdsplan");
    expect(hrefs).not.toContain("/lag-plan");
    // The rest survive — turning the plan flag off must not empty the sidebar.
    expect(hrefs).toEqual(["/dashboard", "/generer", "/innlegg", "/analytics", "/merkehjerne"]);
  });
});

describe("navForMode — Avansert", () => {
  const advancedHrefs = () =>
    navForMode("advanced", { enkelPlanEnabled: true }).flatMap((s) => s.items.map((i) => i.href));

  /**
   * Every destination the old sidebar offered. If a future edit drops one of
   * these from ADVANCED_SECTIONS, this test fails.
   */
  const MUST_KEEP = [
    "/dashboard", "/generer", "/innlegg",
    "/lag-plan", "/innholdsplan", "/kalender", "/beste-tid", "/gjenbruk",
    "/innholdsserier", "/ide-bank",
    "/trender", "/eksempler",
    "/merkehjerne", "/stemme", "/coach",
    "/telegram-bot", "/telegram-innlegg", "/konkurrent-radar",
    "/ab-testing", "/ukentlig-rapport", "/engasjement-hjelper",
  ];

  it("keeps every destination the previous sidebar had", () => {
    const hrefs = advancedHrefs();
    for (const href of MUST_KEEP) expect(hrefs).toContain(href);
  });

  it("is a superset of Enkel", () => {
    const hrefs = advancedHrefs();
    for (const item of SIMPLE_NAV) expect(hrefs).toContain(item.href);
  });

  it("keeps advanced-only tools OUT of Enkel", () => {
    const simple = new Set(
      navForMode("simple", { enkelPlanEnabled: true }).flatMap((s) => s.items.map((i) => i.href)),
    );
    const ADVANCED_ONLY = [
      "/lag-plan", "/kalender", "/beste-tid", "/gjenbruk", "/innholdsserier",
      "/ide-bank", "/trender", "/eksempler", "/stemme", "/coach",
      "/telegram-bot", "/telegram-innlegg", "/konkurrent-radar",
      "/ab-testing", "/ukentlig-rapport", "/engasjement-hjelper",
    ];
    for (const href of ADVANCED_ONLY) expect(simple.has(href)).toBe(false);
    // ...and they are all still reachable in Avansert.
    const advanced = new Set(advancedHrefs());
    for (const href of ADVANCED_ONLY) expect(advanced.has(href)).toBe(true);
  });

  it("has no duplicate destinations", () => {
    const hrefs = advancedHrefs();
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("drops empty sections rather than rendering a bare heading", () => {
    const sections = navForMode("advanced", { enkelPlanEnabled: false });
    expect(sections.every((s) => s.items.length > 0)).toBe(true);
  });
});

describe("isNavItemActive", () => {
  it("matches /dashboard exactly so it does not stay lit elsewhere", () => {
    expect(isNavItemActive("/dashboard", "/dashboard")).toBe(true);
    expect(isNavItemActive("/dashboard", "/dashboard/extra")).toBe(false);
  });

  it("matches by prefix for sub-routes", () => {
    expect(isNavItemActive("/innlegg", "/innlegg/42")).toBe(true);
    expect(isNavItemActive("/innlegg", "/innholdsplan")).toBe(false);
  });
});

describe("structure", () => {
  it("every item has a label, an href and an icon", () => {
    const all = [...SIMPLE_NAV, ...ADVANCED_SECTIONS.flatMap((s) => s.items)];
    for (const item of all) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.href.startsWith("/")).toBe(true);
      expect(item.icon).toBeTruthy();
    }
  });
});
