/**
 * Zuletzt gewählte Einstellungen eines Lernmodus, gemerkt je Deck und Modus in
 * diesem Browser (#610) — das App-Gegenstück ist
 * apps/mobile/src/lib/setupMemory.ts. Ohne den Merker begann jeder
 * Einstell-Bildschirm wieder bei den Standardwerten; wer z. B. immer
 * „Rückseite zuerst" mit „Nur markierte" lernt, musste das jedes Mal neu
 * umstellen.
 *
 * Gemerkt wird beim Rundenstart (nicht bei jedem Antippen — halbherziges
 * Herumprobieren ohne Start soll nichts überschreiben), und geladen wird nur
 * eine VORBELEGUNG: Jede Runde lässt sich weiterhin frei umstellen.
 */

import type { CardSource } from "./card-source";

const STORAGE_PREFIX = "clearn:setup:";

/** Lernarten mit eigenem Einstell-Bildschirm. */
export type SetupMode = "flashcards" | "cloze" | "quiz" | "test" | "match";

export interface StoredSetup {
  /** Rückseite zuerst abfragen. */
  reverse?: boolean;
  /** „Genau prüfen" beim freien Eintippen (Lückentext/Prüfung). */
  strict?: boolean;
  /** „Auf Zeit" (Prüfung/Zuordnen). */
  timed?: boolean;
  typeMC?: boolean;
  typeTF?: boolean;
  typeWritten?: boolean;
  /** Kartenquelle — als String, damit künftige Quellen lesbar bleiben. */
  source?: string;
  /**
   * Fragenanzahl; "all" steht für den „Alle"-Chip — auch dann noch, wenn das
   * Deck inzwischen gewachsen oder geschrumpft ist.
   */
  count?: number | "all";
}

// Der Modus gehört in den Schlüssel: Dasselbe Deck kann im Lückentext streng
// und rückwärts laufen, im Quiz aber vorwärts mit 10 Fragen — ein gemeinsamer
// Schlüssel ließe die zuletzt genutzte Lernart die Wahl der anderen
// überschreiben.
function storageKey(deckId: string, mode: SetupMode): string {
  return `${STORAGE_PREFIX}${mode}:${deckId}`;
}

const BOOLEAN_FIELDS = [
  "reverse",
  "strict",
  "timed",
  "typeMC",
  "typeTF",
  "typeWritten",
] as const;

/**
 * Gespeichertes JSON lesen; Felder einzeln prüfen — ein kaputtes Feld
 * verwirft nur sich selbst, nie den ganzen Merker.
 */
export function parseStoredSetup(raw: string | null): StoredSetup | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const setup: StoredSetup = {};
    for (const field of BOOLEAN_FIELDS) {
      const entry = value[field];
      if (typeof entry === "boolean") setup[field] = entry;
    }
    if (typeof value.source === "string" && value.source.length > 0) {
      setup.source = value.source;
    }
    if (value.count === "all") {
      setup.count = "all";
    } else if (
      typeof value.count === "number" &&
      Number.isInteger(value.count) &&
      value.count >= 1
    ) {
      setup.count = value.count;
    }
    return Object.keys(setup).length > 0 ? setup : null;
  } catch {
    return null;
  }
}

/**
 * Fragenanzahl fürs Speichern: Wer „Alle" gewählt hat, meint auch nächstes Mal
 * „Alle" — eine rohe Zahl würde aus „Alle (40)" beim inzwischen gewachsenen
 * Deck ein stures 40 machen (`count >= max` heißt „Alle", wie im
 * QuestionCountPicker).
 */
export function encodeCount(count: number, max: number): number | "all" {
  return count >= max ? "all" : count;
}

/** Gemerkte Anzahl auf den heutigen Vorrat anwenden; null, wenn nichts Brauchbares gemerkt ist. */
export function resolveCount(stored: StoredSetup["count"], max: number): number | null {
  if (max <= 0) return null;
  if (stored === "all") return max;
  if (typeof stored === "number") return Math.min(stored, max);
  return null;
}

/**
 * Gemerkte Kartenquelle nur übernehmen, wenn sie heute wieder Karten hätte —
 * eine vorgewählte leere Quelle wäre eine Sackgasse mit gesperrtem
 * Start-Knopf. Unbekannte Werte (etwa aus einer neueren Version) fallen auf
 * null, also auf den Standard.
 */
export function resolveSource(
  stored: string | undefined,
  counts: { starred: number; wobbly: number }
): CardSource | null {
  if (stored === "all") return "all";
  if (stored === "starred") return counts.starred > 0 ? "starred" : null;
  if (stored === "wobbly") return counts.wobbly > 0 ? "wobbly" : null;
  return null;
}

export function saveSetup(deckId: string, mode: SetupMode, setup: StoredSetup): void {
  try {
    window.localStorage.setItem(storageKey(deckId, mode), JSON.stringify(setup));
  } catch {
    // localStorage kann gesperrt sein (Privatmodus): Dann fehlt nur die
    // Vorbelegung — nie eine Runde.
  }
}

export function loadSetup(deckId: string, mode: SetupMode): StoredSetup | null {
  try {
    return parseStoredSetup(window.localStorage.getItem(storageKey(deckId, mode)));
  } catch {
    return null;
  }
}
