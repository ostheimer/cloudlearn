import { beforeAll, describe, expect, it } from "vitest";
import i18next, { type i18n as I18nInstance } from "i18next";
import { resources } from "./resources";

/**
 * Die Papierkorb- und Auswahl-Texte (#614) laufen hier WIRKLICH durch i18next,
 * nicht nur über einen Objektzugriff.
 *
 * Grund: Die Schlüssel dieser App sind flach und enthalten Punkte
 * ("trash.title"), und `trash.cardCount` ist die erste echte Pluralform im
 * Projekt. Beides zusammen ist die Stelle, an der ein Tippfehler nicht auffällt
 * — statt eines Satzes stünde in der App der rohe Schlüssel.
 */
let de: I18nInstance;
let en: I18nInstance;

beforeAll(async () => {
  de = i18next.createInstance();
  await de.init({ resources, lng: "de", fallbackLng: "de", interpolation: { escapeValue: false } });
  en = i18next.createInstance();
  await en.init({ resources, lng: "en", fallbackLng: "de", interpolation: { escapeValue: false } });
});

describe("Papierkorb-Wortlaute (#614)", () => {
  it("löst die flachen, gepunkteten Schlüssel auf", () => {
    expect(de.t("trash.title")).toBe("Papierkorb");
    expect(de.t("profile.trash")).toBe("Papierkorb");
    expect(de.t("trash.intro")).toContain("bis du es selbst endgültig entfernst");
    expect(en.t("trash.title")).toBe("Trash");
  });

  it("beugt Karten und Decks richtig", () => {
    expect(de.t("trash.cardCount", { count: 1 })).toBe("1 Karte");
    expect(de.t("trash.cardCount", { count: 16 })).toBe("16 Karten");
    expect(de.t("trash.deckCount", { count: 1 })).toBe("1 Deck");
    expect(de.t("trash.deckCount", { count: 5 })).toBe("5 Decks");
    expect(en.t("trash.cardCount", { count: 1 })).toBe("1 card");
    expect(en.t("trash.cardCount", { count: 16 })).toBe("16 cards");
  });

  it("setzt Deck-Titel, Anzahl und Datum in die Nachfragen ein", () => {
    const body = de.t("trash.purgeDeckBody", {
      title: "Waidmannssprache",
      cards: de.t("trash.cardCount", { count: 16 }),
    });
    expect(body).toContain("Waidmannssprache");
    expect(body).toContain("16 Karten");
    // Der ehrliche Nachsatz muss drinstehen: endgültiges Löschen nimmt die
    // Antworten zu diesen Karten aus der Statistik mit (review_logs-Kaskade).
    expect(body).toContain("aus der Statistik");

    expect(
      de.t("trash.deckMeta", { cards: de.t("trash.cardCount", { count: 3 }), date: "14. Juli" })
    ).toBe("3 Karten · gelöscht am 14. Juli");
    expect(de.t("trash.cardMeta", { deck: "Physik", date: "7. Juli" })).toBe(
      "aus „Physik\" · gelöscht am 7. Juli"
    );
  });

  it("sagt beim Mehrfach-Löschen dieselbe Papierkorb-Zusage wie das Web", () => {
    expect(de.t("cardSelect.confirmBodyOne")).toContain("landet im Papierkorb");
    expect(de.t("cardSelect.confirmBodyMany", { count: 2 })).toBe(
      "Sollen 2 ausgewählte Karten wirklich gelöscht werden? Sie landen im Papierkorb und lassen sich von dort zurückholen."
    );
    expect(de.t("cardSelect.count", { count: 2 })).toBe("2 ausgewählt");
    expect(de.t("cardSelect.deleteCount", { count: 2 })).toBe("2 löschen");
  });

  it("lässt keinen Schlüssel unübersetzt (kein roher Schlüssel als Ausgabe)", () => {
    const keys = [
      "trash.title",
      "trash.intro",
      "trash.emptyTitle",
      "trash.emptyBody",
      "trash.restore",
      "trash.purge",
      "trash.empty",
      "trash.restoreError",
      "trash.purgeError",
      "trash.loadError",
      "trash.purgeCardTitle",
      "trash.purgeCardBody",
      "trash.emptyTrashTitle",
      "profile.trash",
      "profile.trashSubtitle",
      "cardSelect.start",
      "cardSelect.cancel",
      "cardSelect.delete",
      "cardSelect.confirmTitle",
      "cardSelect.error",
    ];
    for (const key of keys) {
      expect(de.t(key), key).not.toBe(key);
      expect(en.t(key), key).not.toBe(key);
    }
  });
});
