import { type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext, logError, logInfo } from "@/lib/observability";
import { checkRateLimit } from "@/lib/rateLimit";
import { getAuthUser } from "@/lib/auth";
import { saveImportedCards } from "@/services/importSaveService";
import { getSubscriptionStatus } from "@/services/subscriptionService";

/**
 * Speichert Karten, die zuvor mit `preview: true` erzeugt wurden (#427).
 *
 * Anders als die Import-Routen daneben läuft das NICHT über
 * `runLpChargedIdempotentRequest`: Bezahlt wurde beim Erzeugen. Ein zweiter
 * Abzug fürs Ablegen wäre doppelt kassiert. Die Idempotenz sitzt deshalb im
 * Dienst selbst — sie verhindert hier doppelte Karten, keine Doppelabbuchung.
 */
export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const body = await request.json();
    body.userId = auth.userId;
    const userId = auth.userId;

    const { tier: plan } = await getSubscriptionStatus(userId);
    const env = getEnv();
    const rateLimit =
      plan === "pro" ? env.RATE_LIMIT_PRO_PER_MINUTE : env.RATE_LIMIT_FREE_PER_MINUTE;
    if (!(await checkRateLimit(`${userId}:${plan}`, rateLimit))) {
      return jsonError(requestId, "RATE_LIMITED", "Rate limit exceeded", 429);
    }

    const result = await saveImportedCards(body, requestId, userId);

    logInfo("import_saved", {
      requestId,
      userId,
      deckId: result.deckId,
      cards: result.savedCount,
      // Weichen die beiden ab, hat die Tarifgrenze ausgedünnt (#411).
      cardsOffered: result.generatedCount,
    });

    return jsonOk(requestId, result, 201);
  } catch (error) {
    const normalized = normalizeError(error);
    logError("import_save_failed", { requestId, code: normalized.code });
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
