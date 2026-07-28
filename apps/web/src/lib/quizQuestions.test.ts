import { describe, expect, it } from "vitest";
import { generateQuestions, type QuizCardInput } from "./quizQuestions";

// Deterministischer Zufall, damit die Erzeugung im Test reproduzierbar ist.
function seeded(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Das echte Deck aus #380 (f30afafc-…): 20 Vokabelkarten liegen neben 21
// Bild-Occlusion-Karten, deren Rückseiten „Bereich 1" … „Bereich 10" heißen.
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

const vocabCards: QuizCardInput[] = VOCAB_PAIRS.map(([front, back], i) => ({
  id: `v${i + 1}`,
  front,
  back,
  type: "basic",
}));

const occlusionCards: QuizCardInput[] = Array.from({ length: 21 }, (_, i) => ({
  id: `o${i + 1}`,
  front: OCCLUSION_FRONT,
  back: `Bereich ${(i % 10) + 1}`,
  type: "occlusion",
}));

const mixedDeck: QuizCardInput[] = [...vocabCards, ...occlusionCards];
const vocabBacks = VOCAB_PAIRS.map(([, back]) => back);
const isRegionLabel = (text: string) => /^Bereich \d+$/.test(text);

describe("generateQuestions — Ablenker nur aus derselben Kartenart (#380)", () => {
  it("bietet einer Vokabelfrage nie eine Occlusion-Rückseite an (und umgekehrt)", () => {
    let occlusionQuestions = 0;
    let vocabQuestions = 0;

    for (const seed of [1, 2, 3, 5, 7, 11, 13, 17]) {
      const questions = generateQuestions(mixedDeck, {}, seeded(seed));
      expect(questions.length).toBeGreaterThan(0);

      for (const q of questions) {
        // Wahr/Falsch zeigt seine Paarung; die Optionen sind nur Richtig/Falsch.
        const shown =
          q.type === "trueFalse" ? [q.tfPairing?.back ?? ""] : [...q.options];
        if (q.cardId.startsWith("o")) {
          occlusionQuestions++;
          for (const option of shown) expect(isRegionLabel(option)).toBe(true);
        } else {
          vocabQuestions++;
          for (const option of shown) {
            expect(isRegionLabel(option)).toBe(false);
            expect(vocabBacks).toContain(option);
          }
        }
      }
    }

    // Schutz vor einem leeren Durchlauf: beide Arten haben wirklich Fragen erzeugt.
    expect(occlusionQuestions).toBeGreaterThan(0);
    expect(vocabQuestions).toBeGreaterThan(0);
  });

  it("lässt ein reines Vokabeldeck genau so wie vor dem Kartenart-Filter", () => {
    const pure: QuizCardInput[] = [
      { id: "v1", front: "une forte diminution", back: "ein starker Rückgang" },
      { id: "v2", front: "une forte hausse", back: "ein starker Anstieg" },
      { id: "v3", front: "la courbe", back: "die Kurve" },
      { id: "v4", front: "le graphique", back: "das Schaubild" },
      { id: "v5", front: "la légende", back: "die Legende" },
    ];
    const shape = (qs: ReturnType<typeof generateQuestions>) =>
      qs.map(
        (q) => `${q.cardId}:${q.type}:${q.options.join("/")}:${q.tfPairing?.back ?? ""}`
      );
    // Aus dem Generator abgenommen, BEVOR es den Kartenart-Filter gab.
    const before = [
      "v2:mc:die Legende/das Schaubild/ein starker Anstieg/die Kurve:",
      "v5:mc:die Kurve/ein starker Rückgang/ein starker Anstieg/die Legende:",
      "v4:trueFalse:Richtig/Falsch:die Kurve",
      "v3:mc:die Legende/ein starker Rückgang/ein starker Anstieg/die Kurve:",
      "v1:mc:ein starker Anstieg/die Legende/das Schaubild/ein starker Rückgang:",
    ];

    const build = (deck: QuizCardInput[]) =>
      generateQuestions(deck, { allowMc: true, allowTrueFalse: true }, seeded(42));

    // Gleiches Ergebnis, ob die Karten eine Art mitbringen oder gar keine.
    expect(shape(build(pure))).toEqual(before);
    expect(shape(build(pure.map((c) => ({ ...c, type: "basic" }))))).toEqual(before);
  });

  it("lässt eine Karte weg, deren Art keine zweite Antwort hat, statt fremde Optionen zu borgen", () => {
    // Der Quiz-Modus kennt keine Schreibfrage — der ehrliche Rückfall für eine
    // einzelne Occlusion-Karte ist deshalb gar keine Frage, niemals eine
    // Auswahl aus Vokabel-Antworten.
    const deck: QuizCardInput[] = [
      ...vocabCards.slice(0, 3),
      { id: "o1", front: OCCLUSION_FRONT, back: "Bereich 1", type: "occlusion" },
    ];
    const questions = generateQuestions(
      deck,
      { allowMc: true, allowTrueFalse: false },
      seeded(9)
    );
    expect(questions.find((q) => q.cardId === "o1")).toBeUndefined();
    expect(questions.length).toBeGreaterThan(0);
  });
});

describe("generateQuestions — Rundenlänge wählbar (#570)", () => {
  it("liefert genau die gewählte Anzahl, wenn der Pool reicht", () => {
    for (const seed of [1, 3, 7, 11]) {
      expect(generateQuestions(vocabCards, { count: 7 }, seeded(seed))).toHaveLength(7);
    }
  });

  it("füllt übersprungene Karten mit späteren auf, statt die Runde zu verkürzen", () => {
    // Eine einzelne Occlusion-Karte hat keinen gleichartigen Ablenker und fällt
    // im reinen MC-Betrieb raus — eine spätere Vokabelkarte rückt nach, egal an
    // welcher Position die Occlusion-Karte im Mischergebnis landet.
    const deck: QuizCardInput[] = [
      ...vocabCards.slice(0, 8),
      { id: "o1", front: OCCLUSION_FRONT, back: "Bereich 1", type: "occlusion" },
    ];
    for (const seed of [1, 2, 3, 5, 7, 11, 13, 17]) {
      const questions = generateQuestions(
        deck,
        { count: 8, allowMc: true, allowTrueFalse: false },
        seeded(seed)
      );
      expect(questions).toHaveLength(8);
      expect(questions.find((q) => q.cardId === "o1")).toBeUndefined();
    }
  });

  it("bleibt ohne count beim bisherigen Verhalten: jede Karte kommt dran", () => {
    expect(generateQuestions(vocabCards, {}, seeded(5))).toHaveLength(vocabCards.length);
  });
});

describe("generateQuestions — Wahr/Falsch kennt die echte Antwort (#497)", () => {
  it("tfPairing nennt die wirklich richtige Rückseite und ob die gezeigte stimmt", () => {
    // Der Ergebnis-Bildschirm zeigt bei einer falschen Paarung, was wirklich
    // zur Karte gehört — das Feld muss also immer die echte Rückseite tragen.
    let tfCount = 0;
    for (const seed of [1, 2, 3, 5, 7, 11, 13, 17]) {
      for (const q of generateQuestions(vocabCards, {}, seeded(seed))) {
        if (q.type !== "trueFalse" || !q.tfPairing) continue;
        tfCount++;
        const card = vocabCards.find((c) => c.id === q.cardId)!;
        expect(q.tfPairing.correctBack).toBe(card.back);
        expect(q.tfPairing.isCorrect).toBe(q.correctAnswer === "Richtig");
        if (q.tfPairing.isCorrect) {
          expect(q.tfPairing.back).toBe(card.back);
        } else {
          expect(q.tfPairing.back).not.toBe(card.back);
        }
      }
    }
    expect(tfCount).toBeGreaterThan(0);
  });
});

describe("generateQuestions — Kartentexte werden aufbereitet (#569)", () => {
  it("Lücken-Karten zeigen den Strich statt {{cN::…}} — die Lösung steht nie in der Frage", () => {
    const clozeCards: QuizCardInput[] = [
      { id: "c1", front: "Die Hauptstadt von Frankreich ist {{c1::Paris}}.", back: "Paris", type: "cloze" },
      { id: "c2", front: "Berlin liegt an der {{c1::Spree}}.", back: "Spree", type: "cloze" },
      { id: "c3", front: "Die Donau mündet ins {{c1::Schwarze Meer}}.", back: "Schwarze Meer", type: "cloze" },
    ];
    for (const seed of [1, 2, 3, 5, 7]) {
      for (const q of generateQuestions(clozeCards, {}, seeded(seed))) {
        const shown = q.type === "trueFalse" ? q.tfPairing!.front : q.questionText;
        expect(shown).not.toMatch(/\{\{c\d+::/);
        expect(shown).toContain("______");
      }
    }
  });

  it("entfernt Bild-Markdown und Übersetzungs-Zusätze aus Frage und Optionen", () => {
    const cards: QuizCardInput[] = [
      {
        id: "b1",
        front: "![Foto](https://example.com/a.png) Was heißt 'le soleil' auf Deutsch?",
        back: "die Sonne",
        type: "basic",
      },
      ...vocabCards,
    ];
    for (const seed of [1, 2, 3, 5, 7]) {
      for (const q of generateQuestions(cards, { allowTrueFalse: false }, seeded(seed))) {
        expect(q.questionText).not.toContain("![");
        for (const opt of q.options) expect(opt).not.toContain("![");
        if (q.cardId === "b1") expect(q.questionText).toBe("le soleil");
      }
    }
  });

  it("reine Bild-Karten fallen weg — ohne Bildanzeige wäre die Frage nicht beantwortbar", () => {
    const cards: QuizCardInput[] = [
      { id: "img1", front: "![Zellkern](https://example.com/z.png)", back: "Nucleus", type: "basic" },
      ...vocabCards,
    ];
    for (const seed of [1, 2, 3, 5, 7]) {
      const questions = generateQuestions(cards, {}, seeded(seed));
      expect(questions.find((q) => q.cardId === "img1")).toBeUndefined();
    }
  });
});
