import { type NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getDueCards } from "@/services/learnService";

const querySchema = z.object({ userId: z.string().uuid() });

export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const query = querySchema.parse({
      userId: request.nextUrl.searchParams.get("userId")
    });
    const cards = getDueCards(query.userId);
    return jsonOk(requestId, { requestId, cards });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
