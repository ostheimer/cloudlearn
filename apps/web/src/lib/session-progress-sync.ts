"use client";

/**
 * Der „Weitermachen"-Merker über beide Wege: dieses Gerät und das Konto (#610).
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
} from "@/lib/api";
import { pickNewerProgress } from "@/lib/progress-merge";
import {
  clearSessionProgress,
  loadSessionProgress,
  type ProgressMode,
  type SessionProgress,
} from "@/lib/session-progress";

/**
 * Den maßgeblichen Stand holen: lokal und aus dem Konto lesen, den neueren
 * nehmen. Der Aufrufer prüft danach wie bisher mit isProgressUsable, ob er zum
 * aktuellen Stapel passt.
 */
export async function loadBestProgress(
  deckId: string,
  mode: ProgressMode
): Promise<SessionProgress | null> {
  const local = loadSessionProgress(deckId, mode);
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
        ...(remote.results ? { results: remote.results } : {}),
        ...(remote.savedAt ? { savedAt: remote.savedAt } : {}),
      };
    }
  } catch {
    // Kein Netz oder Serverfehler: Der lokale Stand reicht völlig.
  }
  return pickNewerProgress(local, server);
}

/**
 * Den Stand ins Konto schreiben. Bewusst ohne await beim Aufrufer verwendbar —
 * das Verlassen der Runde soll auf nichts warten.
 */
export async function pushProgressToAccount(
  deckId: string,
  mode: ProgressMode,
  progress: SessionProgress
): Promise<void> {
  try {
    await putServerProgress(deckId, mode as ServerProgressMode, {
      index: progress.index,
      cardId: progress.cardId,
      source: progress.source,
      reverse: progress.reverse,
      total: progress.total,
      ...(progress.results ? { results: progress.results } : {}),
    });
  } catch {
    // Best effort — der lokale Merker steht bereits.
  }
}

/** Merker auf beiden Wegen löschen (Rundenende). */
export async function clearProgressEverywhere(
  deckId: string,
  mode: ProgressMode
): Promise<void> {
  clearSessionProgress(deckId, mode);
  try {
    await deleteServerProgress(deckId, mode as ServerProgressMode);
  } catch {
    // Ein liegengebliebener Konto-Eintrag wird nur angeboten, nie angewendet —
    // und die Prüfung auf dieselbe Karte fängt ihn ohnehin ab.
  }
}
