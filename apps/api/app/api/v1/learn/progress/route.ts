import { z } from "zod";
import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import {
  clearSessionProgress,
  getSessionProgress,
  saveSessionProgress,
  type SessionProgressMode,
} from "@/lib/db";

/**
 * Der „Weitermachen"-Merker einer unterbrochenen Lern-Runde, am Konto statt am
 * Gerät (#610). Ohne ihn begann der Laptop eine am Handy unterbrochene Runde
 * wieder bei Karte 1 und bewertete die schon beantworteten Karten ein zweites
 * Mal — was ihre Wiederhol-Planung verstellt.
 *
 * Die Clients behalten ihren lokalen Merker: Er ist sofort da und funktioniert
 * ohne Netz. Der Server ist die gemeinsame Sicht; welcher der beiden zählt,
 * entscheiden die Clients über den Zeitstempel (der neuere gewinnt).
 */

const modeSchema = z.enum(["flashcards", "cloze"]);

const storedResultSchema = z.object({
  correct: z.boolean(),
  overridden: z.boolean(),
});

const saveSchema = z.object({
  deckId: z.string().uuid(),
  mode: modeSchema,
  index: z.number().int().min(0),
  cardId: z.string().uuid(),
  source: z.string().min(1).max(40),
  reverse: z.boolean(),
  total: z.number().int().min(1),
  // Nur die Ausgänge, keine getippten Antworten — die Auswertung braucht mehr
  // nicht, und was nicht übertragen wird, kann auch nicht verloren gehen.
  results: z.record(z.string().uuid(), storedResultSchema).optional(),
});

/** Position lesen: /api/v1/learn/progress?deckId=…&mode=flashcards */
export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const url = new URL(request.url);
    const deckId = url.searchParams.get("deckId") ?? "";
    const parsedMode = modeSchema.safeParse(url.searchParams.get("mode"));
    if (!z.string().uuid().safeParse(deckId).success || !parsedMode.success) {
      return jsonError(requestId, "INVALID_REQUEST", "deckId (uuid) and mode are required", 400);
    }

    const progress = await getSessionProgress(auth.userId, deckId, parsedMode.data);
    return jsonOk(requestId, { requestId, progress });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}

/** Position speichern (legt an oder überschreibt). */
export async function PUT(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const parsed = saveSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError(requestId, "INVALID_REQUEST", parsed.error.message, 400);
    const { deckId, mode, ...progress } = parsed.data;

    // Eine Position am oder hinter dem Ende ist eine fertige Runde, keine
    // fortsetzbare — die Tabelle lehnt sie ohnehin ab, hier gibt es dafür eine
    // verständliche Antwort statt eines Datenbankfehlers.
    if (progress.index >= progress.total) {
      return jsonError(requestId, "INVALID_REQUEST", "index must be below total", 400);
    }

    // Identität ist serverseitig: gespeichert wird für den Nutzer des Tokens,
    // nie für eine im Rumpf mitgeschickte userId.
    const { results, ...position } = progress;
    const saved = await saveSessionProgress(auth.userId, deckId, mode as SessionProgressMode, {
      ...position,
      // Nur setzen, wenn wirklich Ergebnisse dabei sind — ein ausdrückliches
      // `undefined` verträgt sich nicht mit exactOptionalPropertyTypes.
      ...(results ? { results } : {}),
    });
    if (!saved) return jsonError(requestId, "NOT_FOUND", "Deck not found", 404);

    return jsonOk(requestId, { requestId, saved: true });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}

/** Merker löschen: /api/v1/learn/progress?deckId=…&mode=cloze (Rundenende). */
export async function DELETE(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const url = new URL(request.url);
    const deckId = url.searchParams.get("deckId") ?? "";
    const parsedMode = modeSchema.safeParse(url.searchParams.get("mode"));
    if (!z.string().uuid().safeParse(deckId).success || !parsedMode.success) {
      return jsonError(requestId, "INVALID_REQUEST", "deckId (uuid) and mode are required", 400);
    }

    await clearSessionProgress(auth.userId, deckId, parsedMode.data);
    return jsonOk(requestId, { requestId, cleared: true });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
