/**
 * Streak-Reparatur: Reicht das Guthaben, und wie sagt man es? (#611)
 *
 * Vorher fragte die Reparatur ohne ein Wort zum Kontostand („Das kostet 40 LP
 * und stellt deinen 12-Tage-Streak wieder her."), und bei Ebbe endete das Ja in
 * einer Sackgasse: Der Server lehnte ab, es erschien „Dafür reichen deine LP
 * noch nicht." — ohne zu sagen, wie viele fehlen oder wo es welche gibt.
 *
 * Reine Funktionen ohne React, damit die Fallstricke testbar sind. Wortgleich
 * mit apps/web/src/lib/streak-repair.ts.
 */

/**
 * Darf der Reparatur-Knopf gedrückt werden?
 *
 * `balance === null` heißt „Kontostand noch nicht geladen" — und dann wird
 * NICHT gesperrt. Wichtig in der App: Der usageStore startet mit einer
 * VORBELEGUNG von 10 LP; nähme man die für eine Auskunft, wäre der Knopf für
 * jedes Konto grau, bis der echte Stand da ist. Aufrufer übergeben deshalb
 * `isLoaded ? lpBalance : null`. Dieselbe Zurückhaltung wie bei unbekannten
 * Plan-Grenzen (#603).
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
    return `Das kostet ${cost} LP und stellt deinen ${brokenStreak}-Tage-Streak wieder her.`;
  }
  return `Das kostet ${cost} LP — du hast ${balance} LP. Damit kommt dein ${brokenStreak}-Tage-Streak zurück.`;
}
