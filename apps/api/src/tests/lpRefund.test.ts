/**
 * Unit tests for refundOnFailure — the best-effort LP refund helper used by the
 * import/scan routes after processing fails. Covers the three behaviours that
 * make it safe for a real-money balance:
 *   1. it skips zero-cost charges,
 *   2. it credits the LP back and logs it on the happy path,
 *   3. a failing refund is swallowed (never re-thrown) so it can't mask the
 *      original processing error the route is unwinding.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { refundOnFailure } from "@/lib/lpRefund";
import { refundLp } from "@/services/lpService";
import { logError, logInfo } from "@/lib/observability";

vi.mock("@/services/lpService", () => ({
  refundLp: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

const mockedRefundLp = vi.mocked(refundLp);
const mockedLogInfo = vi.mocked(logInfo);
const mockedLogError = vi.mocked(logError);

describe("refundOnFailure", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does nothing for a zero-cost charge", async () => {
    await refundOnFailure("user-1", 0, "refund_pdfImport_failed", "req-1");

    expect(mockedRefundLp).not.toHaveBeenCalled();
    expect(mockedLogInfo).not.toHaveBeenCalled();
    expect(mockedLogError).not.toHaveBeenCalled();
  });

  it("credits the LP back and logs the refund on success", async () => {
    mockedRefundLp.mockResolvedValue(30);

    await refundOnFailure("user-1", 20, "refund_pdfImport_failed", "req-1");

    expect(mockedRefundLp).toHaveBeenCalledWith("user-1", 20, "refund_pdfImport_failed");
    expect(mockedLogInfo).toHaveBeenCalledWith(
      "lp_refunded",
      expect.objectContaining({
        requestId: "req-1",
        userId: "user-1",
        reason: "refund_pdfImport_failed",
        lpRefunded: 20,
        lpBalance: 30,
      })
    );
    expect(mockedLogError).not.toHaveBeenCalled();
  });

  it("swallows a failing refund and logs it instead of throwing", async () => {
    mockedRefundLp.mockRejectedValue(new Error("db unreachable"));

    // Must resolve, not reject — the caller still needs to surface the ORIGINAL
    // processing error, not this secondary refund failure.
    await expect(
      refundOnFailure("user-1", 20, "refund_aiScan_failed", "req-2")
    ).resolves.toBeUndefined();

    expect(mockedLogError).toHaveBeenCalledWith(
      "lp_refund_failed",
      expect.objectContaining({
        requestId: "req-2",
        userId: "user-1",
        reason: "refund_aiScan_failed",
        lpToRefund: 20,
        message: "db unreachable",
      })
    );
    expect(mockedLogInfo).not.toHaveBeenCalled();
  });
});
