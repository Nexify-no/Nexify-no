import { describe, expect, it } from "vitest";
import { isUnsafeAddress, normalizeWebsiteUrl } from "./brandCrawler";

describe("brandCrawler URL safety", () => {
  it("adds https to a normal domain", () => expect(normalizeWebsiteUrl("native.no").href).toBe("https://native.no/"));
  it("blocks unsupported protocols", () => expect(() => normalizeWebsiteUrl("file:///etc/passwd")).toThrow());
  it("detects private IPv4 ranges", () => {
    expect(isUnsafeAddress("127.0.0.1")).toBe(true);
    expect(isUnsafeAddress("10.1.2.3")).toBe(true);
    expect(isUnsafeAddress("192.168.1.1")).toBe(true);
    expect(isUnsafeAddress("8.8.8.8")).toBe(false);
  });
  it("detects private IPv6 ranges", () => {
    expect(isUnsafeAddress("::1")).toBe(true);
    expect(isUnsafeAddress("fd00::1")).toBe(true);
    expect(isUnsafeAddress("2606:4700:4700::1111")).toBe(false);
  });
});
