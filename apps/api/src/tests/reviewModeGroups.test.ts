import { describe, expect, it } from "vitest";

import {
  RECALL_MODES,
  RECOGNITION_MODES,
  reviewModeSchema,
  type ReviewMode,
} from "@/lib/contracts";

/**
 * Die beiden Gruppen sind keine Deko: an RECALL_MODES hängt, ob eine Antwort
 * den Wiederhol-Plan bewegen darf (#210), und beide zusammen tragen die
 * getrennte Trefferquote der Statistik.
 *
 * Der Fehler, den diese Datei abfangen soll, ist nicht "falsch einsortiert" —
 * das fällt beim Schreiben auf. Es ist "gar nicht einsortiert": wer später
 * einen Lernmodus ergänzt (etwa Tippen oder Freitext), erweitert das Schema,
 * weil sonst der Request abgelehnt wird — die Gruppen sieht er nie. Der neue
 * Modus verschwände dann lautlos aus beiden Trefferquoten, und der Lernplan
 * behandelte ihn als Raten. Beides ohne Fehlermeldung.
 */
describe("Modus-Gruppen", () => {
  // Bewusst außen vor: die Prüfung misst, statt zu lernen, und bekommt einen
  // eigenen Statistik-Bereich. Sie steht hier namentlich, damit das Weglassen
  // eine Entscheidung bleibt und nicht wie ein Versehen aussieht.
  const ABSICHTLICH_OHNE_GRUPPE: readonly ReviewMode[] = ["test"];

  it("sortiert JEDEN Modus des Schemas ein — oder listet ihn ausdrücklich aus", () => {
    const alle = reviewModeSchema.options;
    const einsortiert = [...RECALL_MODES, ...RECOGNITION_MODES, ...ABSICHTLICH_OHNE_GRUPPE];

    const vergessen = alle.filter((mode) => !einsortiert.includes(mode));
    expect(vergessen).toEqual([]);
  });

  it("steckt keinen Modus in beide Gruppen", () => {
    const doppelt = RECALL_MODES.filter((mode) => RECOGNITION_MODES.includes(mode));
    expect(doppelt).toEqual([]);
  });

  it("lässt die Prüfung aus beiden Gruppen heraus", () => {
    // Käme 'test' in eine der Gruppen, passierten zwei Dinge auf einmal: die
    // Prüfung schöbe Karten im Lernplan nach hinten (in RECALL_MODES), und die
    // Prüfungszahlen wanderten in eine Quote, neben der sie gleich nochmal
    // einzeln stünden — dieselbe Größe zweimal verschieden.
    expect(RECALL_MODES).not.toContain("test");
    expect(RECOGNITION_MODES).not.toContain("test");
  });

  it("kennt nur Modi, die es im Schema wirklich gibt", () => {
    // Gegenrichtung: ein Tippfehler in einer Gruppe ("flashcards") wäre sonst
    // ein Modus, der nie zutrifft — die Gruppe verlöre still ihren größten
    // Anteil, ohne dass irgendwo etwas rot wird.
    const bekannt = reviewModeSchema.options;
    for (const mode of [...RECALL_MODES, ...RECOGNITION_MODES]) {
      expect(bekannt).toContain(mode);
    }
  });
});
