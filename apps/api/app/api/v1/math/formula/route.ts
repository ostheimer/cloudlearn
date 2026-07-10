import { type NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { canProcessMathpix, consumeMathpixCost, getMathpixSpend } from "@/services/mathpixService";

const requestSchema = z.object({
  userId: z.string().uuid(),
  imageUrl: z.string().url()
});

export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const parsed = requestSchema.parse(await request.json());
    if (!(await canProcessMathpix(parsed.userId))) {
      return jsonError(requestId, "MATHPIX_BUDGET_EXCEEDED", "Mathpix budget exceeded", 402);
    }

    const spentUsd = await consumeMathpixCost(parsed.userId);
    return jsonOk(
      requestId,
      {
        requestId,
        latex: "\\\\text{mock-formula}",
        spentUsd,
        totalSpendUsd: await getMathpixSpend(parsed.userId)
      },
      201
    );
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
