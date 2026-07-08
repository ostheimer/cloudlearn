import { refundLp } from "@/services/lpService";
import { logError, logInfo } from "@/lib/observability";

/**
 * Best-effort LP refund for routes that charge LP up front (spend_lp) and only
 * then run the work that can fail. On failure the caller invokes this to give
 * the LP back before re-throwing the original error.
 *
 * Two deliberate design choices:
 *  - `cost <= 0` is a no-op: a zero-cost feature never charged anything.
 *  - a failing refund is logged and swallowed, never re-thrown. The caller is
 *    already unwinding a processing error; that original error (e.g. 422
 *    PDF_TEXT_NOT_FOUND) is what the user needs to see. A masked refund failure
 *    would hide the real cause — instead we log it so it can be reconciled.
 */
export async function refundOnFailure(
  userId: string,
  cost: number,
  reason: string,
  requestId: string
): Promise<void> {
  if (cost <= 0) return;

  try {
    const newBalance = await refundLp(userId, cost, reason);
    logInfo("lp_refunded", { requestId, userId, reason, lpRefunded: cost, lpBalance: newBalance });
  } catch (refundError) {
    const message = refundError instanceof Error ? refundError.message : String(refundError);
    logError("lp_refund_failed", {
      requestId,
      userId,
      reason,
      lpToRefund: cost,
      message,
    });
  }
}
