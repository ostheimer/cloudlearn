/**
 * Beschriftungen für Kartentyp und Schwierigkeit — Spiegel von
 * apps/mobile/src/lib/cardLabels.ts (#571 Teil B).
 *
 * Die Schwierigkeit gab es im Web bisher nirgends: Der Karten-Editor konnte sie
 * nicht setzen, obwohl der Server sie speichert und die App sie seit jeher
 * anbietet. Eine in der App auf „Schwer" gestellte Karte liess sich im Browser
 * also nicht zurückstellen.
 */

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Leicht",
  medium: "Mittel",
  hard: "Schwer",
};

/** Die drei Stufen in der Reihenfolge, in der die App sie zeigt. */
export const DIFFICULTIES = ["easy", "medium", "hard"] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

export function difficultyLabel(difficulty: string): string {
  return DIFFICULTY_LABELS[difficulty] ?? difficulty;
}
