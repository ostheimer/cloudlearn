import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { claimMilestoneReward } from "@/services/lpService";
import { milestoneKeySchema } from "@/lib/contracts";
import { z } from "zod";

const bodySchema = z.object({
  milestone: milestoneKeySchema,
});

// POST /api/v1/lp/milestone — claim a one-time milestone reward (idempotent).
//
// Bleibt bestehen, ist aber seit #637 nicht mehr der einzige Weg: der Server
// löst dieselben Meilensteine selbst ein, sobald sie entstehen. Ausgelieferte
// App-Versionen rufen hier weiter an und bekommen dann `alreadyClaimed` — die
// Gutschrift ist einmalig, egal wer zuerst fragt.
export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(requestId, "VALIDATION_ERROR", parsed.error.message, 400);
    }

    const result = await claimMilestoneReward(auth.userId, parsed.data.milestone);
    return jsonOk(requestId, result);
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
