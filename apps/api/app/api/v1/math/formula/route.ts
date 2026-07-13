import { type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { canProcessMathpix, consumeMathpixCost, getMathpixSpend } from "@/services/mathpixService";

const requestSchema = z.object({
  imageUrl: z.string().url()
});

export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    requestSchema.parse(await request.json());
    if (!(await canProcessMathpix(auth.userId))) {
      return jsonError(requestId, "MATHPIX_BUDGET_EXCEEDED", "Mathpix budget exceeded", 402);
    }

    const spentUsd = await consumeMathpixCost(auth.userId);
    return jsonOk(
      requestId,
      {
        requestId,
        latex: "\\\\text{mock-formula}",
        spentUsd,
        totalSpendUsd: await getMathpixSpend(auth.userId)
      },
      201
    );
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
