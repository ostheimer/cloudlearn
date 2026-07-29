import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Flashcard } from "../../lib/api";

/**
 * Der unfertige Scan-Entwurf dieses Geräts (#608): Die von der KI erzeugten,
 * noch nicht gespeicherten Karten haben Lernpunkte gekostet — beendete das
 * System die App im Hintergrund, waren sie bisher kommentarlos weg.
 *
 * Muster wie sessionProgress.ts: bei jeder Änderung ablegen, beim Abschluss
 * (Speichern/Verwerfen) löschen, beim nächsten Öffnen nur ANBIETEN, nie
 * automatisch anwenden. Bewusst ohne Verfallsdatum — die Karten sind bezahlt.
 *
 * Gemerkt werden die erzeugten Karten, der Titelvorschlag und (nach einem
 * Teil-Speichern) die schon angelegte Deck-Id — nicht das Foto oder PDF:
 * zu groß, und bezahlt ist das Ergebnis. Web-Gegenstück: import-draft.ts.
 */

const STORAGE_KEY = "clearn:scandraft";

export interface ScanDraft {
  cards: Flashcard[];
  /** Titelvorschlag der KI bzw. der von der Nutzerin angepasste Titel. */
  deckTitle: string;
  /**
   * Deck, das ein früherer (teil-)gescheiterter Speicherversuch schon angelegt
   * hat — der fortgesetzte Versuch nutzt es weiter, statt ein zweites Deck zu
   * erzeugen (Resume-Logik in scan.tsx).
   */
  savedDeckId: string | null;
}

/** Feld für Feld geprüft statt blind gecastet — ein kaputter oder alter
 *  Eintrag darf höchstens ignoriert werden, nie den Scan-Tab zerlegen. */
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

export function parseScanDraft(raw: string | null): ScanDraft | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const p = parsed as Record<string, unknown>;
    const cards = Array.isArray(p.cards)
      ? p.cards.map(parseCard).filter((c): c is Flashcard => c !== null)
      : [];
    if (cards.length === 0) return null;
    return {
      cards,
      deckTitle: typeof p.deckTitle === "string" ? p.deckTitle : "",
      savedDeckId: typeof p.savedDeckId === "string" ? p.savedDeckId : null,
    };
  } catch {
    return null;
  }
}

export async function saveScanDraft(draft: ScanDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* Voller oder gesperrter Speicher darf den Scan nicht stören. */
  }
}

export async function loadScanDraft(): Promise<ScanDraft | null> {
  try {
    return parseScanDraft(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export async function clearScanDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* siehe saveScanDraft */
  }
}
