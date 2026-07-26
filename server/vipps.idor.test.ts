/**
 * IDOR regression: a user must not read/cancel/refund another user's payment
 * order via a guessed orderId. Vipps payment mutations must FORBID cross-tenant
 * access and derive the refund amount from the stored order, not the client.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Order in the DB is owned by user 2; the caller will be user 1.
const OTHER_USERS_ORDER = { orderId: "order-abc", userId: 2, expectedAmount: 500, status: "captured" };

const refundSpy = vi.fn();
const cancelSpy = vi.fn();
const statusSpy = vi.fn();

vi.mock("./_core/vipps", () => ({
  vippsService: {
    getPaymentStatus: statusSpy,
    cancelPayment: cancelSpy,
    refundPayment: refundSpy,
  },
}));
vi.mock("./_core/vippsAuth", () => ({ vippsAuthService: null }));
// Plain functions, not vi.fn().mockResolvedValue(): the suite runs with
// `mockReset: true`, so a resolved value configured at module scope is stripped
// before every test. getPaymentOrder then returned undefined, every ownership
// check failed, and the three "must be FORBIDDEN" cases passed for the wrong
// reason while the owner case — the one that proves the amount is server-side —
// failed with "Order not found or not yours".
vi.mock("./db", () => ({
  getPaymentOrder: async () => OTHER_USERS_ORDER,
  markPaymentOrderStatus: async () => undefined,
}));

const makeCtx = (userId: number) => ({ user: { id: userId }, req: {} as any, res: {} as any });

describe("Vipps payment IDOR", () => {
  // Spy implementations must be (re-)installed per test, after mockReset.
  beforeEach(() => {
    refundSpy.mockResolvedValue(undefined);
    cancelSpy.mockResolvedValue(undefined);
    statusSpy.mockResolvedValue({ state: "CAPTURED" });
  });

  it("forbids reading another user's order", async () => {
    const { vippsRouter } = await import("./routers/vippsRouter");
    const caller = vippsRouter.createCaller(makeCtx(1) as any);
    await expect(caller.getPaymentStatus({ orderId: "order-abc" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(statusSpy).not.toHaveBeenCalled();
  });

  it("forbids cancelling another user's order", async () => {
    const { vippsRouter } = await import("./routers/vippsRouter");
    const caller = vippsRouter.createCaller(makeCtx(1) as any);
    await expect(caller.cancelPayment({ orderId: "order-abc" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(cancelSpy).not.toHaveBeenCalled();
  });

  it("forbids refunding another user's order", async () => {
    const { vippsRouter } = await import("./routers/vippsRouter");
    const caller = vippsRouter.createCaller(makeCtx(1) as any);
    await expect(caller.refundPayment({ orderId: "order-abc" } as any)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(refundSpy).not.toHaveBeenCalled();
  });

  it("ignores an amount smuggled in by the client", async () => {
    // The input schema drops unknown keys, and the amount is read from the stored
    // order — so a caller cannot inflate their own refund. Called as the OWNER,
    // because as a non-owner ownership fails first and proves nothing about this.
    const { vippsRouter } = await import("./routers/vippsRouter");
    const caller = vippsRouter.createCaller(makeCtx(2) as any);
    await caller.refundPayment({ orderId: "order-abc", amount: 99999 } as any);
    expect(refundSpy).toHaveBeenCalledWith("order-abc", 500);
  });

  it("refunds the OWNER using the server-side expectedAmount (not a client value)", async () => {
    const { vippsRouter } = await import("./routers/vippsRouter");
    const caller = vippsRouter.createCaller(makeCtx(2) as any); // owner
    await caller.refundPayment({ orderId: "order-abc" } as any);
    expect(refundSpy).toHaveBeenCalledWith("order-abc", 500); // derived, not client-supplied
  });
});
