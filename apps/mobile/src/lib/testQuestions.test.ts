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

// The real deck from #380 (f30afafc-…): 20 vocabulary cards sitting next to 21
// image-occlusion cards whose backs are region labels "Bereich 1" … "Bereich 10".
const VOCAB_PAIRS: [string, string][] = [
  ["une forte diminution", "ein starker Rückgang"],
  ["une forte hausse", "ein starker Anstieg"],
  ["la courbe", "die Kurve"],
  ["le graphique", "das Schaubild"],
  ["l'axe", "die Achse"],
  ["le pourcentage", "der Prozentsatz"],
  ["la légende", "die Legende"],
  ["le tableau", "die Tabelle"],
  ["la colonne", "die Spalte"],
  ["la ligne", "die Zeile"],
  ["le sommet", "der Höhepunkt"],
  ["le creux", "der Tiefpunkt"],
  ["la tendance", "die Tendenz"],
  ["la période", "der Zeitraum"],
  ["la source", "die Quelle"],
  ["le titre", "der Titel"],
  ["la moyenne", "der Durchschnitt"],
  ["le total", "die Gesamtsumme"],
  ["la part", "der Anteil"],
  ["l'évolution", "die Entwicklung"],
];

const OCCLUSION_FRONT = "Bild-Occlusion: Was ist an der markierten Stelle?";

const vocabCards: TestCardInput[] = VOCAB_PAIRS.map(([front, back], i) => ({
  id: `v${i + 1}`,
  front,
  back,
  type: "basic",
}));

const occlusionCards: TestCardInput[] = Array.from({ length: 21 }, (_, i) => ({
  id: `o${i + 1}`,
  front: OCCLUSION_FRONT,
  back: `Bereich ${(i % 10) + 1}`,
  type: "occlusion",
}));

const mixedDeck: TestCardInput[] = [...vocabCards, ...occlusionCards];
const vocabBacks = VOCAB_PAIRS.map(([, back]) => back);
const isRegionLabel = (text: string) => /^Bereich \d+$/.test(text);

describe("buildTestQuestions", () => {
  it("returns nothing without cards", () => {
    expect(buildTestQuestions([], { count: 5, types: ["written"] })).toEqual([]);
  });

  it("limits to the requested count and available cards", () => {
    expect(buildTestQuestions(cards, { count: 2, types: ["written"], randomFn: seeded(1) })).toHaveLength(2);
    expect(buildTestQuestions(cards, { count: 99, types: ["written"], randomFn: seeded(1) })).toHaveLength(4);
  });

  it("fills up to the requested count by skipping past ineligible fill-in cards", () => {
    // With written disabled, fill-in cards yield no question. When such cards
    // fall early in the shuffle the loop must keep going and pull the later
    // eligible cards as replacements, not stop short of the requested count.
    const mixed: TestCardInput[] = [
      { id: "n3", front: "le soleil", back: "die Sonne" },
      { id: "f1", front: "Le ______ brille.", back: "soleil" },
      { id: "f2", front: "La ______ est ronde.", back: "lune" },
      { id: "n1", front: "la lune", back: "der Mond" },
      { id: "n2", front: "l'arbre", back: "der Baum" },
    ];
    // randomFn === 0 rotates the shuffle left by one → visit order is
    // f1, f2, n1, n2, n3, so the two fill-in cards come first.
    const qs = buildTestQuestions(mixed, { count: 3, types: ["mc"], randomFn: () => 0 });
    expect(qs).toHaveLength(3);
    expect(qs.length).toBeLessThanOrEqual(3);
    for (const q of qs) expect(q.type).toBe("mc");
    const ids = qs.map((q) => q.cardId);
    expect(ids).toEqual(expect.arrayContaining(["n1", "n2", "n3"]));
    expect(ids).not.toContain("f1");
    expect(ids).not.toContain("f2");
  });

  it("never returns more than the requested count when extra eligible cards remain", () => {
    const mixed: TestCardInput[] = [
      { id: "n3", front: "le soleil", back: "die Sonne" },
      { id: "f1", front: "Le ______ brille.", back: "soleil" },
      { id: "n1", front: "la lune", back: "der Mond" },
      { id: "n2", front: "l'arbre", back: "der Baum" },
      { id: "n4", front: "la fleur", back: "die Blume" },
    ];
    const qs = buildTestQuestions(mixed, { count: 2, types: ["mc"], randomFn: () => 0 });
    expect(qs).toHaveLength(2);
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

  it("reverses non-fill-in cards: question is the back, answer is the front", () => {
    const qs = buildTestQuestions(cards, {
      count: 4,
      types: ["written"],
      reverse: true,
      randomFn: seeded(3),
    });
    for (const q of qs) {
      const card = cards.find((c) => c.id === q.cardId)!;
      expect(q.prompt).toBe(card.back);
      expect(q.expected).toBe(card.front);
    }
  });

  // #380 — options must come from cards of the SAME KIND only.
  it("never offers occlusion region labels to a vocabulary question (and vice versa)", () => {
    let occlusionChoiceQuestions = 0;
    let vocabChoiceQuestions = 0;

    for (const seed of [1, 2, 3, 5, 7, 11, 13, 17]) {
      const qs = buildTestQuestions(mixedDeck, {
        count: 99,
        types: ["mc", "trueFalse", "written"],
        randomFn: seeded(seed),
      });
      expect(qs.length).toBeGreaterThan(0);

      for (const q of qs) {
        const shown = [...q.options, ...(q.tfShownBack ? [q.tfShownBack] : [])];
        if (shown.length === 0) continue;
        if (q.cardId.startsWith("o")) {
          occlusionChoiceQuestions++;
          for (const option of shown) expect(isRegionLabel(option)).toBe(true);
        } else {
          vocabChoiceQuestions++;
          for (const option of shown) {
            expect(isRegionLabel(option)).toBe(false);
            expect(vocabBacks).toContain(option);
          }
        }
      }
    }

    // Guard against a vacuous pass: both kinds really did produce choices.
    expect(occlusionChoiceQuestions).toBeGreaterThan(0);
    expect(vocabChoiceQuestions).toBeGreaterThan(0);
  });

  it("leaves a pure vocabulary deck exactly as it was before the same-kind filter", () => {
    const pure: TestCardInput[] = [
      { id: "v1", front: "une forte diminution", back: "ein starker Rückgang" },
      { id: "v2", front: "une forte hausse", back: "ein starker Anstieg" },
      { id: "v3", front: "la courbe", back: "die Kurve" },
      { id: "v4", front: "le graphique", back: "das Schaubild" },
      { id: "v5", front: "la légende", back: "die Legende" },
    ];
    const shape = (qs: ReturnType<typeof buildTestQuestions>) =>
      qs.map((q) => `${q.cardId}:${q.type}:${q.options.join("/")}:${q.tfShownBack}`);
    // Captured from the generator BEFORE the same-kind filter existed.
    const before = [
      "v2:mc:die Legende/das Schaubild/ein starker Anstieg/die Kurve:",
      "v5:trueFalse::die Legende",
      "v4:mc:ein starker Rückgang/die Kurve/das Schaubild/ein starker Anstieg:",
      "v3:mc:das Schaubild/ein starker Anstieg/die Kurve/ein starker Rückgang:",
      "v1:mc:das Schaubild/die Legende/ein starker Anstieg/ein starker Rückgang:",
    ];

    const build = (deck: TestCardInput[]) =>
      buildTestQuestions(deck, {
        count: 99,
        types: ["mc", "trueFalse", "written"],
        randomFn: seeded(42),
      });

    // Same result whether the cards carry an explicit type or none at all.
    expect(shape(build(pure))).toEqual(before);
    expect(shape(build(pure.map((c) => ({ ...c, type: "basic" }))))).toEqual(before);
  });

  it("falls back to a written question when a kind has too few cards for a choice", () => {
    const deck: TestCardInput[] = [
      ...vocabCards.slice(0, 3),
      { id: "o1", front: OCCLUSION_FRONT, back: "Bereich 1", type: "occlusion" },
    ];
    // 0.99 makes every card that CAN take a choice question take one, so a
    // written question for "o1" can only come from the same-kind fallback.
    const qs = buildTestQuestions(deck, {
      count: 99,
      types: ["mc", "written"],
      randomFn: () => 0.99,
    });
    const lone = qs.find((q) => q.cardId === "o1");
    expect(lone?.type).toBe("written");
    expect(lone?.expected).toBe("Bereich 1");
    expect(lone?.options).toEqual([]);

    // With written switched off there is nothing honest left to ask — the card
    // is dropped rather than given vocabulary options.
    const mcOnly = buildTestQuestions(deck, {
      count: 99,
      types: ["mc"],
      randomFn: () => 0.99,
    });
    expect(mcOnly.find((q) => q.cardId === "o1")).toBeUndefined();
    expect(mcOnly.length).toBeGreaterThan(0);
  });

  it("draws reverse options from the fronts (same side as the answer)", () => {
    const qs = buildTestQuestions(cards, {
      count: 4,
      types: ["mc"],
      reverse: true,
      randomFn: seeded(7),
    });
    const fronts = cards.map((c) => c.front);
    for (const q of qs) {
      expect(q.type).toBe("mc");
      expect(q.options[q.correctIndex]).toBe(q.expected);
      for (const opt of q.options) expect(fronts).toContain(opt);
    }
  });
});

describe("buildTestQuestions — gap questions never print their answer (#592)", () => {
  it("the written prompt shows the blank instead of {{cN::…}}", () => {
    const clozeCards: TestCardInput[] = [
      { id: "c1", front: "Die Hauptstadt von Frankreich ist {{c1::Paris}}.", back: "Paris", type: "cloze" },
      { id: "c2", front: "Berlin liegt an der {{c1::Spree}}.", back: "Spree", type: "cloze" },
    ];
    const qs = buildTestQuestions(clozeCards, { count: 2, types: ["written"], randomFn: () => 0 });
    expect(qs).toHaveLength(2);
    for (const q of qs) {
      expect(q.type).toBe("written");
      expect(q.prompt).not.toMatch(/\{\{c\d+::/);
      expect(q.prompt).toContain("______");
    }
    const paris = qs.find((q) => q.cardId === "c1")!;
    expect(paris.prompt).toBe("Die Hauptstadt von Frankreich ist ______.");
    expect(paris.expected).toBe("Paris");
  });
});

describe("buildTestQuestions — image cards never print raw markdown (#592)", () => {
  it("a pure image side becomes its caption, never ![…](…) code", () => {
    const imageCards: TestCardInput[] = [
      { id: "i1", front: "![Zellkern](https://example.com/zelle.png)", back: "Nucleus" },
      { id: "i2", front: "![Zellwand](https://example.com/wand.png)", back: "Membran" },
    ];
    const qs = buildTestQuestions(imageCards, {
      count: 2,
      types: ["written"],
      randomFn: () => 0,
    });
    expect(qs).toHaveLength(2);
    for (const q of qs) {
      expect(q.prompt).not.toMatch(/!\[/);
      expect(q.expected).not.toMatch(/!\[/);
    }
    const nucleus = qs.find((q) => q.cardId === "i1")!;
    expect(nucleus.prompt).toBe("Zellkern");
    expect(nucleus.expected).toBe("Nucleus");
  });

  it("no option or shown pairing ever contains ![…](…) code", () => {
    const imageCards: TestCardInput[] = [
      { id: "i1", front: "![Zellkern](https://example.com/zelle.png)", back: "Nucleus" },
      { id: "i2", front: "![Zellwand](https://example.com/wand.png)", back: "Membran" },
      { id: "i3", front: "![Chloroplast](https://example.com/chlor.png)", back: "Chloroplast" },
      { id: "i4", front: "![Golgi](https://example.com/golgi.png)", back: "Golgi-Apparat" },
    ];
    for (const seed of [1, 2, 3, 5, 7]) {
      const qs = buildTestQuestions(imageCards, {
        count: 8,
        types: ["mc", "trueFalse", "written"],
        randomFn: seeded(seed),
      });
      expect(qs.length).toBeGreaterThan(0);
      for (const q of qs) {
        const shown = [q.prompt, q.expected, q.tfShownBack, ...q.options];
        for (const text of shown) expect(text).not.toMatch(/!\[/);
      }
    }
  });

  it("an image without a caption drops the card instead of showing raw text", () => {
    const mixed: TestCardInput[] = [
      { id: "i1", front: "![](https://example.com/zelle.png)", back: "Nucleus" },
      { id: "t1", front: "la courbe", back: "die Kurve" },
    ];
    const qs = buildTestQuestions(mixed, {
      count: 5,
      types: ["written"],
      randomFn: () => 0,
    });
    expect(qs.map((q) => q.cardId)).toEqual(["t1"]);
  });
});
