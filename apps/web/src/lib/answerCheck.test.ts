/**
 * Antwort-Prüfung des Lückentexts — die Fälle, an denen #564 hing: Das
 * Tippfehler-Budget richtet sich nach der ERWARTETEN Antwort und ist unter
 * 8 Buchstaben null (App-Regel, Laras Entscheidung). Web und App müssen
 * dieselbe getippte Antwort gleich bewerten.
 */

import { describe, expect, it } from "vitest";
import { isAnswerCorrect, isCaseOnlyMismatch, normalizeAnswer } from "./answerCheck";

describe("nachsichtiger Modus", () => {
  it("verlangt unter 8 Buchstaben die exakte Schreibung — maus zählt nicht für haus (#564)", () => {
    expect(isAnswerCorrect("maus", "Haus")).toBe(false);
    expect(isAnswerCorrect("haus", "Haus")).toBe(true);
  });

  it("erlaubt ab 8 Buchstaben einen Tippfehler — diagram zählt für diagramm", () => {
    expect(isAnswerCorrect("diagram", "Diagramm")).toBe(true);
    expect(isAnswerCorrect("diagrom", "Diagramm")).toBe(false);
  });

  it("ignoriert Groß/klein, Akzente und Satzzeichen", () => {
    expect(isAnswerCorrect("  CAFE ", "Café.")).toBe(true);
  });

  it("akzeptiert jede aufgelistete Alternative", () => {
    expect(isAnswerCorrect("ohnegleichen", "beispiellos, ohnegleichen")).toBe(true);
  });
});

describe("strenger Modus", () => {
  it("verlangt die exakte Schreibung, akzeptiert aber Alternativen", () => {
    expect(isAnswerCorrect("cafe", "Café", { strict: true })).toBe(false);
    expect(isAnswerCorrect("ohnegleichen", "beispiellos/ohnegleichen", { strict: true })).toBe(
      true
    );
  });
});

describe("isCaseOnlyMismatch — die gelbe Fast-Stufe (#610)", () => {
  it("erkennt reine Groß/klein-Abweichung, auch bei Alternativen", () => {
    expect(isCaseOnlyMismatch("hund", "Hund")).toBe(true);
    expect(isCaseOnlyMismatch("COUCH", "Couch/Sofa")).toBe(true);
    expect(isCaseOnlyMismatch("élève", "Élève")).toBe(true);
  });

  it("meldet nichts bei exakter oder ganz anderer Antwort", () => {
    expect(isCaseOnlyMismatch("Hund", "Hund")).toBe(false);
    expect(isCaseOnlyMismatch("Katze", "Hund")).toBe(false);
  });

  it("Tippfehler und Akzente sind kein Fast — im strengen Modus echte Fehler", () => {
    expect(isCaseOnlyMismatch("hundd", "Hund")).toBe(false);
    expect(isCaseOnlyMismatch("cafe", "Café")).toBe(false);
  });

  it("leere Eingabe ist kein Fast", () => {
    expect(isCaseOnlyMismatch("   ", "Hund")).toBe(false);
  });
});

describe("normalizeAnswer", () => {
  it("entfernt Akzente, Satzzeichen und Mehrfach-Leerzeichen", () => {
    expect(normalizeAnswer("  Crème   brûlée! ")).toBe("creme brulee");
  });
});
