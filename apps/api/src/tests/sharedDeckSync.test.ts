import { describe, expect, it } from "vitest";
import { cardTextKey, planSharedDeckSync } from "@/lib/sharedDeckSync";

/**
 * Jeder Fall, den Lara beim Entwurf von „Geteilte Decks nachziehen" (#614)
 * durchgesprochen und bestätigt hat, steht hier als eigener Test. Die
 * Nummerierung entspricht der Tabelle aus der Absprache.
 */
const karte = (front: string, back = "Antwort") => ({ front, back });

describe("planSharedDeckSync — Laras Fälle", () => {
  it("Fall 1: neue Karten des Originals kommen dazu", () => {
    const plan = planSharedDeckSync(
      [karte("A"), karte("B"), karte("C")],
      [karte("A")],
      Infinity
    );
    expect(plan.missing.map((c) => c.front)).toEqual(["B", "C"]);
    expect(plan.fitting).toHaveLength(2);
    expect(plan.skipped).toBe(0);
  });

  it("Fall 2: im Original gelöschte Karten bleiben bei mir — es wird nie gelöscht", () => {
    // Das Original hat „B" nicht mehr; die Planung nennt trotzdem nur, was
    // HINZUKOMMT. Es gibt bewusst keine Löschliste.
    const plan = planSharedDeckSync([karte("A")], [karte("A"), karte("B")], Infinity);
    expect(plan.missing).toEqual([]);
    expect(Object.keys(plan)).toEqual(["missing", "fitting", "skipped"]);
  });

  it("Fall 3: eine umformulierte Karte kommt ZUSÄTZLICH an", () => {
    // Der bewusst akzeptierte Nachteil: ein Textvergleich kann „geändert" nicht
    // von „neu" unterscheiden. Beide Fassungen zu haben ist besser, als eine
    // echte neue Karte zu verlieren.
    const plan = planSharedDeckSync(
      [karte("Was ist ein Ribosom, genau?")],
      [karte("Was ist ein Ribosom?")],
      Infinity
    );
    expect(plan.missing.map((c) => c.front)).toEqual(["Was ist ein Ribosom, genau?"]);
  });

  it("Fall 5: ohne Änderung am Original passiert nichts", () => {
    const plan = planSharedDeckSync([karte("A"), karte("B")], [karte("A"), karte("B")], Infinity);
    expect(plan.missing).toEqual([]);
    expect(plan.fitting).toEqual([]);
    expect(plan.skipped).toBe(0);
  });

  it("Fall 6: eigene Karten bleiben unangetastet und lösen kein Nachziehen aus", () => {
    const plan = planSharedDeckSync([karte("A")], [karte("A"), karte("Meine eigene")], Infinity);
    expect(plan.missing).toEqual([]);
  });

  it("Fall 8: selbst gelöschte Karten kommen NICHT zurück", () => {
    // Laras ausdrückliche Entscheidung. Der Aufrufer reicht die eigenen Karten
    // INKLUSIVE der gelöschten herein — deshalb gilt „B" als bekannt.
    const eigeneInklusiveGeloeschter = [karte("A"), karte("B")];
    const plan = planSharedDeckSync(
      [karte("A"), karte("B"), karte("C")],
      eigeneInklusiveGeloeschter,
      Infinity
    );
    expect(plan.missing.map((c) => c.front)).toEqual(["C"]);
  });

  it("Fall 9: am Kartenlimit wird ehrlich gemeldet, wie viele nicht passen", () => {
    const plan = planSharedDeckSync(
      [karte("A"), karte("B"), karte("C"), karte("D")],
      [],
      2
    );
    expect(plan.missing).toHaveLength(4);
    expect(plan.fitting.map((c) => c.front)).toEqual(["A", "B"]);
    // Nicht still kappen (#611): die Zahl geht an den Client und in den Text.
    expect(plan.skipped).toBe(2);
  });

  it("nimmt bei vollem Deck gar nichts, statt negativ zu rechnen", () => {
    const plan = planSharedDeckSync([karte("A")], [], -5);
    expect(plan.fitting).toEqual([]);
    expect(plan.skipped).toBe(1);
  });

  it("legt ein doppeltes Original nur einmal an", () => {
    // Sonst käme bei JEDEM Abgleich erneut eine Karte dazu.
    const plan = planSharedDeckSync([karte("A"), karte("A")], [], Infinity);
    expect(plan.missing).toHaveLength(1);
  });

  it("behält die Reihenfolge des Originals", () => {
    const plan = planSharedDeckSync([karte("C"), karte("A"), karte("B")], [], Infinity);
    expect(plan.missing.map((c) => c.front)).toEqual(["C", "A", "B"]);
  });
});

describe("cardTextKey", () => {
  it("übersieht Groß-/Kleinschreibung und zusätzliche Leerzeichen", () => {
    // Ein nachträglich entfernter Zeilenumbruch soll keine „neue" Karte erfinden.
    expect(cardTextKey({ front: "  Was ist  Osmose? ", back: "Wasser\nwandert" })).toBe(
      cardTextKey({ front: "was ist osmose?", back: "wasser wandert" })
    );
  });

  it("hält verschiedene Karten auseinander", () => {
    expect(cardTextKey(karte("A"))).not.toBe(cardTextKey(karte("B")));
    // Die Grenze zwischen Vorder- und Rückseite darf nicht verrutschen: sonst
    // hielte der Abgleich zwei verschiedene Karten für dieselbe und eine echte
    // neue Karte käme nie an.
    expect(cardTextKey({ front: "a b", back: "c" })).not.toBe(
      cardTextKey({ front: "a", back: "b c" })
    );
  });
});
