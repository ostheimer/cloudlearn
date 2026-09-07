/**
 * Der „Weitermachen"-Merker über beide Wege: dieses Gerät und das Konto (#610).
 * Gegenstück zu apps/web/src/lib/session-progress-sync.ts.
 *
 * Der lokale Merker bleibt, wie er war — er ist sofort da, funktioniert ohne
 * Netz und wird bei jedem Kartenwechsel geschrieben. Das Konto kommt dazu,
 * damit ein am Handy unterbrochener Stapel am Laptop weitergeht, statt dort
 * wieder bei Karte 1 zu beginnen und die ersten Karten doppelt zu bewerten.
 *
 * Alle Konto-Zugriffe sind best effort: Ohne Netz oder mit Serverfehler bleibt
 * es beim lokalen Stand. Ein Merker ist Komfort — er darf nie eine Runde oder
 * eine Bewertung kosten.
 *
 * Ans Konto wird NICHT bei jedem Kartenwechsel geschrieben (das wäre eine
 * Anfrage je Karte), sondern beim Verlassen der Runde: genau dann, wenn das
 * andere Gerät den Stand braucht.
 */

import {
  deleteServerProgress,
  getServerProgress,
  putServerProgress,
  type ServerProgressMode,
} from "../../lib/api";
import { pickNewerProgress } from "./progressMerge";
import {
  clearSessionProgress,
  loadSessionProgress,
  type ProgressMode,
  type SessionProgress,
} from "./sessionProgress";

// Hintergrund-Speichern und Rundenende müssen in Aufruf-Reihenfolge beim
// Konto ankommen: Ein später beendetes PUT darf kein DELETE rückgängig machen.
// Andere Decks und Lernarten warten nicht aufeinander.
const pendingAccountWrites = new Map<string, Promise<void>>();

function queueAccountWrite(
  deckId: string,
  mode: ProgressMode,
  write: () => Promise<void>
): Promise<void> {
  const key = `${deckId}:${mode}`;
  const pending = (pendingAccountWrites.get(key) ?? Promise.resolve())
    .then(write)
    .catch(() => { /* Konto-Sync bleibt best effort. */ });
  pendingAccountWrites.set(key, pending);
  void pending.then(() => {
    if (pendingAccountWrites.get(key) === pending) pendingAccountWrites.delete(key);
  });
  return pending;
}

/**
 * Den maßgeblichen Stand holen: lokal und aus dem Konto lesen, den neueren
 * nehmen. Der Aufrufer prüft danach wie bisher mit isProgressUsable, ob er zum
 * aktuellen Stapel passt.
 */
export async function loadBestProgress(
  deckId: string,
  mode: ProgressMode
): Promise<SessionProgress | null> {
  const local = await loadSessionProgress(deckId, mode);
  let server: SessionProgress | null = null;
  try {
    const remote = await getServerProgress(deckId, mode as ServerProgressMode);
    if (remote) {
      server = {
        index: remote.index,
        cardId: remote.cardId,
        source: remote.source,
        reverse: remote.reverse,
        total: remote.total,
        ...(remote.cardIds ? { cardIds: remote.cardIds } : {}),
        ...(remote.results ? { results: remote.results } : {}),
        ...(remote.savedAt ? { savedAt: remote.savedAt } : {}),
      };
    }
  } catch {
    // Kein Netz oder Serverfehler: Der lokale Stand reicht völlig.
  }
  return pickNewerProgress(local, server);
}

/** Den Stand ins Konto schreiben (best effort). */
export async function pushProgressToAccount(
  deckId: string,
  mode: ProgressMode,
  progress: SessionProgress
): Promise<void> {
  await queueAccountWrite(deckId, mode, async () => {
    await putServerProgress(deckId, mode as ServerProgressMode, {
      index: progress.index,
      cardId: progress.cardId,
      source: progress.source,
      reverse: progress.reverse,
      total: progress.total,
      ...(progress.cardIds ? { cardIds: progress.cardIds } : {}),
      ...(progress.results ? { results: progress.results } : {}),
    });
  });
}

/** Merker auf beiden Wegen löschen (Rundenende). */
export async function clearProgressEverywhere(
  deckId: string,
  mode: ProgressMode
): Promise<void> {
  // Sofort einreihen, damit auch ein während des lokalen Löschens gestartetes
  // Speichern einer neuen Runde erst nach diesem DELETE läuft.
  const remoteClear = queueAccountWrite(deckId, mode, async () => {
    await deleteServerProgress(deckId, mode as ServerProgressMode);
  });
  await clearSessionProgress(deckId, mode);
  await remoteClear;
}
