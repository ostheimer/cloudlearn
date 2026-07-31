// Rundenergebnis (#610): zeigt den Tagesziel-Fortschritt direkt nach der
// Runde, nicht nur auf Home/Statistik. `null` ohne gesetztes Ziel — dann gibt
// es nichts sinnvoll anzuzeigen.
export function dailyGoalLine(dailyGoal: number, reviewsToday: number): string | null {
  if (dailyGoal <= 0) return null;
  // Einheit mitnennen (#703): „28/30" allein sagt nicht, was gezählt wird.
  if (reviewsToday >= dailyGoal) {
    return `Tagesziel: ${reviewsToday}/${dailyGoal} Karten — geschafft!`;
  }
  return `Tagesziel: ${reviewsToday}/${dailyGoal} Karten — noch ${dailyGoal - reviewsToday}`;
}
