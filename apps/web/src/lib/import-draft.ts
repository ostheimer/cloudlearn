import type { Flashcard } from "./api";

/**
 * Der unfertige Import-Entwurf dieses Browsers (#608): Die von der KI
 * erzeugten, noch nicht gespeicherten Karten haben Lernpunkte gekostet —
 * Tab zu oder Browser-Absturz warf sie bisher kommentarlos weg.
 *
 * Muster wie session-progress.ts: bei jeder Änderung ablegen, beim
 * Abschluss (Speichern/Verwerfen) löschen, beim nächsten Öffnen nur
 * ANBIETEN, nie automatisch anwenden. Bewusst ohne Verfallsdatum — die
 * Karten sind bezahlt, ein still verschwundener Entwurf wäre genau der
 * Verlust, den der Merker verhindern soll.
 *
 * Gemerkt werden nur die erzeugten Karten samt Ziel — nicht das Foto oder
 * PDF selbst: zu groß für den localStorage, und bezahlt ist das Ergebnis.
 */

const STORAGE_KEY = "clearn:importdraft";

export interface ImportDraft {
  cards: Flashcard[];
  /** Titelvorschlag für ein neues Deck (Feld in der Vorschau). */
  newDeckTitle: string;
  /** Gewähltes Ziel-Deck oder null = neues Deck. */
  targetDeckId: string | null;
}

/**
 * Ein Eintrag aus dem Speicher wird Feld für Feld geprüft statt blind
 * gecastet — ein von Hand oder von einer alten Version geschriebener Wert
 * darf höchstens ignoriert werden, nie die Seite zerlegen.
 */
function parseCard(value: unknown): Flashcard | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.front !== "string" || typeof v.back !== "string") return null;
  return {
    front: v.front,
    back: v.back,
    type: typeof v.type === "string" ? v.type : "basic",
    difficulty: typeof v.difficulty === "string" ? v.difficulty : "medium",
    tags: Array.isArray(v.tags) ? v.tags.filter((t): t is string => typeof t === "string") : [],
  };
}

export function saveImportDraft(draft: ImportDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* Voller oder gesperrter Speicher darf den Import nicht stören. */
  }
}

export function loadImportDraft(): ImportDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const p = parsed as Record<string, unknown>;
    const cards = Array.isArray(p.cards)
      ? p.cards.map(parseCard).filter((c): c is Flashcard => c !== null)
      : [];
    if (cards.length === 0) return null;
    return {
      cards,
      newDeckTitle: typeof p.newDeckTitle === "string" ? p.newDeckTitle : "Neue Karten",
      targetDeckId: typeof p.targetDeckId === "string" ? p.targetDeckId : null,
    };
  } catch {
    return null;
  }
}

export function clearImportDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* siehe saveImportDraft */
  }
}
