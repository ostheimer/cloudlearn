import { type NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { exportDeckAsApkg } from "@/services/ankiExportService";

const requestSchema = z.object({
  deckId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const parsed = requestSchema.parse(await request.json());
    const file = await exportDeckAsApkg(auth.userId, parsed.deckId);
    return jsonOk(requestId, { requestId, file }, 201);
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
