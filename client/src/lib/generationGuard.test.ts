/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */
import { describe, it, expect } from "vitest";
import { createGenerationGuard } from "./generationGuard";

/**
 * A minimal simulator that mirrors how Generate.tsx applies a result: it only
 * writes into shared state when the response still belongs to the active
 * generation. Used to prove text/image never cross between operations.
 */
type Shared = { text: string | null; image: string | null; postId: number | null };

function applyIfCurrent(
  guard: ReturnType<typeof createGenerationGuard>,
  genId: number,
  shared: Shared,
  result: { text?: string; image?: string; postId?: number },
) {
  if (!guard.isCurrent(genId)) return; // late/out-of-order response -> dropped
  if (result.text !== undefined) shared.text = result.text;
  if (result.image !== undefined) shared.image = result.image;
  if (result.postId !== undefined) shared.postId = result.postId;
}

describe("generationGuard", () => {
  it("monotonic ids; only the latest is current", () => {
    const g = createGenerationGuard();
    expect(g.current).toBe(0);
    const a = g.start();
    const b = g.start();
    expect(a).toBe(1);
    expect(b).toBe(2);
    expect(g.isCurrent(a)).toBe(false);
    expect(g.isCurrent(b)).toBe(true);
    expect(g.current).toBe(2);
  });

  it("sequential: the newer generation wins", () => {
    const g = createGenerationGuard();
    const shared: Shared = { text: null, image: null, postId: null };

    const first = g.start();
    applyIfCurrent(g, first, shared, { text: "A", image: "imgA", postId: 1 });
    expect(shared).toEqual({ text: "A", image: "imgA", postId: 1 });

    const second = g.start();
    applyIfCurrent(g, second, shared, { text: "B", image: "imgB", postId: 2 });
    expect(shared).toEqual({ text: "B", image: "imgB", postId: 2 });
  });

  it("parallel out-of-order: stale response cannot overwrite the active one", () => {
    const g = createGenerationGuard();
    const shared: Shared = { text: null, image: null, postId: null };

    const first = g.start(); // user fires generation #1
    const second = g.start(); // then quickly fires #2 (invalidates #1)

    // #2 resolves first
    applyIfCurrent(g, second, shared, { text: "B", image: "imgB", postId: 2 });
    // #1 resolves LATE — must be ignored, no bleed of old text/image
    applyIfCurrent(g, first, shared, { text: "A", image: "imgA", postId: 1 });

    expect(shared).toEqual({ text: "B", image: "imgB", postId: 2 });
  });

  it("late image from a previous generation never attaches to the new post", () => {
    const g = createGenerationGuard();
    const shared: Shared = { text: null, image: null, postId: null };

    const first = g.start();
    applyIfCurrent(g, first, shared, { text: "A", postId: 1 });

    const second = g.start();
    applyIfCurrent(g, second, shared, { text: "B", postId: 2 });

    // image generation for post #1 resolves after #2 already active -> dropped
    applyIfCurrent(g, first, shared, { image: "imgA" });

    expect(shared.image).toBeNull();
    expect(shared.postId).toBe(2);
  });
});
