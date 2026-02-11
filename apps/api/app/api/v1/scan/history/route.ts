import { type NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";

export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return jsonError(requestId, "MISSING_USER", "userId is required", 400);
  }

  return jsonOk(requestId, {
    requestId,
    userId,
    history: []
  });
}
