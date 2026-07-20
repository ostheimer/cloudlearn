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
