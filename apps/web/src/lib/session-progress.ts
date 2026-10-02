import { parseSessionCardIds, resolveSessionResume } from "./session-resume";
export { resolveSessionResume } from "./session-resume";
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
 * Lernarten mit merkbarer Position und ursprünglicher Kartenreihenfolge.
 * Der Fälligkeitsfilter kann sich nach jeder Bewertung ändern.
 * Quiz und Zuordnen sind kurz genug, dass Neustarten weniger kostet
 * als der zusätzliche Klick; die Prüfung würfelt ihre Fragen bei jedem Start
 * neu — eine Position allein würde eine Runde fortsetzen, die es nicht mehr
 * gibt.
 */
export type ProgressMode = "flashcards" | "cloze";

/** Ausgang einer schon beantworteten Karte, in `results` nach Karten-Id abgelegt. */
export interface StoredCardResult {
  correct: boolean;
  overridden: boolean;
}

export interface SessionProgress {
  /** Nullbasierter Index der Karte, auf der die Runde stand. */
  index: number;
  /** Id der Karte an `index` beim Speichern — siehe isProgressUsable. */
  cardId: string;
  /** Kartenquelle der Runde ("all" | "starred" | "wobbly" | "due"). */
  source: string;
  /**
   * Ob rückwärts (Rückseite zuerst) abgefragt wurde. Trägt in beiden
   * Lernarten die gewählte Richtung — Karteikarten tauschen im Web seit #582
   * ebenfalls; das Format bleibt deckungsgleich zur App.
   */
  reverse: boolean;
  /** Kartenzahl beim Speichern, für „Karte 9 von 40“. */
  total: number;
  /** Original queue order; older bookmarks can omit it. */
  cardIds?: string[];
  /**
   * Ausgänge der vor der Unterbrechung beantworteten Karten, nach Karten-Id.
   * Damit zählt die Auswertung nach einem Weitermachen die ganze Runde
   * („11 von 12“) und alte falsche Karten landen wieder im Wiederhol-Stapel.
   * Optional: Merker von vor diesem Feld setzen normal fort, die Auswertung
   * zählt dann nur die aktuelle Sitzung.
   */
  results?: Record<string, StoredCardResult>;
  /**
   * Wann dieser Stand geschrieben wurde (ISO). Nur nötig, um ihn gegen den
   * Stand im Konto abzuwägen — der neuere gewinnt (#610). Optional: Merker von
   * vor diesem Feld gelten als älter als jeder Server-Stand, was stimmt.
   */
  savedAt?: string;
}

/** Nur Einträge behalten, die wie ein Ergebnis aussehen — ein kaputtes Feld darf nie den Merker töten. */
function parseStoredResults(value: unknown): Record<string, StoredCardResult> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const entries: Record<string, StoredCardResult> = {};
  for (const [cardId, result] of Object.entries(value)) {
    if (typeof result !== "object" || result === null) continue;
    const { correct, overridden } = result as Record<string, unknown>;
    if (typeof correct !== "boolean" || typeof overridden !== "boolean") continue;
    entries[cardId] = { correct, overridden };
  }
  return Object.keys(entries).length > 0 ? entries : undefined;
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
    const results = parseStoredResults(value.results);
    const cardIds = parseSessionCardIds(value.cardIds, { index, cardId, total });
    const savedAt = typeof value.savedAt === "string" && value.savedAt ? value.savedAt : undefined;
    return {
      index,
      cardId,
      source,
      reverse: reverse === true,
      total,
      ...(results ? { results } : {}),
      ...(cardIds ? { cardIds } : {}),
      ...(savedAt ? { savedAt } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Compatibility predicate for callers with just the current IDs. Session
 * screens use resolveSessionResume with the full deck to restore the original
 * due queue and its results, even after answered cards are no longer due.
 */
export function isProgressUsable(
  progress: SessionProgress | null,
  cardIds: string[],
  source: string
): boolean {
  return resolveSessionResume(progress, cardIds.map((id) => ({ id })), source) !== null;
}

export function saveSessionProgress(
  deckId: string,
  mode: ProgressMode,
  progress: SessionProgress
): void {
  try {
    // Zeitstempel beim Schreiben setzen, damit sich lokaler und Konto-Stand
    // später vergleichen lassen (#610).
    const stamped: SessionProgress = { ...progress, savedAt: new Date().toISOString() };
    window.localStorage.setItem(storageKey(deckId, mode), JSON.stringify(stamped));
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
