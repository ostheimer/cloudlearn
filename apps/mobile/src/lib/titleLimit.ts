/**
 * Höchstlänge für Deck- und Ordner-Titel (#612) — Tipp-Stopp der Eingabefelder.
 *
 * Der Server weist längere Titel ab (TITLE_MAX in apps/api/src/lib/limits.ts,
 * gleicher Wert); die Grenze hier sorgt dafür, dass der Fehler gar nicht erst
 * beim Speichern kommt. Das Web deckelt seine Namensfelder ebenfalls bei 120.
 */
export const TITLE_MAX_LENGTH = 120;

/** Ordner-Beschreibung — Servergrenze DESCRIPTION_MAX (folderService.ts). */
export const DESCRIPTION_MAX_LENGTH = 500;
