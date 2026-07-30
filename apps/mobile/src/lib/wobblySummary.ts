/**
 * Wie die „Wackelkandidaten" ehrlich beschriftet werden (#682).
 *
 * Die Liste zeigt nur die hartnäckigsten Karten, geübt wird die volle Menge —
 * beides muss dranstehen. Vorher stand da „Deine Wackelkandidaten" und
 * „Wackelkandidaten üben (5)", ohne dass irgendwo auftauchte, dass 5 eine
 * Auswahl aus 23 war.
 *
 * `shown`    — Zeilen in der Liste (5)
 * `total`    — Karten des Decks mit mindestens einer falschen Antwort
 * `practice` — Karten, die der Knopf wirklich startet (Server kappt bei 100)
 *
 * Gegenstück zu apps/web/src/lib/wobbly-summary.ts — gleiche Wortlaute in
 * App und Web.
 */
export function wobblySummary(
  shown: number,
  total: number,
  practice: number
): { subtitle: string | null; practiceLabel: string } {
  return {
    // Nichts dazuschreiben, wenn die Liste ohnehin alles zeigt.
    subtitle: total > shown ? `Die ${shown} hartnäckigsten von ${total}` : null,
    // „Alle N üben" darf nur dastehen, wenn es wirklich alle sind — sonst
    // wäre die Beschriftung genau die Lüge, die dieser Fix beseitigt.
    practiceLabel:
      practice >= total ? `Alle ${total} üben` : `Die ${practice} hartnäckigsten üben`,
  };
}
