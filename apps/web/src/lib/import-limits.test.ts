import { describe, expect, it } from "vitest";
import {
  DECK_LIMIT_LABEL,
  DECK_SPACE_WARN_BELOW,
  deckLimitMessage,
  deckLimitNotice,
  deckOptionLabel,
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
    expect(freeSlots(107, 150)).toBe(43);
    expect(freeSlots(0, 150)).toBe(150);
  });

  it("wird nie negativ, wenn ein Deck über der Grenze liegt", () => {
    // Kann vorkommen, wenn ein Konto von Pro (2.000) auf Gratis (150) fällt.
    expect(freeSlots(400, 150)).toBe(0);
  });

  it("behauptet nichts, wenn eine der beiden Zahlen fehlt", () => {
    expect(freeSlots(undefined, 150)).toBeNull();
    expect(freeSlots(107, undefined)).toBeNull();
  });

  it("schreibt den freien Platz an das Deck in der Auswahl", () => {
    expect(deckOptionLabel("Datenbanken", 43)).toBe("Datenbanken · 43 Plätze frei");
    expect(deckOptionLabel("Datenbanken", 1)).toBe("Datenbanken · 1 Platz frei");
    expect(deckOptionLabel("Datenbanken", 0)).toBe("Datenbanken · voll");
  });

  it("nennt nur den Titel, solange der Platz unbekannt ist", () => {
    expect(deckOptionLabel("Datenbanken", null)).toBe("Datenbanken");
  });

  it("warnt erst, wenn ein normaler Scan nicht mehr sicher hineinpasst", () => {
    expect(deckSpaceNotice(43)).toBeNull();
    expect(deckSpaceNotice(DECK_SPACE_WARN_BELOW)).toBeNull();
    expect(deckSpaceNotice(12)).toContain("Platz für 12 Karten");
  });

  it("sagt beim vollen Deck, was zu tun ist, statt nur „voll“", () => {
    const message = deckSpaceNotice(0);
    expect(message).toContain("voll");
    expect(message).toContain("anderes Deck");
  });

  it("schweigt bei unbekanntem Platz, statt zu raten", () => {
    expect(deckSpaceNotice(null)).toBeNull();
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
