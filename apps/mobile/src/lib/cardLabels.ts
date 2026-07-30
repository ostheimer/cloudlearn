/**
 * Deutsche Beschriftungen für Kartentyp und Schwierigkeit (#609).
 *
 * Gespeichert werden stabile englische Tokens (contracts.ts: basic | cloze |
 * mcq | matching | occlusion, easy | medium | hard). Die Scan-Vorschau zeigte
 * sie roh an — „basic", „medium" sagen einer Schülerin nichts. Die Deck-Ansicht
 * hatte die deutschen Wörter längst inline; hier liegen sie einmal für alle.
 *
 * Unbekannte Werte kommen unverändert zurück: Ein neuer Kartentyp vom Server
 * soll lieber roh erscheinen als gar nicht.
 */

const CARD_TYPE_LABELS: Record<string, string> = {
  basic: "Frage & Antwort",
  cloze: "Lückentext",
  mcq: "Multiple Choice",
  matching: "Zuordnen",
  occlusion: "Bild abdecken",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Leicht",
  medium: "Mittel",
  hard: "Schwer",
};

export function cardTypeLabel(type: string): string {
  return CARD_TYPE_LABELS[type] ?? type;
}

export function difficultyLabel(difficulty: string): string {
  return DIFFICULTY_LABELS[difficulty] ?? difficulty;
}
