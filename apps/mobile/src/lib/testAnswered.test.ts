import { describe, expect, it } from "vitest";
import { answeredIndices, isAnswered, type TestAnswer } from "./testQuestions";

// Zwilling zu apps/web/src/lib/testAnswered.test.ts. Die Regel MUSS auf beiden
// Geräten gleich ausfallen: Sonst meldete dieselbe abgebrochene Prüfung je nach
// Gerät unterschiedlich viele Karten an den Lernplan.

const leer: TestAnswer = { mc: null, tf: null, text: "" };

describe("isAnswered", () => {
  it("zählt eine unberührte Frage nicht", () => {
    expect(isAnswered(leer)).toBe(false);
  });

  it("zählt eine fehlende Antwort nicht (Platz gar nicht belegt)", () => {
    expect(isAnswered(undefined)).toBe(false);
  });

  it("zählt Multiple Choice — auch die erste Option", () => {
    // Falle: `if (a.mc)` wäre bei Option 0 falsch. Wer die erste Antwort
    // ankreuzt, hat geantwortet.
    expect(isAnswered({ ...leer, mc: 0 })).toBe(true);
    expect(isAnswered({ ...leer, mc: 3 })).toBe(true);
  });

  it("zählt Wahr/Falsch — auch „Falsch\"", () => {
    // Dieselbe Falle: `if (a.tf)` würde jedes „Falsch" verschlucken.
    expect(isAnswered({ ...leer, tf: false })).toBe(true);
    expect(isAnswered({ ...leer, tf: true })).toBe(true);
  });

  it("zählt getippten Text", () => {
    expect(isAnswered({ ...leer, text: "Redundanz" })).toBe(true);
  });

  it("zählt reine Leerzeichen nicht als Antwort", () => {
    expect(isAnswered({ ...leer, text: "   " })).toBe(false);
  });
});

describe("answeredIndices", () => {
  it("liefert die Plätze in ursprünglicher Reihenfolge", () => {
    const answers: TestAnswer[] = [
      { ...leer, text: "eins" },
      leer,
      { ...leer, mc: 0 },
      leer,
      { ...leer, tf: false },
    ];
    expect(answeredIndices(answers)).toEqual([0, 2, 4]);
  });

  it("liefert nichts, wenn nichts beantwortet wurde", () => {
    expect(answeredIndices([leer, leer])).toEqual([]);
  });

  it("überspringt Lücken zwischen beantworteten Fragen", () => {
    // Man darf in der Prüfung zurückblättern und eine Frage überspringen. Wer
    // Frage 1 und 3 beantwortet und dann rausgeht, meldet genau diese beiden —
    // Frage 2 bleibt unberührt.
    const answers: TestAnswer[] = [{ ...leer, mc: 1 }, leer, { ...leer, text: "drei" }];
    expect(answeredIndices(answers)).toEqual([0, 2]);
  });
});
