/**
 * Was soll der Lern-Bildschirm tun, wenn er den Fokus bekommt?
 *
 * Steckte diese Entscheidung nur im `useFocusEffect`, ließe sie sich ohne
 * gerenderte App nicht prüfen — und genau hier saß #282: „Alle lernen" im
 * Ordner legte eine Auswahl in den Store, der Lern-Tab lud beim ersten Fokus
 * die global fälligen Karten nach und überschrieb sie. Die Nutzerin lernte
 * etwas anderes, als sie angetippt hatte.
 */

export interface LearnFocusInput {
  /** Deck-Modus (/deck-review) hat eine deckId, der Tab nicht. */
  deckId: string | undefined;
  /** Zählt Vorgaben von anderen Bildschirmen (Ordner „Alle lernen"). */
  presetToken: number;
  /** Der presetToken, den DIESER Bildschirm zuletzt gesehen hat. */
  seenPresetToken: number;
  /** Quelle der letzten eigenen Ladung: deckId oder "__global__". */
  loadedKey: string | null;
  /**
   * WEM die Karten im Store gehören (`cardsOwner`) — die Herkunft an den Daten
   * selbst, nicht die Notiz dieses Bildschirms.
   *
   * Genau daran hing der zweite Teil von #282: `loadedKey` ist ein `useRef`
   * und damit pro Komponenten-Instanz. Der Lern-Tab und /deck-review sind
   * verschiedene Instanzen — eine Deck-Übung setzt IHREN Merker, der Tab
   * behält seinen auf "__global__". Zurück im Tab passte der eigene Merker
   * also weiterhin, im Store lagen aber die Übungskarten, und der Tab zeigte
   * sie weiter.
   */
  cardsOwner: string | null;
  /** Karten, die gerade im Store liegen. */
  cardCount: number;
  /** Sitzung durchgelaufen? Dann ist „0 Karten" kein Grund nachzuladen. */
  completed: boolean;
}

export type LearnFocusAction =
  /** Vorgabe eines anderen Bildschirms übernehmen, NICHT nachladen. */
  | { type: "adoptPreset" }
  /** Fällige Karten holen (anderes Deck, erster Aufruf, oder leer). */
  | { type: "load" }
  /** Nichts tun — der Bildschirm zeigt bereits das Richtige. */
  | { type: "keep" };

export function decideOnLearnFocus(input: LearnFocusInput): LearnFocusAction {
  const key = input.deckId ?? "__global__";

  // Hat ein anderer Bildschirm seit unserer letzten Ladung etwas hingelegt,
  // gewinnt diese Auswahl. Nur im Tab-Modus: Mit einer deckId ist der
  // Bildschirm für genau ein Deck zuständig und darf keine fremde Vorgabe
  // übernehmen — sonst zeigte /deck-review die Karten des zuletzt geöffneten
  // Ordners.
  if (!input.deckId && input.presetToken !== input.seenPresetToken) {
    return { type: "adoptPreset" };
  }

  // Andere Quelle als beim letzten Mal (anderes Deck, oder überhaupt zum
  // ersten Mal) → laden. Der Store ist modulglobal, sonst zeigte Deck B die
  // Karten von Deck A.
  if (input.loadedKey !== key) {
    return { type: "load" };
  }

  // Liegen im Store fremde Karten? Dann neu laden, egal was der eigene Merker
  // sagt (#282, zweiter Teil). Genau hier fiel der Tab durch: Nach einer
  // Deck-Übung, `practice` oder „Wackelkandidaten üben" stimmte sein eigener
  // Merker weiterhin ("__global__"), aber die Karten im Store gehörten einem
  // anderen Bildschirm — und wurden einfach weitergezeigt.
  //
  // `null` (unbekannte Herkunft) zählt bewusst als fremd: lieber einmal zu viel
  // nachladen als der Nutzerin Karten unterschieben, die sie nicht angefordert
  // hat. Ausnahme ist der leere Store — da gibt es nichts zu verwechseln, und
  // ein durchgelaufener Ergebnisbildschirm soll nicht weggerissen werden.
  if (input.cardCount > 0 && input.cardsOwner !== key) {
    return { type: "load" };
  }

  // Eigene Karten, aber nichts da und nicht durchgelaufen → nachladen.
  if (input.cardCount === 0 && !input.completed) {
    return { type: "load" };
  }

  return { type: "keep" };
}
