import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * Multi-brand regression guard (MB1).
 *
 * Every new post must belong to exactly one brand, otherwise it shows up under
 * ALL brands in the sidebar. `db.createPost()` stamps the active brand for us,
 * but a raw `db.insert(posts)` bypasses that — which is exactly how three leaks
 * (postManagementService, telegramWebhook, telegramRouter) got in.
 *
 * This test fails if anyone adds a raw insert into `posts` without a `brandId`.
 */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".ts") && !p.includes(".test.")) out.push(p);
  }
  return out;
}

describe("multi-brand: every post insert is brand-stamped", () => {
  it("no raw insert(posts) omits brandId", () => {
    const offenders: string[] = [];

    for (const file of walk("server")) {
      const src = readFileSync(file, "utf8");
      let idx = src.indexOf("insert(posts)");
      while (idx !== -1) {
        // Look at the ~600 chars of the values({...}) block that follows.
        const window = src.slice(idx, idx + 600);
        // db.ts builds `values` separately and stamps the brand there.
        const stamped = window.includes("brandId") || window.includes(".values(values)");
        if (!stamped) offenders.push(`${file} @${idx}`);
        idx = src.indexOf("insert(posts)", idx + 1);
      }
    }

    expect(offenders).toEqual([]);
  });
});
