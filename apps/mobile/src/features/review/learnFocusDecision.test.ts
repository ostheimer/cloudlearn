import { describe, expect, it } from "vitest";
import { decideOnLearnFocus, type LearnFocusInput } from "./learnFocusDecision";

function input(overrides: Partial<LearnFocusInput> = {}): LearnFocusInput {
  return {
    deckId: undefined,
    presetToken: 0,
    seenPresetToken: 0,
    loadedKey: null,
    // Standard: die Karten gehoeren dem Lern-Tab selbst. Faelle, die eine
    // fremde Herkunft pruefen, setzen es ausdruecklich.
    cardsOwner: "__global__",
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
      decideOnLearnFocus(
        input({ deckId: "deck-A", loadedKey: "deck-A", cardsOwner: "deck-A", cardCount: 12 })
      )
    ).toEqual({ type: "keep" });
  });

  // ── Zweiter Teil von #282: der Tab bleibt auf fremden Karten stehen ──────
  //
  // `loadedKey` ist ein useRef und damit PRO Komponenten-Instanz. Lern-Tab und
  // /deck-review sind verschiedene Instanzen: Eine Deck-Übung setzt IHREN
  // Merker, der Tab behält seinen auf "__global__". Der Kartenspeicher ist
  // dagegen modulglobal. Zurück im Tab passte der eigene Merker also weiterhin,
  // im Speicher lagen aber die Übungskarten — und der Tab zeigte sie weiter,
  // bis jemand von Hand "Neu laden" tippte.
  //
  // Deshalb entscheidet jetzt die Herkunft AN DEN KARTEN (`cardsOwner`), nicht
  // die Notiz dieses Bildschirms.

  it("lädt neu, wenn nach einer Deck-Übung fremde Karten im Speicher liegen (#282)", () => {
    expect(
      decideOnLearnFocus(
        input({
          loadedKey: "__global__", // der EIGENE Merker stimmt weiterhin …
          cardsOwner: "deck-abc", // … die Karten gehören aber der Deck-Übung
          cardCount: 7,
        })
      )
    ).toEqual({ type: "load" });
  });

  it("lädt neu, wenn die Herkunft der Karten unbekannt ist", () => {
    // `practice` und „Wackelkandidaten üben" rufen start() ohne Eigentümer.
    // Unbekannt zählt als fremd — lieber einmal zu viel nachladen, als der
    // Nutzerin Karten unterschieben, die sie nicht angefordert hat.
    expect(
      decideOnLearnFocus(input({ loadedKey: "__global__", cardsOwner: null, cardCount: 5 }))
    ).toEqual({ type: "load" });
  });

  it("behält die EIGENEN Karten des Lern-Tabs", () => {
    // Die Gegenprobe: Ohne sie wäre "lade immer neu" auch eine bestandene
    // Lösung — und der Tab würde bei jedem Fokus unnötig nachladen.
    expect(
      decideOnLearnFocus(input({ loadedKey: "__global__", cardsOwner: "__global__", cardCount: 12 }))
    ).toEqual({ type: "keep" });
  });

  it("reißt einen durchgelaufenen Ergebnisbildschirm nicht weg", () => {
    // Leerer Speicher + completed: Da ist nichts zu verwechseln, und ein
    // Nachladen würde das Ergebnis wegwischen, bevor die Nutzerin es liest.
    expect(
      decideOnLearnFocus(
        input({ loadedKey: "__global__", cardsOwner: "deck-abc", cardCount: 0, completed: true })
      )
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
