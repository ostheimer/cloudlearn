/**
 * Die Ampel der Statistikseite: unter 60 % rot, unter 80 % gelb, sonst grün.
 *
 * Von hier aus geteilt, damit „Trefferquote genauer", die Deck-Liste und der
 * Prüfungs-Bereich nie verschiedene Schwellen benutzen — zwei Ampeln, die bei
 * 61 % anders entscheiden, liest niemand als Fehler, sondern als Willkür.
 *
 * `rate` ist IMMER der Anteil 0..1, wie ihn der Server liefert — nie eine
 * Prozentzahl. Die frühere Fassung hat geraten (`<= 1` hieß Anteil, darüber
 * Prozent); bei genau 1 ist das nicht entscheidbar, und der Prüfungs-Bereich
 * bekam für 1 % ein grünes „100 %" (#595). Wer in ganzen Prozent rechnet,
 * teilt vor dem Färben durch 100.
 */
export function accColor(rate: number): string {
  if (rate < 0.6) return "#e2504a";
  if (rate < 0.8) return "#d97706";
  return "#16a34a";
}
