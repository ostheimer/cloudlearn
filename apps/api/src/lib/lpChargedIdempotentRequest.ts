import { randomUUID } from "node:crypto";
import { HttpError } from "./http";
import { claimAiRequest, completeAiRequest, releaseAiRequest, getIdempotentResult } from "@/lib/idempotencyStore";
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
  requestFingerprint?: string;
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

  if (!idempotencyKey) throw new HttpError("Ein Wiederholungsschlüssel ist erforderlich.", 422, "VALIDATION_ERROR");
  const owner = randomUUID();
  const claim = await claimAiRequest<T>(idempotencyKey, owner, params.requestFingerprint);
  if (claim.status === "in_progress") {
    throw new HttpError("Diese KI-Anfrage wird bereits verarbeitet. Bitte warte kurz und versuche es erneut.", 409, "AI_REQUEST_IN_PROGRESS");
  }
  if (claim.status === "complete") {
    const profile = await getLpProfile(userId);
    return { kind: "ok", result: claim.response, usage: { lpSpent: 0, lpBalance: profile.balance } };
  }

  let spent = 0;
  let processed = false;
  try {
    const lpResult = await spendLp(userId, plan, feature);
    if (!lpResult.allowed) {
      await releaseAiRequest(idempotencyKey, owner);
      return { kind: "insufficient_lp", usage: { lpSpent: 0, lpBalance: lpResult.newBalance } };
    }
    spent = lpResult.cost;
    const result = await process();
    processed = true;
    await completeAiRequest(idempotencyKey, owner, result);
    return { kind: "ok", result, usage: { lpSpent: lpResult.cost, lpBalance: lpResult.newBalance } };
  } catch (error) {
    // Once processing succeeded it may have saved cards already. Keep the claim
    // and charge on completion-store failure; a replay must never rerun that job.
    if (!processed) {
      if (spent > 0) await refundOnFailure(userId, spent, refundReason, requestId);
      await releaseAiRequest(idempotencyKey, owner);
    }
    throw error;
  }
}
