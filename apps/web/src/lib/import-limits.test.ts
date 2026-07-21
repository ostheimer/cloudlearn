import { describe, expect, it } from "vitest";
import {
  DECK_LIMIT_LABEL,
  deckLimitMessage,
  deckLimitNotice,
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

  it("schlägt im Browser KEIN bestehendes Deck vor — das gibt es hier nicht (#427)", () => {
    // Laras Entscheidung 21.07.: Der App-Halbsatz „oder speichere die Karten in
    // ein bestehendes Deck" ist im Browser eine Sackgasse. Man liest ihn, sucht
    // die Möglichkeit und findet sie nicht.
    const message = deckLimitMessage(20, 20);
    // Absichtlich als Muster und nicht wörtlich: Geprüft gehört, DASS der Satz
    // zum Löschen in der Bibliothek führt — nicht, mit welchen Höflichkeits-
    // wörtern. Die wörtliche Fassung schlug beim Ton-Wechsel am 21.07. an,
    // obwohl inhaltlich nichts fehlte; solche Tests gewöhnt man sich ab, achtlos
    // nachzuziehen, und übersieht dann den Tag, an dem sie recht haben.
    expect(message).toMatch(/lösche .*ein Deck in der Bibliothek/);
    expect(message).not.toContain("bestehendes Deck");
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

  it("sagt bei jeder Grenze ausdrücklich, dass die Lernpunkte zurück sind", () => {
    // Das ist die erste Frage, wenn ein bezahlter Import abbricht.
    expect(planLimitMessage({ code: "DECK_LIMIT_REACHED" })).toContain("zurückgebucht");
    expect(planLimitMessage({ code: "DECK_FULL" })).toContain("zurückgebucht");
  });

  it("schlägt auch im Fehlerfall kein bestehendes Deck vor (#427)", () => {
    expect(planLimitMessage({ code: "DECK_LIMIT_REACHED" })).not.toContain("bestehendes Deck");
  });
});
