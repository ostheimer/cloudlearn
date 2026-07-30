/**
 * Streak-Reparatur: Reicht das Guthaben, und wie sagt man es? (#611)
 *
 * Vorher fragte die Reparatur ohne ein Wort zum Kontostand („Deinen 12-Tage-
 * Streak für 40 LP zurückholen?"), und bei Ebbe endete das Ja in einer
 * Sackgasse: Der Server lehnte ab, es erschien „Dafür reichen deine LP noch
 * nicht." — ohne zu sagen, wie viele fehlen oder wo es welche gibt.
 *
 * Reine Funktionen ohne React, damit die Fallstricke testbar sind. Wortgleich
 * mit apps/mobile/src/lib/streakRepair.ts: Dieselbe Nachfrage darf in App und
 * Website nicht anders klingen.
 */

/**
 * Darf der Reparatur-Knopf gedrückt werden?
 *
 * `balance === null` heißt „Kontostand noch nicht geladen" — und dann wird
 * NICHT gesperrt. Ein grauer Knopf für ein Konto mit 200 Punkten wäre schlimmer
 * als ein Klick, den der Server notfalls ablehnt (und dessen Meldung jetzt
 * weiterführt). Dieselbe Zurückhaltung wie bei unbekannten Plan-Grenzen (#603).
 */
export function canAffordStreakRepair(balance: number | null, cost: number): boolean {
  if (balance === null) return true;
  return balance >= cost;
}

/**
 * Die Zeile im Banner: Preis und Kontostand in einem Satz. Ohne geladenen Stand
 * bleibt es bei der alten Aussage — nichts behaupten, was man nicht weiß.
 */
export function streakRepairBannerLine(
  balance: number | null,
  cost: number,
  brokenStreak: number
): string {
  if (balance === null) return `Dein ${brokenStreak}-Tage-Streak ist weg`;
  return `Zurückholen kostet ${cost} LP — du hast ${balance} LP.`;
}

/** Die Nachfrage vor dem Kauf — mit Kontostand, sobald er bekannt ist. */
export function streakRepairPrompt(
  balance: number | null,
  cost: number,
  brokenStreak: number
): string {
  if (balance === null) {
    return `Deinen ${brokenStreak}-Tage-Streak für ${cost} LP zurückholen?`;
  }
  return `Deinen ${brokenStreak}-Tage-Streak zurückholen? Das kostet ${cost} LP — du hast ${balance} LP.`;
}
