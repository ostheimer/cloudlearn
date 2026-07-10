import { describe, it, expect } from "vitest";
import { buildTestQuestions, type TestCardInput } from "./testQuestions";

// Deterministic PRNG so the generation is reproducible in tests.
function seeded(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const cards: TestCardInput[] = [
  { id: "1", front: "le soleil", back: "die Sonne" },
  { id: "2", front: "la lune", back: "der Mond" },
  { id: "3", front: "l'arbre", back: "der Baum" },
  { id: "4", front: "la fleur", back: "die Blume" },
];

describe("buildTestQuestions", () => {
  it("returns nothing without cards", () => {
    expect(buildTestQuestions([], { count: 5, types: ["written"] })).toEqual([]);
  });

  it("limits to the requested count and available cards", () => {
    expect(buildTestQuestions(cards, { count: 2, types: ["written"], randomFn: seeded(1) })).toHaveLength(2);
    expect(buildTestQuestions(cards, { count: 99, types: ["written"], randomFn: seeded(1) })).toHaveLength(4);
  });

  it("builds written questions with prompt and expected", () => {
    const qs = buildTestQuestions(cards, { count: 4, types: ["written"], randomFn: seeded(3) });
    for (const q of qs) {
      expect(q.type).toBe("written");
      expect(q.options).toEqual([]);
      expect(q.correctIndex).toBe(-1);
      expect(q.prompt.length).toBeGreaterThan(0);
      expect(q.expected.length).toBeGreaterThan(0);
    }
  });

  it("builds multiple-choice with the correct index pointing at the expected answer", () => {
    const qs = buildTestQuestions(cards, { count: 4, types: ["mc"], randomFn: seeded(7) });
    for (const q of qs) {
      expect(q.type).toBe("mc");
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.options[q.correctIndex]).toBe(q.expected);
    }
  });

  it("builds true/false where tfIsCorrect matches the shown answer", () => {
    const qs = buildTestQuestions(cards, { count: 4, types: ["trueFalse"], randomFn: seeded(11) });
    for (const q of qs) {
      expect(q.type).toBe("trueFalse");
      expect(q.tfIsCorrect).toBe(
        q.tfShownBack.toLowerCase() === q.expected.toLowerCase()
      );
    }
  });

  it("strips a translation-question wrapper via cleanTerm", () => {
    const wrapped: TestCardInput[] = [
      { id: "a", front: "Was bedeutet 'le record' auf Deutsch?", back: "der Rekord" },
      { id: "b", front: "Was bedeutet 'la moitié' auf Deutsch?", back: "die Hälfte" },
    ];
    const qs = buildTestQuestions(wrapped, { count: 2, types: ["written"], randomFn: seeded(2) });
    const prompts = qs.map((q) => q.prompt);
    expect(prompts).toContain("le record");
    expect(prompts).toContain("la moitié");
  });

  it("keeps fill-in cards as written and never uses their word as an option", () => {
    const mixed: TestCardInput[] = [
      { id: "f", front: "Le ______ est indispensable.", back: "nucléaire" },
      { id: "1", front: "le soleil", back: "die Sonne" },
      { id: "2", front: "la lune", back: "der Mond" },
      { id: "3", front: "l'arbre", back: "der Baum" },
    ];
    const qs = buildTestQuestions(mixed, { count: 99, types: ["mc", "written"], randomFn: seeded(5) });
    const fillInQ = qs.find((q) => q.cardId === "f");
    expect(fillInQ?.type).toBe("written");
    for (const q of qs) {
      if (q.type === "mc") {
        expect(q.options).not.toContain("nucléaire");
        expect(q.tfShownBack).not.toBe("nucléaire");
      }
    }
  });

  it("removes duplicate cards before building questions", () => {
    const dupes: TestCardInput[] = [
      { id: "a1", front: "le soleil", back: "die Sonne" },
      { id: "a2", front: "le soleil", back: "die Sonne" },
      { id: "b", front: "la lune", back: "der Mond" },
    ];
    const qs = buildTestQuestions(dupes, { count: 99, types: ["written"], randomFn: seeded(1) });
    expect(qs).toHaveLength(2);
  });
});
