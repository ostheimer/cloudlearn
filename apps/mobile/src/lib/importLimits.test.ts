import { describe, expect, it } from "vitest";
import {
  DECK_LIMIT_LABEL,
  NEARLY_FULL_THRESHOLD,
  deckLimitMessage,
  deckSlotsLabel,
  freeCardSlots,
  isDeckLimitReached,
  isPlanLimitError,
  nearlyFullWarning,
  savedSummary,
  selectEvenlySpread,
  shouldOpenLpModal,
} from "./importLimits";

describe("Deck-Grenze in der App (#411)", () => {
  it("erkennt die erreichte Deck-Grenze", () => {
    expect(isDeckLimitReached(19, 20)).toBe(false);
    expect(isDeckLimitReached(20, 20)).toBe(true);
    // Konten über der Grenze (gibt es in Produktion) bleiben gesperrt fürs
    // Anlegen, verlieren aber nichts.
    expect(isDeckLimitReached(21, 20)).toBe(true);
  });

  it("benennt die Grenze so, wie sie im Hinweis steht — wortgleich mit dem Web", () => {
    expect(DECK_LIMIT_LABEL).toBe("Deck-Grenze erreicht");
    expect(deckLimitMessage(20, 20)).toBe(
      "20 von 20 Decks sind belegt. Neue Decks gehen erst wieder nach dem " +
        "Löschen — speichere die Karten so lange in ein bestehendes Deck."
    );
    // Seit #453 legt ein Scan nicht mehr zwangsläufig ein neues Deck an —
    // dieser alte Satz darf nicht zurückkommen.
    expect(deckLimitMessage(20, 20)).not.toContain("Jeder Scan");
  });

  it("zählt Bild-Karten bei den freien Plätzen mit", () => {
    expect(freeCardSlots({ cardCount: 138, imageCardCount: 0 }, 150)).toBe(12);
    expect(freeCardSlots({ cardCount: 120, imageCardCount: 18 }, 150)).toBe(12);
    // Ein Deck über der Grenze meldet 0 statt einer negativen Zahl.
    expect(freeCardSlots({ cardCount: 200 }, 150)).toBe(0);
  });
});

describe("Warnung vor dem Lernpunkte-Ausgeben (#411)", () => {
  it("warnt ab weniger als 30 freien Plätzen", () => {
    expect(nearlyFullWarning(29)).toBe(
      "In diesem Deck ist nur noch Platz für 29 Karten. Trotzdem scannen?"
    );
    expect(nearlyFullWarning(12)).toBe(
      "In diesem Deck ist nur noch Platz für 12 Karten. Trotzdem scannen?"
    );
  });

  it("schweigt, wenn genug Platz ist", () => {
    expect(nearlyFullWarning(NEARLY_FULL_THRESHOLD)).toBeNull();
    expect(nearlyFullWarning(150)).toBeNull();
  });

  it("schweigt bei einem vollen Deck — dort greift die Sperre, nicht die Warnung", () => {
    expect(nearlyFullWarning(0)).toBeNull();
  });

  it("passt das Verb an die Handlung an", () => {
    expect(nearlyFullWarning(12, "speichern")).toBe(
      "In diesem Deck ist nur noch Platz für 12 Karten. Trotzdem speichern?"
    );
  });

  it("zeigt den Platz schon in der Deck-Auswahl", () => {
    expect(deckSlotsLabel("Biologie", 12)).toBe("Biologie (12 Plätze frei)");
    expect(deckSlotsLabel("Biologie", 0)).toBe("Biologie (voll)");
    expect(deckSlotsLabel("Biologie", 90)).toBe("Biologie");
  });
});

describe("gleichmäßiges Ausdünnen (#411)", () => {
  it("behält das ganze Kapitel statt der ersten Karten — 160 auf 12", () => {
    const material = Array.from({ length: 160 }, (_value, index) => index);

    expect(selectEvenlySpread(material, 12)).toEqual([
      0, 14, 29, 43, 58, 72, 87, 101, 116, 130, 145, 159,
    ]);
  });

  it("behält erste und letzte Karte", () => {
    const kept = selectEvenlySpread(
      Array.from({ length: 140 }, (_value, index) => index),
      12
    );

    expect(kept[0]).toBe(0);
    expect(kept.at(-1)).toBe(139);
  });

  it("gibt alles zurück, wenn alles passt", () => {
    expect(selectEvenlySpread([1, 2, 3], 9)).toEqual([1, 2, 3]);
    expect(selectEvenlySpread([1, 2, 3], 0)).toEqual([]);
  });
});

describe("ehrliche Rückmeldung (#411)", () => {
  it("nennt beide Zahlen, wenn nicht alles passte", () => {
    expect(savedSummary(160, 12)).toBe(
      "160 Karten erkannt, 12 gespeichert — Deck voll."
    );
  });

  it("bleibt schlicht, wenn alles passte", () => {
    expect(savedSummary(12, 12)).toBe("12 Karten gespeichert.");
  });
});

describe("Lernpunkte-Fenster nur bei fehlenden Lernpunkten (#371)", () => {
  it("öffnet sich bei zu wenig Lernpunkten", () => {
    expect(shouldOpenLpModal({ status: 402, code: "INSUFFICIENT_LP" })).toBe(true);
  });

  it("öffnet sich NICHT bei einer Grenz-Ablehnung", () => {
    expect(shouldOpenLpModal({ status: 409, code: "DECK_FULL" })).toBe(false);
    expect(shouldOpenLpModal({ status: 409, code: "DECK_LIMIT_REACHED" })).toBe(false);
  });

  it("öffnet sich NICHT bei 402/PAYWALL_REQUIRED — Pro-Grenze, kein leeres Konto", () => {
    expect(shouldOpenLpModal({ status: 402, code: "PAYWALL_REQUIRED" })).toBe(false);
  });

  it("bleibt beim alten Verhalten für unbekannte 402", () => {
    expect(shouldOpenLpModal({ status: 402 })).toBe(true);
  });

  it("ignoriert alles andere", () => {
    expect(shouldOpenLpModal({ status: 500 })).toBe(false);
    expect(shouldOpenLpModal(new Error("Netzwerk"))).toBe(false);
    expect(shouldOpenLpModal(null)).toBe(false);
  });

  it("erkennt Grenz-Ablehnungen auch ohne Code", () => {
    expect(isPlanLimitError({ status: 409 })).toBe(true);
    expect(isPlanLimitError({ status: 402, code: "INSUFFICIENT_LP" })).toBe(false);
  });
});
