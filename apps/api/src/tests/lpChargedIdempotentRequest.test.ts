/**
 * Regression: LP must not be spent when an idempotency key already has a cached
 * result (web/mobile retries rely on stable keys for "kein zweiter Abzug").
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/idempotencyStore", () => ({
  getIdempotentResult: vi.fn(),
}));

vi.mock("@/services/lpService", () => ({
  getLpProfile: vi.fn(),
  spendLp: vi.fn(),
}));

vi.mock("@/lib/lpRefund", () => ({
  refundOnFailure: vi.fn(),
}));

import { getIdempotentResult } from "@/lib/idempotencyStore";
import { refundOnFailure } from "@/lib/lpRefund";
import { runLpChargedIdempotentRequest } from "@/lib/lpChargedIdempotentRequest";
import { getLpProfile, spendLp } from "@/services/lpService";

const mockedGetIdempotentResult = vi.mocked(getIdempotentResult);
const mockedGetLpProfile = vi.mocked(getLpProfile);
const mockedSpendLp = vi.mocked(spendLp);
const mockedRefundOnFailure = vi.mocked(refundOnFailure);

const USER_ID = "22222222-2222-4222-8222-222222222222";
const cachedPayload = { requestId: "req-1", cards: [{ front: "q", back: "a" }] };

describe("runLpChargedIdempotentRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the cached result without spending LP on idempotent replay", async () => {
    mockedGetIdempotentResult.mockResolvedValue(cachedPayload);
    mockedGetLpProfile.mockResolvedValue({
      balance: 42,
      earnedToday: 0,
      adsToday: 0,
      lpPeriodStart: "2026-07-15",
    });

    const process = vi.fn();
    const outcome = await runLpChargedIdempotentRequest({
      idempotencyKey: "stable-key-12345678",
      userId: USER_ID,
      plan: "free",
      feature: "aiScan",
      requestId: "req-1",
      refundReason: "refund_aiScan_failed",
      process,
    });

    expect(outcome).toEqual({
      kind: "ok",
      result: cachedPayload,
      usage: { lpSpent: 0, lpBalance: 42 },
    });
    expect(mockedSpendLp).not.toHaveBeenCalled();
    expect(process).not.toHaveBeenCalled();
  });

  it("spends LP and runs processing on a cache miss", async () => {
    mockedGetIdempotentResult.mockResolvedValue(null);
    mockedSpendLp.mockResolvedValue({ allowed: true, newBalance: 90, cost: 10 });

    const fresh = { requestId: "req-2", cards: [] };
    const process = vi.fn().mockResolvedValue(fresh);

    const outcome = await runLpChargedIdempotentRequest({
      idempotencyKey: "new-key-12345678",
      userId: USER_ID,
      plan: "free",
      feature: "urlImport",
      requestId: "req-2",
      refundReason: "refund_urlImport_failed",
      process,
    });

    expect(outcome).toEqual({
      kind: "ok",
      result: fresh,
      usage: { lpSpent: 10, lpBalance: 90 },
    });
    expect(mockedSpendLp).toHaveBeenCalledWith(USER_ID, "free", "urlImport");
    expect(process).toHaveBeenCalledOnce();
  });

  it("refunds LP when processing throws after a cache miss", async () => {
    mockedGetIdempotentResult.mockResolvedValue(null);
    mockedSpendLp.mockResolvedValue({ allowed: true, newBalance: 80, cost: 20 });

    const process = vi.fn().mockRejectedValue(new Error("fetch failed"));

    await expect(
      runLpChargedIdempotentRequest({
        idempotencyKey: "fail-key-12345678",
        userId: USER_ID,
        plan: "pro",
        feature: "pdfImport",
        requestId: "req-3",
        refundReason: "refund_pdfImport_failed",
        process,
      })
    ).rejects.toThrow("fetch failed");

    expect(mockedRefundOnFailure).toHaveBeenCalledWith(
      USER_ID,
      20,
      "refund_pdfImport_failed",
      "req-3"
    );
  });

  it("returns insufficient_lp without calling process", async () => {
    mockedGetIdempotentResult.mockResolvedValue(null);
    mockedSpendLp.mockResolvedValue({ allowed: false, newBalance: 3, cost: 10 });

    const process = vi.fn();
    const outcome = await runLpChargedIdempotentRequest({
      idempotencyKey: "low-balance-key",
      userId: USER_ID,
      plan: "free",
      feature: "aiScan",
      requestId: "req-4",
      refundReason: "refund_aiScan_failed",
      process,
    });

    expect(outcome).toEqual({
      kind: "insufficient_lp",
      usage: { lpSpent: 0, lpBalance: 3 },
    });
    expect(process).not.toHaveBeenCalled();
  });
});
