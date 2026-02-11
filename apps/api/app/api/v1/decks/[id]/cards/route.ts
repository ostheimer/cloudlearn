import { type NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { listCardsInDeck } from "@/services/deckService";

const querySchema = z.object({ userId: z.string().uuid() });

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const { id } = await params;
    const query = querySchema.parse({
      userId: request.nextUrl.searchParams.get("userId")
    });
    const cards = listCardsInDeck(query.userId, id);
    return jsonOk(requestId, { requestId, cards });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
