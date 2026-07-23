import { describe, it, expect } from "vitest";
import { stripMarkdownEmphasis } from "./openaiService";

describe("stripMarkdownEmphasis", () => {
  it("removes ** bold markers but keeps the words", () => {
    expect(stripMarkdownEmphasis("**Store dagen** fortjener farger!")).toBe("Store dagen fortjener farger!");
    expect(stripMarkdownEmphasis("Vi tilbyr ***rask*** levering")).toBe("Vi tilbyr rask levering");
    expect(stripMarkdownEmphasis("__viktig__ og vanlig")).toBe("viktig og vanlig");
  });
  it("removes stray/unbalanced markers", () => {
    expect(stripMarkdownEmphasis("halv **ferdig")).toBe("halv ferdig");
  });
  it("preserves hashtags, single * and emojis", () => {
    expect(stripMarkdownEmphasis("🎈 Feiring! #ballonger #fest")).toBe("🎈 Feiring! #ballonger #fest");
    expect(stripMarkdownEmphasis("3 * 5 = 15")).toBe("3 * 5 = 15");
  });
});
