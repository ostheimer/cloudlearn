import { getIdempotentResult } from "@/lib/idempotencyStore";
import { refundOnFailure } from "@/lib/lpRefund";
import type { SubscriptionTier } from "@/lib/contracts";
import { getLpProfile, spendLp } from "@/services/lpService";

type LpFeature = "aiScan" | "urlImport" | "pdfImport";

export interface LpRequestUsage {
  lpSpent: number;
  lpBalance: number;
}

export type LpChargedIdempotentResult<T> =
  | { kind: "ok"; result: T; usage: LpRequestUsage }
  | { kind: "insufficient_lp"; usage: LpRequestUsage };

/**
 * Charges LP for a paid import/scan only after confirming the idempotency key
 * has no cached result. Retries with the same key must not debit LP again.
 */
export async function runLpChargedIdempotentRequest<T>(params: {
  idempotencyKey: string | undefined;
  userId: string;
  plan: SubscriptionTier;
  feature: LpFeature;
  requestId: string;
  refundReason: string;
  process: () => Promise<T>;
}): Promise<LpChargedIdempotentResult<T>> {
  const { idempotencyKey, userId, plan, feature, requestId, refundReason, process } = params;

  if (idempotencyKey) {
    const cached = await getIdempotentResult<T>(idempotencyKey);
    if (cached) {
      const profile = await getLpProfile(userId);
      return {
        kind: "ok",
        result: cached,
        usage: { lpSpent: 0, lpBalance: profile.balance },
      };
    }
  }

  const lpResult = await spendLp(userId, plan, feature);
  if (!lpResult.allowed) {
    return {
      kind: "insufficient_lp",
      usage: { lpSpent: 0, lpBalance: lpResult.newBalance },
    };
  }

  try {
    const result = await process();
    return {
      kind: "ok",
      result,
      usage: { lpSpent: lpResult.cost, lpBalance: lpResult.newBalance },
    };
  } catch (error) {
    await refundOnFailure(userId, lpResult.cost, refundReason, requestId);
    throw error;
  }
}
