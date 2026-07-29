/**
 * Baut die PATCH-Nutzlast für „Deck bearbeiten" (#606).
 *
 * Kernregel: Ein Feld geht nur dann an den Server, wenn wir seine Wahrheit
 * kennen — entweder weil die echten Deck-Daten geladen wurden oder weil die
 * Nutzerin das Feld selbst angefasst hat. Ein nie befülltes Feld sieht sonst
 * aus wie „bewusst geleert": Genau so hat das Bearbeiten-Fenster still alle
 * Schlagwörter gelöscht (leeres Start-Array wurde als `tags: []` mitgeschickt)
 * und hätte fehlgeladene Vorlese-Sprachen auf Deutsch zurückgesetzt. Der
 * Server lässt fehlende Felder in Ruhe (updateDeckSchema: alles optional).
 */

export interface DeckUpdatePayload {
  title: string;
  tags?: string[];
  speechLangFront?: string;
  speechLangBack?: string;
}

/** „bio, chemie , " → ["bio", "chemie"] — wie das Eingabefeld es anzeigt. */
export function parseTagsText(tagsText: string): string[] {
  return tagsText
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function buildDeckUpdatePayload(input: {
  title: string;
  tagsText: string;
  /** Hat die Nutzerin das Schlagwort-Feld selbst bearbeitet? */
  tagsEdited: boolean;
  langFront: string;
  langFrontEdited: boolean;
  langBack: string;
  langBackEdited: boolean;
  /** Kam die Server-Antwort mit den echten Deck-Daten an? */
  detailsLoaded: boolean;
}): DeckUpdatePayload {
  const payload: DeckUpdatePayload = { title: input.title.trim() };
  if (input.detailsLoaded || input.tagsEdited) {
    payload.tags = parseTagsText(input.tagsText);
  }
  // Die Sprachen je Seite getrennt: Wer offline nur die Vorderseite umstellt,
  // darf damit nicht die gespeicherte Rückseiten-Sprache überschreiben.
  if (input.detailsLoaded || input.langFrontEdited) {
    payload.speechLangFront = input.langFront;
  }
  if (input.detailsLoaded || input.langBackEdited) {
    payload.speechLangBack = input.langBack;
  }
  return payload;
}
