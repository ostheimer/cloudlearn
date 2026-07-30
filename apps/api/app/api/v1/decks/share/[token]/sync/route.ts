import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { previewSharedDeckSync, syncSharedDeck } from "@/services/sharedDeckSyncService";

interface Params {
  params: Promise<{ token: string }>;
}

/**
 * GET — „Hast du dieses Deck schon, und wie viele Karten wären neu?" (#614)
 *
 * Bewusst NICHT im öffentlichen `GET /decks/share/[token]`: die Antwort hängt
 * am Konto, und die öffentliche Route gibt absichtlich nichts Persönliches
 * preis. Ohne eigene Kopie kommt `existingDeck: null` — dann ist es eine ganz
 * normale Übernahme.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const { token } = await params;
    const preview = await previewSharedDeckSync(auth.userId, token);
    return jsonOk(requestId, { requestId, ...preview });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}

/**
 * POST — „Aktualisieren": die fehlenden Karten in die eigene Kopie legen.
 *
 * Nur Hinzufügen; nichts wird gelöscht oder überschrieben. `added` und
 * `skipped` sind die ehrlichen Zahlen — am Kartenlimit passt nicht alles.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const { token } = await params;
    const result = await syncSharedDeck(auth.userId, token);
    return jsonOk(requestId, { requestId, ...result });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
