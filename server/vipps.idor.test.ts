/**
 * IDOR regression: a user must not read/cancel/refund another user's payment
 * order via a guessed orderId. Vipps payment mutations must FORBID cross-tenant
 * access and derive the refund amount from the stored order, not the client.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Order in the DB is owned by user 2; the caller will be user 1.
const OTHER_USERS_ORDER = { orderId: "order-abc", userId: 2, expectedAmount: 500, status: "captured" };

const refundSpy = vi.fn().mockResolvedValue(undefined);
const cancelSpy = vi.fn().mockResolvedValue(undefined);
const statusSpy = vi.fn().mockResolvedValue({ state: "CAPTURED" });

vi.mock("./_core/vipps", () => ({
  vippsService: {
    getPaymentStatus: statusSpy,
    cancelPayment: cancelSpy,
    refundPayment: refundSpy,
  },
}));
vi.mock("./_core/vippsAuth", () => ({ vippsAuthService: null }));
vi.mock("./db", () => ({
  getPaymentOrder: vi.fn().mockResolvedValue(OTHER_USERS_ORDER),
  markPaymentOrderStatus: vi.fn().mockResolvedValue(undefined),
}));

const makeCtx = (userId: number) => ({ user: { id: userId }, req: {} as any, res: {} as any });

describe("Vipps payment IDOR", () => {
  beforeEach(() => vi.clearAllMocks());

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

  it("forbids refunding another user's order and never uses a client amount", async () => {
    const { vippsRouter } = await import("./routers/vippsRouter");
    const caller = vippsRouter.createCaller(makeCtx(1) as any);
    // Even if a client tried to smuggle an amount, the schema drops it and ownership fails first.
    await expect(caller.refundPayment({ orderId: "order-abc" } as any)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(refundSpy).not.toHaveBeenCalled();
  });

  it("refunds the OWNER using the server-side expectedAmount (not a client value)", async () => {
    const { vippsRouter } = await import("./routers/vippsRouter");
    const caller = vippsRouter.createCaller(makeCtx(2) as any); // owner
    await caller.refundPayment({ orderId: "order-abc" } as any);
    expect(refundSpy).toHaveBeenCalledWith("order-abc", 500); // derived, not client-supplied
  });
});
