import { describe, expect, it } from "vitest";
import { decideOnLearnFocus, type LearnFocusInput } from "./learnFocusDecision";

function input(overrides: Partial<LearnFocusInput> = {}): LearnFocusInput {
  return {
    deckId: undefined,
    presetToken: 0,
    seenPresetToken: 0,
    loadedKey: null,
    cardCount: 0,
    completed: false,
    ...overrides,
  };
}

describe("decideOnLearnFocus", () => {
  it("übernimmt die Ordner-Auswahl beim ersten Fokus nach App-Start (#282)", () => {
    // DER Fall aus dem Fehlerbericht: frisch gestartete App, Nutzerin tippt im
    // Ordner „Alle lernen". Der Ordner legt 6 Karten hin (presetToken 0 -> 1)
    // und schickt zum Lern-Tab, der noch nie geladen hat (loadedKey null).
    //
    // Vorher wurde hier geladen und die 6 Karten mit den global fälligen
    // überschrieben — die Nutzerin lernte etwas anderes als angetippt.
    expect(
      decideOnLearnFocus(input({ presetToken: 1, seenPresetToken: 0, loadedKey: null, cardCount: 6 }))
    ).toEqual({ type: "adoptPreset" });
  });

  it("übernimmt sie auch, wenn zuvor global geladen wurde", () => {
    // Zweiter Weg in denselben Fehler: Der Tab war schon offen (loadedKey
    // "__global__"), die Nutzerin geht in den Ordner und tippt „Alle lernen".
    expect(
      decideOnLearnFocus(
        input({ presetToken: 4, seenPresetToken: 3, loadedKey: "__global__", cardCount: 6 })
      )
    ).toEqual({ type: "adoptPreset" });
  });

  it("lädt normal, wenn niemand etwas vorgegeben hat", () => {
    // Tab zum ersten Mal geöffnet, kein Ordner im Spiel.
    expect(decideOnLearnFocus(input({ loadedKey: null }))).toEqual({ type: "load" });
  });

  it("übernimmt eine bereits gesehene Vorgabe nicht erneut", () => {
    // Sonst bliebe der Tab für immer auf der alten Ordner-Auswahl stehen und
    // holte nie wieder fällige Karten.
    expect(
      decideOnLearnFocus(
        input({ presetToken: 2, seenPresetToken: 2, loadedKey: "__global__", cardCount: 6 })
      )
    ).toEqual({ type: "keep" });
  });

  it("lädt nach, wenn die gesehene Vorgabe abgearbeitet und leer ist", () => {
    expect(
      decideOnLearnFocus(
        input({ presetToken: 2, seenPresetToken: 2, loadedKey: "__global__", cardCount: 0 })
      )
    ).toEqual({ type: "load" });
  });

  it("lädt nach einer durchgelaufenen Sitzung NICHT sofort neu", () => {
    // completed = Ergebnisbildschirm. Nachladen würde ihn wegreißen.
    expect(
      decideOnLearnFocus(
        input({ presetToken: 2, seenPresetToken: 2, loadedKey: "__global__", cardCount: 0, completed: true })
      )
    ).toEqual({ type: "keep" });
  });

  it("ignoriert fremde Vorgaben im Deck-Modus", () => {
    // /deck-review ist für genau ein Deck zuständig. Übernähme es die Vorgabe,
    // zeigte das Deck die Karten des zuletzt geöffneten Ordners.
    expect(
      decideOnLearnFocus(
        input({ deckId: "deck-1", presetToken: 9, seenPresetToken: 0, loadedKey: null, cardCount: 6 })
      )
    ).toEqual({ type: "load" });
  });

  it("lädt beim Wechsel von Deck A auf Deck B neu", () => {
    // Der Store ist modulglobal — ohne diese Regel zeigte Deck B die Karten
    // von Deck A.
    expect(
      decideOnLearnFocus(
        input({ deckId: "deck-B", loadedKey: "deck-A", cardCount: 12 })
      )
    ).toEqual({ type: "load" });
  });

  it("behält die Karten desselben Decks bei erneutem Fokus", () => {
    expect(
      decideOnLearnFocus(input({ deckId: "deck-A", loadedKey: "deck-A", cardCount: 12 }))
    ).toEqual({ type: "keep" });
  });

  it("übernimmt auch eine LEERE Ordner-Vorgabe, statt fremde Karten zu holen", () => {
    // Ein Ordner ohne lernbare Karten muss zum ehrlichen „hier ist nichts"
    // führen. Lüde der Tab hier nach, bekäme die Nutzerin global fällige
    // Karten untergeschoben, die mit dem Ordner nichts zu tun haben.
    expect(
      decideOnLearnFocus(input({ presetToken: 1, seenPresetToken: 0, loadedKey: null, cardCount: 0 }))
    ).toEqual({ type: "adoptPreset" });
  });
});
