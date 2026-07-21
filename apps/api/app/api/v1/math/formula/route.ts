import { type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";

// Formel-Erkennung ist nicht angebunden (#425). Die Route hat nie einen echten
// Mathpix-Aufruf gemacht — sie gab die fest verdrahtete Zeichenkette
// "\\text{mock-formula}" zurück und belastete dabei über consumeMathpixCost()
// das echte, persistente Kostenkonto in `mathpix_usage`. Erfundene Daten für
// echtes Budget: der Aufrufer konnte nicht erkennen, dass nichts passiert ist.
//
// Bis Mathpix wirklich angebunden ist, antwortet die Route ehrlich mit 501 und
// verbraucht nichts. Die Absicherung drumherum bleibt absichtlich bestehen und
// wird NICHT mit dieser Route entfernt:
//   - `@/services/mathpixService` (Budget-Prüfung vor Verbrauch, #204/PR #221)
//   - die Tabelle `mathpix_usage` samt RPC `consume_mathpix_cost` und RLS
// Wer Mathpix anschließt, baut auf dieser Reihenfolge auf: canProcessMathpix()
// prüfen, HTTP-Aufruf machen, erst bei Erfolg consumeMathpixCost() buchen.
//
// Die Anmeldepflicht bleibt ebenfalls stehen, obwohl die Route nichts mehr tut:
// Vor #204 nahm sie die `userId` aus dem Anfrage-Körper, sodass jeder ein
// fremdes Budget leerräumen konnte. Der Regressionstest dazu bleibt dadurch
// scharf und schlägt an, falls die Anmeldung beim Anschließen vergessen wird.
export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);

  const auth = await getAuthUser(request);
  if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

  return jsonError(
    requestId,
    "MATH_FORMULA_NOT_IMPLEMENTED",
    "Formel-Erkennung ist noch nicht verfügbar. Diese Funktion ist nicht angebunden — es werden keine Kosten verbucht.",
    501
  );
}
