/**
 * Wo eine Lern-Runde für ein Deck unterbrochen wurde, gemerkt in diesem
 * Browser — das Web-Gegenstück zu
 * apps/mobile/src/features/review/sessionProgress.ts. Ohne den Merker begann
 * die nächste Runde wieder bei Karte 1; die Bewertungen der ersten Karten
 * waren aber längst beim Server, und ein zweiter Durchlauf bewertet sie
 * doppelt und verschiebt ihre Wiederhol-Planung.
 *
 * Bewusst ohne Verfallsdatum: Ein großes Deck wird über Tage durchgearbeitet,
 * und eine über Nacht still verschwundene Position brächte das ursprüngliche
 * Problem zurück. Stattdessen wird der Eintrag beim Rundenende gelöscht, und
 * jedes Fortsetzen wird nur ANGEBOTEN, nie automatisch angewendet — ein alter
 * Stand lässt sich immer ausschlagen.
 */

const STORAGE_PREFIX = "clearn:lernstand:";

/**
 * Lernarten mit merkbarer Position. Beide laufen in stabiler Reihenfolge über
 * den gewählten Kartenstapel, ein Index bedeutet beim nächsten Mal also noch
 * dasselbe. Quiz und Zuordnen sind kurz genug, dass Neustarten weniger kostet
 * als der zusätzliche Klick; die Prüfung würfelt ihre Fragen bei jedem Start
 * neu — eine Position allein würde eine Runde fortsetzen, die es nicht mehr
 * gibt.
 */
export type ProgressMode = "flashcards" | "cloze";

export interface SessionProgress {
  /** Nullbasierter Index der Karte, auf der die Runde stand. */
  index: number;
  /** Id der Karte an `index` beim Speichern — siehe isProgressUsable. */
  cardId: string;
  /** Kartenquelle der Runde ("all" | "starred" | "wobbly"). */
  source: string;
  /**
   * Ob rückwärts (Rückseite zuerst) abgefragt wurde. Das Karteikarten-Lernen
   * im Web tauscht (noch) nicht; das Feld hält das Format deckungsgleich zur
   * App und trägt beim Lückentext die gewählte Richtung.
   */
  reverse: boolean;
  /** Kartenzahl beim Speichern, für „Karte 9 von 40“. */
  total: number;
}

// Die Lernart gehört in den Schlüssel: Ein Deck kann gleichzeitig eine
// unterbrochene Karteikarten- UND Lückentext-Runde haben, und das sind
// verschiedene Stapel (der Lückentext lernt nur eintippbare Karten). Ein
// gemeinsamer Schlüssel ließe die zuletzt genutzte Lernart die Position der
// anderen still überschreiben.
function storageKey(deckId: string, mode: ProgressMode): string {
  return `${STORAGE_PREFIX}${mode}:${deckId}`;
}

/** Gespeichertes JSON lesen; null bei fehlenden, kaputten oder unplausiblen Werten. */
export function parseSessionProgress(raw: string | null): SessionProgress | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const { index, cardId, source, reverse, total } = value;
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0) return null;
    if (typeof cardId !== "string" || cardId.length === 0) return null;
    if (typeof source !== "string" || source.length === 0) return null;
    if (typeof total !== "number" || !Number.isInteger(total) || total <= 0) return null;
    // Ein Index am oder hinter dem Ende ist eine fertige Runde, keine fortsetzbare.
    if (index >= total) return null;
    return { index, cardId, source, reverse: reverse === true, total };
  } catch {
    return null;
  }
}

/**
 * Wahr, wenn der gespeicherte Stand noch auf dieselbe Karte im aktuellen
 * Stapel zeigt.
 *
 * Zwischen zwei Runden werden Karten angelegt, gelöscht oder entmarkiert —
 * das verschiebt jede spätere Position. Nur nach dem Index fortzusetzen würde
 * bei einer beliebigen Karte landen, ohne dass man es merkt. Der Vergleich
 * der gemerkten Karten-Id mit der Karte, die jetzt an der Position liegt, ist
 * eine billige, exakte Prüfung: Entweder sie passt, oder der Stapel hat sich
 * geändert — dann ist Von-vorne-Beginnen das ehrliche Ergebnis.
 *
 * Die Kartenquelle muss ebenfalls passen — „Nur markierte“ und „Alle“ sind
 * verschiedene Stapel, ein Index in den einen sagt nichts über den anderen.
 */
export function isProgressUsable(
  progress: SessionProgress | null,
  cardIds: string[],
  source: string
): boolean {
  if (!progress) return false;
  if (progress.source !== source) return false;
  if (progress.index >= cardIds.length) return false;
  return cardIds[progress.index] === progress.cardId;
}

export function saveSessionProgress(
  deckId: string,
  mode: ProgressMode,
  progress: SessionProgress
): void {
  try {
    window.localStorage.setItem(storageKey(deckId, mode), JSON.stringify(progress));
  } catch {
    // localStorage kann gesperrt sein (Privatmodus): Dann fehlt nur das
    // Weitermachen-Angebot — nie eine Bewertung.
  }
}

export function loadSessionProgress(
  deckId: string,
  mode: ProgressMode
): SessionProgress | null {
  try {
    return parseSessionProgress(window.localStorage.getItem(storageKey(deckId, mode)));
  } catch {
    return null;
  }
}

export function clearSessionProgress(deckId: string, mode: ProgressMode): void {
  try {
    window.localStorage.removeItem(storageKey(deckId, mode));
  } catch {
    // Ein liegengebliebener Eintrag wird nur angeboten, nie angewendet —
    // er lässt sich also immer ausschlagen.
  }
}
