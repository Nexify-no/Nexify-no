/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * A refusal the user cannot read is a bug, not a guard.
 *
 * Observed: four channels selected, publish pressed, nothing published, nothing
 * said. The guards were working — one of them almost certainly refused for a
 * reason the user could have fixed in ten seconds — but every message in
 * publishGuard was thrown as a plain `Error`, tRPC classified those as
 * INTERNAL_SERVER_ERROR, and server/_core/trpc.ts replaces the message of every
 * one of those in production with the literal string "Internal server error".
 *
 * So the product had carefully written Norwegian instructions that no user has
 * ever seen. These tests fail if that regresses.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { TRPCError } from "@trpc/server";

import { PublishBlockedError } from "./services/publishGuard";

const guardSource = () => readFileSync("server/services/publishGuard.ts", "utf8");

describe("the masking rule this works around still exists", () => {
  it("trpc.ts really does replace INTERNAL_SERVER_ERROR messages in production", () => {
    // If this ever stops being true, the reason for everything below is gone and
    // the workaround should be reconsidered rather than cargo-culted.
    const trpc = readFileSync("server/_core/trpc.ts", "utf8");
    expect(trpc).toMatch(/error\.code === "INTERNAL_SERVER_ERROR"/);
    expect(trpc).toMatch(/message: "Internal server error"/);
  });
});

describe("PublishBlockedError survives to the screen", () => {
  it("is a TRPCError, so its message is not masked", () => {
    const error = new PublishBlockedError("Kundehistorie uten dokumentert kilde.");
    expect(error).toBeInstanceOf(TRPCError);
  });

  it("carries a code that trpc.ts does not rewrite", () => {
    const error = new PublishBlockedError("x") as TRPCError;
    expect(error.code).toBe("PRECONDITION_FAILED");
    expect(error.code).not.toBe("INTERNAL_SERVER_ERROR");
  });

  it("keeps the message intact", () => {
    const why = "Fjern påstanden, eller legg den til som et faktum med kilde.";
    expect(new PublishBlockedError(why).message).toBe(why);
  });

  it("is still distinguishable from an incidental failure", () => {
    // assertContentIsPublishable catches everything and rethrows ONLY this, so a
    // network blip does not block a publish. Breaking instanceof would silently
    // turn every incidental error into a block.
    expect(new PublishBlockedError("x")).toBeInstanceOf(PublishBlockedError);
    expect(new TRPCError({ code: "PRECONDITION_FAILED", message: "x" })).not.toBeInstanceOf(
      PublishBlockedError,
    );
  });

  it("is named, so logs stay readable", () => {
    expect(new PublishBlockedError("x").name).toBe("PublishBlockedError");
  });
});

describe("no user-facing refusal is thrown as a bare Error", () => {
  it("publishGuard throws none", () => {
    // The load-bearing assertion: one `throw new Error("Koble til en konto først")`
    // is enough to put the user back in front of "Internal server error".
    expect(guardSource()).not.toMatch(/throw new Error\(/);
  });

  it("routes every refusal through the helper", () => {
    const src = guardSource();
    // Assert the CODE inside refuse(), not anywhere in the file — the class below
    // also carries PRECONDITION_FAILED, so a file-wide match passed even with
    // refuse() switched to INTERNAL_SERVER_ERROR.
    const helper = src.slice(
      src.indexOf("function refuse(message: string): never"),
      src.indexOf("function refuse(message: string): never") + 200,
    );
    expect(helper).toMatch(/code: "PRECONDITION_FAILED"/);
    expect(helper).not.toMatch(/INTERNAL_SERVER_ERROR/);
    // The messages that matter most, still reachable.
    expect(src).toContain("Koble til en konto først");
    expect(src).toContain("Dette innlegget er allerede publisert.");
  });

  it("linkedinRouter's publish preconditions are not bare Errors either", () => {
    const src = readFileSync("server/routers/linkedinRouter.ts", "utf8");
    expect(src).not.toMatch(/throw new Error\("Bedriftsside ikke tilkoblet/);
    expect(src).not.toMatch(/throw new Error\("Velg en merkevare/);
    expect(src).toContain("Bedriftsside ikke tilkoblet");
    expect(src).toContain("Velg en merkevare før du publiserer.");
  });
});

describe("editing a post retires the verdict that judged the old text", () => {
  const dbSource = () => readFileSync("server/db.ts", "utf8");

  /**
   * The `.set({...})` object only — comments stripped.
   *
   * Slicing the whole function body passed even with `verifiedAt: null` deleted,
   * because the comment explaining the field mentions it by name. A test that
   * matches its own documentation is not testing the code.
   */
  const updatePostSet = () => {
    const src = dbSource();
    const start = src.indexOf("export async function updatePost(");
    const body = src.slice(start, src.indexOf("\n}", start));
    const setStart = body.indexOf(".set({");
    const setBlock = body.slice(setStart, body.indexOf("})", setStart));
    return setBlock
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
  };

  it("clears the status, the issues and verifiedAt", () => {
    // Keeping them meant a user who removed the flagged claim still saw "Kan ikke
    // publiseres før dette er rettet" quoting words no longer in the post — an
    // instruction already followed, with no way to clear it.
    const body = updatePostSet();
    expect(body).toMatch(/verificationStatus: null/);
    expect(body).toMatch(/verificationIssues: \[\]/);
    expect(body).toMatch(/verifiedAt: null/);
  });

  it("does not mark the new text verified", () => {
    // Nothing has judged it. Claiming a pass is worse than the stale flag.
    expect(updatePostSet()).not.toMatch(/verificationStatus: "verified"/);
  });

  it("still writes the content", () => {
    expect(updatePostSet()).toMatch(/generatedContent: content/);
  });

  it("still scopes the update by owner", () => {
    // The WHERE lives outside .set(), so it is asserted against the function.
    const src = dbSource();
    const start = src.indexOf("export async function updatePost(");
    const body = src.slice(start, src.indexOf("\n}", start));
    expect(body).toMatch(/eq\(posts\.id, postId\), eq\(posts\.userId, userId\)/);
  });

  it("leaves verifiedAt null so needsRecheck re-judges it", async () => {
    const { needsRecheck } = await import("./services/verification/reverify");
    expect(needsRecheck(null)).toBe(true);
    expect(needsRecheck(undefined)).toBe(true);
  });
});
