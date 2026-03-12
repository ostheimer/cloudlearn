import { z } from "zod";
import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { LP_PACKS } from "@/lib/featureGates";
import { grantLpPurchase } from "@/services/lpService";
import { createSupabaseAdminClient } from "@/lib/supabase";

const purchaseRequestSchema = z.object({
  packId: z.string().min(1).max(50),
  transactionId: z.string().min(1).max(255),
});

// Check if this transaction was already processed (idempotency via lp_transactions reason field)
async function isTransactionAlreadyProcessed(transactionId: string): Promise<boolean> {
  const db = createSupabaseAdminClient();
  if (!db) return false;

  const { data } = await db
    .from("lp_transactions")
    .select("id")
    .eq("reason", `purchase_${transactionId}`)
    .maybeSingle();

  return Boolean(data);
}

export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const body = purchaseRequestSchema.safeParse(await request.json());
    if (!body.success) {
      return jsonError(requestId, "INVALID_REQUEST", body.error.message, 400);
    }

    const { packId, transactionId } = body.data;

    const pack = LP_PACKS[packId];
    if (!pack) {
      return jsonError(requestId, "INVALID_PACK", `Unknown pack: ${packId}`, 400);
    }

    // Idempotency: reject duplicate transactions
    const alreadyProcessed = await isTransactionAlreadyProcessed(transactionId);
    if (alreadyProcessed) {
      const db = createSupabaseAdminClient();
      const { data } = await db!
        .from("profiles")
        .select("lp_balance")
        .eq("id", auth.userId)
        .maybeSingle();
      return jsonOk(requestId, {
        lpGranted: 0,
        newBalance: data?.lp_balance ?? 0,
        alreadyProcessed: true,
      });
    }

    const newBalance = await grantLpPurchase(auth.userId, pack.lp, `purchase_${transactionId}`);

    return jsonOk(requestId, {
      lpGranted: pack.lp,
      newBalance,
      alreadyProcessed: false,
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
