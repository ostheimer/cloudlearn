import { describe, expect, it } from "vitest";
import {
  DECK_LIMIT_LABEL,
  OVERFLOW_CONFIRM_TITLE,
  adviceForLimit,
  deckLimitMessage,
  deckLimitNotice,
  deckOptionLabel,
  deckOverflowWarning,
  deckSpaceNotice,
  freeSlots,
  isDeckLimitReached,
  isPlanLimitError,
  planLimitMessage,
  savedSummary,
} from "./import-limits";

describe("Deck-Grenze im Browser (#411)", () => {
  it("erkennt die erreichte Deck-Grenze", () => {
    expect(isDeckLimitReached(20, 20)).toBe(true);
    expect(isDeckLimitReached(21, 20)).toBe(true);
    expect(isDeckLimitReached(19, 20)).toBe(false);
  });

  it("sperrt NICHT, wenn der Server keine Grenzen mitschickt", () => {
    // Ein älterer Server kennt `limits` nicht. Dann lieber nicht vorwarnen als
    // ein Konto aussperren, das in Wahrheit noch Platz hat.
    expect(isDeckLimitReached(999, undefined)).toBe(false);
    expect(deckLimitNotice(999, undefined)).toBeNull();
  });

  it("sperrt NICHT, solange die Deckliste noch lädt", () => {
    // Sonst flackerte der Hinweis bei jedem Seitenaufruf kurz auf.
    expect(deckLimitNotice(null, 20)).toBeNull();
  });

  it("schweigt, solange noch Platz ist", () => {
    expect(deckLimitNotice(19, 20)).toBeNull();
  });

  it("benennt die Sperre so, wie sie über den Kacheln steht", () => {
    expect(DECK_LIMIT_LABEL).toBe("Deck-Grenze erreicht");
  });

  it("nennt beide Zahlen, damit die Grenze nachvollziehbar ist", () => {
    expect(deckLimitNotice(20, 20)).toContain("20 von 20 Decks");
  });

  it("nennt jetzt BEIDE Auswege — seit es ein Ziel-Deck gibt (#427)", () => {
    // Bis #427 war „speichere in ein bestehendes Deck" im Browser eine
    // Sackgasse und deshalb bewusst weggelassen. Mit der Zielauswahl ist es der
    // schnellere Ausweg: kein Löschen nötig, der Import läuft sofort weiter.
    const message = deckLimitMessage(20, 20);
    // Als Muster und nicht wörtlich geprüft (Lehre aus #436): Es gehört
    // geprüft, WAS der Satz anbietet — nicht, mit welchen Höflichkeitswörtern.
    // Seit #427 sind es zwei Auswege, weil auch der Browser ein Ziel-Deck
    // kennt; der Hinweis darf keinen davon verschweigen.
    expect(message).toMatch(/[Ll]öschen/);
    expect(message).toContain("bestehendes Deck");
  });
});

describe("Platz im Ziel-Deck (#427)", () => {
  it("rechnet die freien Plätze aus", () => {
    expect(freeSlots(107, 0, 150)).toBe(43);
    expect(freeSlots(0, 0, 150)).toBe(150);
  });

  it("zählt Bild-Karten mit — der Server zählt jede lebende Karte (#570)", () => {
    expect(freeSlots(120, 18, 150)).toBe(12);
    // Fehlt die Bild-Zahl (ältere Deck-Antwort), gilt sie als 0 statt unbekannt.
    expect(freeSlots(107, undefined, 150)).toBe(43);
  });

  it("wird nie negativ, wenn ein Deck über der Grenze liegt", () => {
    // Kann vorkommen, wenn ein Konto von Pro (2.000) auf Gratis (150) fällt.
    expect(freeSlots(400, 0, 150)).toBe(0);
  });

  it("behauptet nichts, wenn Kartenzahl oder Grenze fehlt", () => {
    expect(freeSlots(undefined, 0, 150)).toBeNull();
    expect(freeSlots(107, 0, undefined)).toBeNull();
  });

  it("schreibt den freien Platz an das Deck in der Auswahl", () => {
    expect(deckOptionLabel("Datenbanken", 43)).toBe("Datenbanken · 43 Plätze frei");
    expect(deckOptionLabel("Datenbanken", 1)).toBe("Datenbanken · 1 Platz frei");
    expect(deckOptionLabel("Datenbanken", 0)).toBe("Datenbanken · voll");
  });

  it("nennt nur den Titel, solange der Platz unbekannt ist", () => {
    expect(deckOptionLabel("Datenbanken", null)).toBe("Datenbanken");
  });

  it("warnt genau dann, wenn nicht alle Karten passen (#570, Variante 3)", () => {
    // Früher warnte eine feste 25er-Schwelle — auch wenn 5 Karten in 12 Plätze
    // locker passten, und nie bei 43 freien Plätzen und 60 Karten.
    expect(deckSpaceNotice(12, 5)).toBeNull();
    expect(deckSpaceNotice(12, 12)).toBeNull();
    // Nur die Zahlen — die Folge steht seit #595 allein in der Rückfrage,
    // sonst las man denselben Satz zweimal direkt hintereinander.
    expect(deckSpaceNotice(43, 60)).toBe(
      "Von deinen 60 Karten passen nur noch 43 in dieses Deck."
    );
  });

  it("formuliert die Rückfrage wortgleich mit der App", () => {
    expect(OVERFLOW_CONFIRM_TITLE).toBe("Wenig Platz");
    expect(deckOverflowWarning(27, 40)).toBe(
      "Von deinen 40 Karten passen nur noch 27 in dieses Deck — der Rest wird " +
        "beim Speichern gleichmäßig über den ganzen Stoff weggelassen. " +
        "Trotzdem speichern?"
    );
    expect(deckOverflowWarning(27, 5)).toBeNull();
    // Volles Deck: dort sperrt der Speichern-Knopf, keine Rückfrage.
    expect(deckOverflowWarning(0, 5)).toBeNull();
    expect(deckOverflowWarning(null, 5)).toBeNull();
  });

  it("sagt beim vollen Deck, was zu tun ist, statt nur „voll“", () => {
    const message = deckSpaceNotice(0, 5);
    expect(message).toContain("voll");
    expect(message).toContain("anderes Deck");
  });

  it("schweigt bei unbekanntem Platz, statt zu raten", () => {
    expect(deckSpaceNotice(null, 40)).toBeNull();
  });

  it("behauptet nicht mehr, jeder Scan lege ein neues Deck an (seit #427 falsch)", () => {
    // Der Satz stimmte nie ganz (die App bietet ein Ziel-Deck) und stimmt seit
    // der Web-Zielauswahl (#427/#445) gar nicht mehr. Früher bedingt geduldet,
    // jetzt hart verboten: Er darf in KEINER der beiden Meldungen mehr stehen.
    const messages = [
      deckLimitMessage(20, 20),
      planLimitMessage({ code: "DECK_LIMIT_REACHED" }) ?? "",
    ];
    for (const message of messages) {
      expect(message).not.toMatch(/jeder Scan legt ein neues Deck/i);
    }
  });
});

describe("ehrliche Rückmeldung nach dem Import (#411)", () => {
  it("nennt beide Zahlen, wenn nicht alles passte", () => {
    expect(savedSummary(163, 150)).toBe("163 Karten erkannt, 150 gespeichert — Deck voll.");
  });

  it("bleibt schlicht, wenn alles passte", () => {
    expect(savedSummary(42, 42)).toBe("42 Karten gespeichert.");
  });

  it("meldet nicht mehr, als gespeichert wurde", () => {
    // Verteidigt gegen einen Server, der savedCount über generatedCount meldet.
    expect(savedSummary(10, 12)).toBe("12 Karten gespeichert.");
  });
});

describe("Grenz-Ablehnung statt „Lernpunkte kaufen“ (#371/#411)", () => {
  it("erkennt beide Grenz-Codes", () => {
    expect(isPlanLimitError({ status: 409, code: "DECK_LIMIT_REACHED" })).toBe(true);
    expect(isPlanLimitError({ status: 409, code: "DECK_FULL" })).toBe(true);
  });

  it("hält fehlende Lernpunkte NICHT für eine Grenze", () => {
    // Sonst verlöre die Nutzerin den einzigen Hinweis, der ihr Problem löst.
    expect(isPlanLimitError({ status: 402, code: "INSUFFICIENT_LP" })).toBe(false);
    expect(planLimitMessage({ status: 402, code: "INSUFFICIENT_LP" })).toBeNull();
  });

  it("hält die Pro-Schranke NICHT für eine Grenze", () => {
    expect(isPlanLimitError({ status: 402, code: "PAYWALL_REQUIRED" })).toBe(false);
  });

  it("geht NICHT über den Status — 409 heißt in dieser API auch anderes", () => {
    // NO_INVITE, ALREADY_REFERRED und der Streak-Schutz am Maximum antworten
    // ebenfalls 409. Ein Statusvergleich gäbe sie als Tarifgrenze aus.
    expect(isPlanLimitError({ status: 409, code: "ALREADY_REFERRED" })).toBe(false);
    expect(isPlanLimitError({ status: 409 })).toBe(false);
  });

  it("verträgt kaputte Fehlerobjekte, statt die Seite mitzureißen", () => {
    expect(isPlanLimitError(null)).toBe(false);
    expect(isPlanLimitError("Deck voll")).toBe(false);
    expect(isPlanLimitError(undefined)).toBe(false);
    expect(planLimitMessage(new Error("Netzwerk"))).toBeNull();
  });

  it("verspricht KEINE Rückbuchung — beim Speichern fließt kein Lernpunkt", () => {
    // Seit #445 tritt die Grenze erst beim Speichern der Vorschau auf. Bezahlt
    // wurde beim Erzeugen; das Speichern kostet nichts, also gibt es auch nichts
    // zurückzubuchen. Der alte Satz „Lernpunkte zurückgebucht" wäre hier gelogen.
    expect(planLimitMessage({ code: "DECK_LIMIT_REACHED" })).not.toContain("zurückgebucht");
    expect(planLimitMessage({ code: "DECK_FULL" })).not.toContain("zurückgebucht");
  });

  it("beruhigt, dass die Karten nicht verloren sind", () => {
    // Die erste Frage bei einer Absage: „Sind meine Karten jetzt weg?" Nein —
    // sie stehen weiter in der Vorschau, bis ein Ziel passt.
    expect(planLimitMessage({ code: "DECK_LIMIT_REACHED" })).toContain("Vorschau");
    expect(planLimitMessage({ code: "DECK_FULL" })).toContain("Vorschau");
  });

  it("bietet beim Speichern ein bestehendes Deck als Ausweg an (#427/#445)", () => {
    // Umkehr des früheren Tests: An der Deck-Grenze ist ein bestehendes Deck der
    // schnellere Weg — kein Löschen nötig, das Speichern läuft sofort weiter.
    expect(planLimitMessage({ code: "DECK_LIMIT_REACHED" })).toContain("bestehendes Deck");
  });
});

describe("Klartext statt Bitte-versuche-es-erneut (#611)", () => {
  it("reicht den Server-Satz durch — er kennt Tarif und Zahlen", () => {
    expect(
      adviceForLimit({
        status: 409,
        code: "DECK_LIMIT_REACHED",
        message:
          "Deck-Grenze erreicht: Dein Tarif erlaubt 20 Decks. Mit Pro hast du deutlich mehr Platz.",
      })
    ).toBe(
      "Deck-Grenze erreicht: Dein Tarif erlaubt 20 Decks. Mit Pro hast du deutlich mehr Platz."
    );
  });

  it("reicht auch den Pro-Rat durch, statt einen Kauf zu behaupten", () => {
    // Wer schon Pro hat, dem hilft kein Kauf — der Server sagt das bereits,
    // und genau dieser Halbsatz ging bisher verloren (#371).
    const proText =
      "Dieses Deck ist voll: Dein Tarif erlaubt 2000 Karten pro Deck. " +
      "Leg für weitere Karten ein zweites Deck an.";
    expect(adviceForLimit({ status: 409, code: "DECK_FULL", message: proText })).toBe(proText);
  });

  it("bleibt vom Import-Wortlaut getrennt", () => {
    // planLimitMessage beruhigt „bleiben in der Vorschau" — außerhalb des
    // Imports gibt es keine Vorschau, der Satz wäre schlicht falsch.
    const advice = adviceForLimit({
      status: 409,
      code: "DECK_FULL",
      message: "Dieses Deck ist voll: Dein Tarif erlaubt 150 Karten pro Deck.",
    });
    expect(advice).not.toContain("Vorschau");
    expect(advice).not.toContain("zurückgebucht");
  });

  it("schweigt bei allem, was keine Tarifgrenze ist", () => {
    // Dann bleibt der bildschirmeigene Satz stehen.
    expect(
      adviceForLimit({ status: 402, code: "INSUFFICIENT_LP", message: "Zu wenig LP" })
    ).toBeNull();
    expect(adviceForLimit({ status: 500, message: "Serverfehler" })).toBeNull();
    expect(adviceForLimit(new Error("Netzwerk"))).toBeNull();
    expect(adviceForLimit(null)).toBeNull();
  });

  it("geht NICHT über den Status — 409 heißt in dieser API auch anderes", () => {
    expect(
      adviceForLimit({ status: 409, code: "NO_INVITE", message: "Kein Einladungscode" })
    ).toBeNull();
  });

  it("erfindet einen Satz, wenn der Server keinen mitschickt", () => {
    expect(adviceForLimit({ status: 409, code: "DECK_FULL" })).toBe(
      "Dieses Deck ist voll. Leg für weitere Karten ein zweites Deck an."
    );
    expect(adviceForLimit({ status: 409, code: "DECK_LIMIT_REACHED" })).toBe(
      "Die Deck-Grenze deines Tarifs ist erreicht. Lösche ein Deck, um Platz zu schaffen."
    );
  });

  it("zeigt niemals den technischen Platzhalter aus api.ts", () => {
    // request() baut „API error 409", wenn der Server ohne Text antwortet.
    expect(adviceForLimit({ status: 409, code: "DECK_FULL", message: "API error 409" })).toBe(
      "Dieses Deck ist voll. Leg für weitere Karten ein zweites Deck an."
    );
    expect(adviceForLimit({ status: 409, code: "DECK_FULL", message: "   " })).toBe(
      "Dieses Deck ist voll. Leg für weitere Karten ein zweites Deck an."
    );
  });
});
