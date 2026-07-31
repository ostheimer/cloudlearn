import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { listPushDevices } from "@/lib/db";

/**
 * GET /api/v1/push/devices — Geräte, auf denen die App Benachrichtigungen
 * registriert hat (#614, „Geräte-Übersicht im Profil").
 *
 * Nur Anzeige: Plattform, erstes und letztes Lebenszeichen. Der Push-Token
 * selbst bleibt in der Datenbank — er ist ein Zustellungs-Geheimnis und für die
 * Anzeige wertlos.
 *
 * Bewusst KEIN „Gerät abmelden": Das war Laras ausdrückliche Abgrenzung, und es
 * wäre auch mehr als eine Zeile — ein Token zu löschen beendet keine Sitzung,
 * es stellt nur die Benachrichtigungen ab. Ein Knopf „abmelden", der das Konto
 * gar nicht abmeldet, wäre eine Unwahrheit.
 */
export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const devices = await listPushDevices(auth.userId);
    return jsonOk(requestId, { requestId, devices });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
