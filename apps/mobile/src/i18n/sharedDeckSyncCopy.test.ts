import { beforeAll, describe, expect, it } from "vitest";
import i18next, { type i18n as I18nInstance } from "i18next";
import { resources } from "./resources";

/**
 * Wortlaute für „Geteilte Decks nachziehen" (#614), echt durch i18next geprüft.
 *
 * Wie bei den Papierkorb-Texten: flache, gepunktete Schlüssel plus Pluralformen
 * — fällt ein Schlüssel durch, steht in der App der rohe Name statt eines Satzes.
 */
let de: I18nInstance;
let en: I18nInstance;

beforeAll(async () => {
  de = i18next.createInstance();
  await de.init({ resources, lng: "de", fallbackLng: "de", interpolation: { escapeValue: false } });
  en = i18next.createInstance();
  await en.init({ resources, lng: "en", fallbackLng: "de", interpolation: { escapeValue: false } });
});

describe("Wortlaute fürs Nachziehen (#614)", () => {
  it("nennt das Deck beim Namen", () => {
    expect(de.t("sharedDeck.alreadyHave", { title: "Biologie" })).toBe(
      "„Biologie\" hast du schon"
    );
  });

  it("beugt die Anzahl neuer Karten", () => {
    expect(de.t("sharedDeck.syncNewCards", { count: 1 })).toBe("Das Original hat 1 neue Karte.");
    expect(de.t("sharedDeck.syncNewCards", { count: 8 })).toBe("Das Original hat 8 neue Karten.");
    expect(de.t("sharedDeck.syncCta", { count: 1 })).toBe("1 neue Karte übernehmen");
    expect(de.t("sharedDeck.syncCta", { count: 8 })).toBe("8 neue Karten übernehmen");
    expect(en.t("sharedDeck.syncCta", { count: 8 })).toBe("Add 8 new cards");
  });

  it("sagt nach dem Aktualisieren ausdrücklich, dass nichts verloren geht", () => {
    // Der wichtigste Satz des ganzen Ablaufs: „nur Hinzufügen" muss auch
    // dastehen, sonst muss man es glauben.
    const text = de.t("sharedDeck.syncDone", { added: 8, count: 8 });
    expect(text).toContain("8 Karten sind dazugekommen");
    expect(text).toContain("Lernfortschritt sind unverändert");
  });

  it("meldet ehrlich, wenn nicht alles ins Deck gepasst hat", () => {
    expect(de.t("sharedDeck.syncDoneWithSkipped", { added: 5, skipped: 3 })).toBe(
      "5 Karten sind dazugekommen. 3 haben nicht mehr ins Deck gepasst."
    );
  });

  it("bietet den zweiten Weg unmissverständlich an", () => {
    // „Trotzdem nochmal übernehmen" statt „Ersetzen" — ein echtes Ersetzen gibt
    // es bewusst nicht, es würde den Lernfortschritt wegwerfen.
    expect(de.t("sharedDeck.importAgain")).toBe("Trotzdem nochmal übernehmen");
    expect(de.t("sharedDeck.importAgain")).not.toMatch(/ersetzen/i);
  });

  it("lässt keinen Schlüssel unübersetzt", () => {
    for (const key of [
      "sharedDeck.alreadyHave",
      "sharedDeck.syncNothingNew",
      "sharedDeck.importAgain",
      "sharedDeck.syncDoneTitle",
      "sharedDeck.syncDoneWithSkipped",
      "sharedDeck.syncError",
    ]) {
      expect(de.t(key), key).not.toBe(key);
      expect(en.t(key), key).not.toBe(key);
    }
  });
});
