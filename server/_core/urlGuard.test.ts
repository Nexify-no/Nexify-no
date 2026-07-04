/**
 * SSRF guard: internal/metadata targets must be rejected before any network call.
 */
import { describe, it, expect } from "vitest";
import { assertPublicUrl, isBlockedIp, isStructurallyBlockedUrl } from "./urlGuard";

describe("urlGuard SSRF protection", () => {
  it("rejects the cloud metadata IP 169.254.169.254", async () => {
    await expect(assertPublicUrl("http://169.254.169.254/latest/meta-data/")).rejects.toBeTruthy();
    expect(isStructurallyBlockedUrl("http://169.254.169.254/")).toBe(true);
  });

  it("blocks loopback, RFC1918, CGNAT and IPv6 internal ranges", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "172.16.9.9", "192.168.1.1", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:169.254.169.254"]) {
      expect(isBlockedIp(ip)).toBe(true);
    }
  });

  it("allows normal public IPs and rejects non-http(s) schemes", () => {
    expect(isBlockedIp("8.8.8.8")).toBe(false);
    expect(isStructurallyBlockedUrl("ftp://example.com")).toBe(true);
    expect(isStructurallyBlockedUrl("http://localhost/")).toBe(true);
  });
});
