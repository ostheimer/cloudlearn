import { syncRequestSchema, type SyncResponse } from "@/lib/contracts";
import { HttpError, normalizeError } from "@/lib/http";
import { logError, logInfo } from "@/lib/observability";
import { storeReview } from "./reviewService";

/**
 * Ist dieser Fehler vorübergehend — lohnt sich also ein späterer Versuch?
 *
 * Exakt dieselbe Grenze, die der DIREKTE Weg in der App längst zieht
 * (`!isApiError(error) || error.status >= 500`, learn.tsx): 5xx und alles ohne
 * erkennbaren Status gelten als vorübergehend, 4xx als endgültig.
 *
 * `normalizeError` ist die einzige Stelle im Server, die einen Fehler auf einen
 * Status abbildet: kaputte Daten -> 422, gelöschte Karte -> 404, ein
 * HttpError -> sein eigener Status, alles Unbekannte -> 500. Unbekannt zählt
 * damit als vorübergehend, und das ist die sichere Richtung: Im schlechtesten
 * Fall versuchen wir etwas erneut, das nie klappt — sichtbar, aber nichts geht
 * verloren. Andersherum wäre echte Lernarbeit unwiederbringlich weg (#418).
 */
function isTransientFailure(error: unknown): boolean {
  return normalizeError(error).status >= 500;
}

export async function syncOperations(
  input: unknown,
  requestId: string
): Promise<SyncResponse> {
  const parsed = syncRequestSchema.parse(input);
  const acceptedOperationIds: string[] = [];
  const rejectedOperationIds: string[] = [];
  const failedOperationIds: string[] = [];

  for (const operation of parsed.operations) {
    if (
      operation.operationType !== "review" ||
      !("idempotencyKey" in operation.payload)
    ) {
      // Endgültig: Ein Eintrag dieser Form wird auch beim zehnten Versuch nicht
      // zu einer Wiederholung.
      rejectedOperationIds.push(operation.operationId);
      continue;
    }

    try {
      await storeReview(
        {
          ...operation.payload,
          userId: parsed.userId,
        },
        requestId
      );
      acceptedOperationIds.push(operation.operationId);
    } catch (error) {
      if (isTransientFailure(error)) {
        failedOperationIds.push(operation.operationId);
        logError("sync_operation_transient_failure", {
          requestId,
          userId: parsed.userId,
          operationId: operation.operationId,
          message: normalizeError(error).message,
        });
      } else {
        rejectedOperationIds.push(operation.operationId);
        logInfo("sync_operation_rejected", {
          requestId,
          userId: parsed.userId,
          operationId: operation.operationId,
          status: normalizeError(error).status,
          message: normalizeError(error).message,
        });
      }
    }
  }

  // Rücksicht auf ALTE App-Builds (Rückwärtskompatibilität):
  //
  // Sie kennen nur accepted/rejected und löschen beides aus der Warteschlange.
  // Ein drittes Feld ignorieren sie — die Antwort bliebe bei ihnen für immer im
  // Zustand "unterwegs" liegen und würde nie wieder verschickt. Deshalb: Ist die
  // GANZE Sendung ausschließlich an vorübergehenden Fehlern gescheitert (nichts
  // angenommen, nichts endgültig abgelehnt), antworten wir mit einem Fehler auf
  // den ganzen Aufruf statt mit 201. Dann legt auch ein alter Build alles
  // zurück in die Warteschlange (restoreInFlight) und versucht es in 30 s
  // erneut — genau das Mittel, das die Route bei 429 schon benutzt.
  //
  // Nur bei "alles vorübergehend": Sobald etwas angenommen oder endgültig
  // abgelehnt wurde, muss der Client das erfahren, sonst schickte er
  // Angenommenes ewig erneut und ein endgültig kaputter Eintrag verstopfte die
  // Warteschlange für alles dahinter.
  if (
    failedOperationIds.length > 0 &&
    acceptedOperationIds.length === 0 &&
    rejectedOperationIds.length === 0
  ) {
    throw new HttpError(
      "Sync temporarily unavailable, retry later",
      503,
      "SYNC_UNAVAILABLE"
    );
  }

  return {
    requestId,
    acceptedOperationIds,
    rejectedOperationIds,
    failedOperationIds,
    serverTimestamp: new Date().toISOString(),
  };
}
