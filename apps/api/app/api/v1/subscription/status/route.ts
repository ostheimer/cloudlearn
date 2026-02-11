import { type NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getSubscriptionStatus } from "@/services/subscriptionService";

const querySchema = z.object({ userId: z.string().uuid() });

export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const query = querySchema.parse({
      userId: request.nextUrl.searchParams.get("userId")
    });
    const status = getSubscriptionStatus(query.userId);
    return jsonOk(requestId, { requestId, status });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
