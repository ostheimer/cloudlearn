import { describe, expect, it } from "vitest";
import {
  DECK_LIMIT_LABEL,
  NEARLY_FULL_THRESHOLD,
  adviceForLimit,
  affordableScanSources,
  deckSlotsSummary,
  deckLimitMessage,
  deckSlotsLabel,
  deckSlotsHint,
  freeCardSlots,
  isDeckLimitReached,
  isPlanLimitError,
  deckOverflowWarning,
  roomForNewCards,
  savedSummary,
  selectEvenlySpread,
  shouldOpenLpModal,
} from "./importLimits";

describe("Füllstand der Bibliothek (#611)", () => {
  it("nennt den Stand, lange bevor die Grenze reißt", () => {
    expect(deckSlotsSummary(19, 20)).toBe("19 von 20 Decks belegt");
    expect(deckSlotsSummary(3, 20)).toBe("3 von 20 Decks belegt");
  });

  it("sagt auch am Anschlag die Zahlen", () => {
    expect(deckSlotsSummary(20, 20)).toBe("20 von 20 Decks belegt");
  });

  it("schweigt bei unbekannter Grenze und beim Laden", () => {
    // maxDecks ist `null`, bis der Server die Grenzen geliefert hat (#603).
    expect(deckSlotsSummary(19, null)).toBeNull();
    expect(deckSlotsSummary(null, 20)).toBeNull();
  });
});

describe("Kosten-Sperren je Scan-Quelle (#611)", () => {
  const PREISE = { aiScan: 10, urlImport: 15, pdfImport: 20 };

  it("erlaubt alles, wenn das Guthaben für die teuerste Quelle reicht", () => {
    expect(affordableScanSources(20, PREISE)).toMatchObject({
      aiScan: true,
      urlImport: true,
      pdfImport: true,
      anyAffordable: true,
    });
  });

  it("sperrt genau die Quellen, die zu teuer sind — der eigentliche Fehler", () => {
    // Der Fall aus dem Audit: 12 LP. Der Warnstreifen prüfte nur gegen 10 (den
    // günstigsten Preis) und schwieg, obwohl URL und PDF unbezahlbar waren.
    const a = affordableScanSources(12, PREISE);
    expect(a.aiScan).toBe(true);
    expect(a.urlImport).toBe(false);
    expect(a.pdfImport).toBe(false);
    // Und weil Foto/Galerie/Text noch gehen, ist es KEIN Totalausfall.
    expect(a.anyAffordable).toBe(true);
  });

  it("meldet den Totalausfall, wenn nicht mal die günstigste Quelle geht", () => {
    const a = affordableScanSources(9, PREISE);
    expect(a.anyAffordable).toBe(false);
    expect(a.cheapest).toBe(10);
  });

  it("nennt den günstigsten Preis, statt ihn zu erraten", () => {
    // Diese Zahl steht im Warnstreifen. Sie darf nicht hart auf lpCostAiScan
    // verdrahtet sein: Pro zahlt 5/8/12, und Preise können sich ändern.
    expect(affordableScanSources(0, { aiScan: 5, urlImport: 8, pdfImport: 12 }).cheapest).toBe(5);
    expect(affordableScanSources(0, { aiScan: 30, urlImport: 8, pdfImport: 12 }).cheapest).toBe(8);
  });

  it("lässt eine Quelle zu, deren Preis genau dem Guthaben entspricht", () => {
    expect(affordableScanSources(15, PREISE).urlImport).toBe(true);
  });

  it("sperrt bei leerem Konto alles", () => {
    expect(affordableScanSources(0, PREISE)).toMatchObject({
      aiScan: false,
      urlImport: false,
      pdfImport: false,
      anyAffordable: false,
    });
  });
});

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

describe("Unbekannte Grenzen sperren nichts (#603)", () => {
  it("hält die Deck-Grenze für nicht erreicht, solange sie unbekannt ist", () => {
    // Pro-Konto mit 25 Decks, Grenzen noch nicht vom Server geladen: kein
    // Banner, keine Sperre — die alte Gratis-Vorbelegung tat genau das.
    expect(isDeckLimitReached(25, null)).toBe(false);
    expect(isDeckLimitReached(0, null)).toBe(false);
  });

  it("behauptet ohne Grenze keine freien Plätze", () => {
    expect(freeCardSlots({ cardCount: 200 }, null)).toBeNull();
    expect(freeCardSlots({}, null)).toBeNull();
  });

  it("zeigt in der Deck-Auswahl nur den Titel", () => {
    expect(deckSlotsLabel("Biologie", null)).toBe("Biologie");
  });

  it("stellt keine Platz-Rückfrage", () => {
    expect(deckOverflowWarning(null, 60)).toBeNull();
  });
});

describe("Ausdünnen nur mit echten Grenzen (#603)", () => {
  it("lässt ohne Server-Grenze alle Karten durch — der Server entscheidet", () => {
    // Der Kern des Pro-Datenverlusts: 163 erkannte Karten, Grenze unbekannt →
    // früher wurde gegen die geratene 150er-Grenze weggeworfen.
    expect(roomForNewCards(163, 10, null)).toBe(163);
  });

  it("lässt ohne lesbaren Deck-Bestand alle Karten durch", () => {
    expect(roomForNewCards(163, null, 150)).toBe(163);
  });

  it("rechnet mit echter Grenze und echtem Bestand", () => {
    expect(roomForNewCards(163, 140, 150)).toBe(10);
    expect(roomForNewCards(5, 100, 150)).toBe(5);
    // Deck schon über der Grenze: nichts mehr hinein, nichts Negatives.
    expect(roomForNewCards(163, 200, 150)).toBe(0);
  });
});

describe("Rückfrage vor dem Speichern (#570, Variante 3)", () => {
  it("fragt genau dann nach, wenn nicht alle Karten passen", () => {
    expect(deckOverflowWarning(27, 40)).toBe(
      "Von deinen 40 Karten passen nur noch 27 in dieses Deck — der Rest wird " +
        "beim Speichern gleichmäßig über den ganzen Stoff weggelassen. " +
        "Trotzdem speichern?"
    );
  });

  it("schweigt, wenn alles passt — auch bei wenig Restplatz", () => {
    // Früher hätte die feste 30er-Schwelle hier gewarnt, obwohl 5 Karten in 27
    // Plätze locker passen (#570).
    expect(deckOverflowWarning(27, 5)).toBeNull();
    expect(deckOverflowWarning(27, 27)).toBeNull();
    expect(deckOverflowWarning(150, 40)).toBeNull();
  });

  it("schweigt bei einem vollen Deck — dort greift die Sperre, nicht die Warnung", () => {
    expect(deckOverflowWarning(0, 12)).toBeNull();
  });

  it("zeigt den Platz schon in der Deck-Auswahl — mit Singular", () => {
    expect(deckSlotsLabel("Biologie", 12)).toBe("Biologie (12 Plätze frei)");
    expect(deckSlotsLabel("Biologie", 1)).toBe("Biologie (1 Platz frei)");
    expect(deckSlotsLabel("Biologie", 0)).toBe("Biologie (voll)");
    expect(deckSlotsLabel("Biologie", NEARLY_FULL_THRESHOLD)).toBe("Biologie");
    expect(deckSlotsLabel("Biologie", 90)).toBe("Biologie");
  });

  it("gibt dem Ziel-Deck-Picker denselben Platz-Hinweis ohne Titel (#612)", () => {
    // Gleiche Staffel wie deckSlotsLabel: erst kurz vor voll ein Hinweis,
    // unbekannte Grenze (#603) heisst "nichts anzeigen, nie sperren".
    expect(deckSlotsHint(null)).toBeNull();
    expect(deckSlotsHint(90)).toBeNull();
    expect(deckSlotsHint(NEARLY_FULL_THRESHOLD)).toBeNull();
    expect(deckSlotsHint(12)).toBe("12 Plätze frei");
    expect(deckSlotsHint(1)).toBe("1 Platz frei");
    expect(deckSlotsHint(0)).toBe("voll — kein Platz mehr");
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

describe("Klartext statt Bitte-versuch-es-nochmal (#611)", () => {
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
      "Deck-Grenze erreicht: Dein Tarif erlaubt 500 Decks. " +
      "Mehr sind nicht möglich — lösche ein Deck, um Platz zu schaffen.";
    expect(adviceForLimit({ status: 409, code: "DECK_LIMIT_REACHED", message: proText })).toBe(
      proText
    );
  });

  it("schweigt bei allem, was keine Tarifgrenze ist", () => {
    // Dann bleibt der bildschirmeigene Satz stehen.
    expect(adviceForLimit({ status: 402, code: "INSUFFICIENT_LP", message: "Zu wenig LP" })).toBeNull();
    expect(adviceForLimit({ status: 500, message: "Serverfehler" })).toBeNull();
    expect(adviceForLimit(new Error("Netzwerk"))).toBeNull();
    expect(adviceForLimit(null)).toBeNull();
  });

  it("geht NICHT über den Status — 409 heißt in dieser API auch anderes", () => {
    // NO_INVITE, ALREADY_REFERRED und der Streak-Schutz antworten ebenfalls 409.
    // isPlanLimitError darf das für die Scan-Ansicht pauschal nehmen, dieser
    // Helfer nicht: Er läuft auf Bildschirmen mit vielen Endpunkten.
    expect(adviceForLimit({ status: 409, code: "NO_INVITE", message: "Kein Einladungscode" })).toBeNull();
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
