import { describe, expect, it } from "vitest";
import { buildTestQuestions, type TestCardInput } from "./testQuestions";

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

describe("buildTestQuestions — Ablenker nur aus derselben Kartenart (#380)", () => {
  it("bietet einer Vokabelfrage nie eine Occlusion-Rückseite an (und umgekehrt)", () => {
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

    // Schutz vor einem leeren Durchlauf: beide Arten haben wirklich Auswahlfragen erzeugt.
    expect(occlusionChoiceQuestions).toBeGreaterThan(0);
    expect(vocabChoiceQuestions).toBeGreaterThan(0);
  });

  it("lässt ein reines Vokabeldeck genau so wie vor dem Kartenart-Filter", () => {
    const pure: TestCardInput[] = [
      { id: "v1", front: "une forte diminution", back: "ein starker Rückgang" },
      { id: "v2", front: "une forte hausse", back: "ein starker Anstieg" },
      { id: "v3", front: "la courbe", back: "die Kurve" },
      { id: "v4", front: "le graphique", back: "das Schaubild" },
      { id: "v5", front: "la légende", back: "die Legende" },
    ];
    const shape = (qs: ReturnType<typeof buildTestQuestions>) =>
      qs.map((q) => `${q.cardId}:${q.type}:${q.options.join("/")}:${q.tfShownBack}`);
    // Aus dem Generator abgenommen, BEVOR es den Kartenart-Filter gab.
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

    // Gleiches Ergebnis, ob die Karten eine Art mitbringen oder gar keine.
    expect(shape(build(pure))).toEqual(before);
    expect(shape(build(pure.map((c) => ({ ...c, type: "basic" }))))).toEqual(before);
  });

  it("fällt auf eine Schreibfrage zurück, wenn eine Art zu wenige Karten hat", () => {
    const deck: TestCardInput[] = [
      ...vocabCards.slice(0, 3),
      { id: "o1", front: OCCLUSION_FRONT, back: "Bereich 1", type: "occlusion" },
    ];
    // 0.99 lässt jede Karte, die eine Auswahlfrage bekommen KANN, auch eine
    // bekommen — eine Schreibfrage für „o1" kann also nur aus dem Rückfall kommen.
    const qs = buildTestQuestions(deck, {
      count: 99,
      types: ["mc", "written"],
      randomFn: () => 0.99,
    });
    const lone = qs.find((q) => q.cardId === "o1");
    expect(lone?.type).toBe("written");
    expect(lone?.expected).toBe("Bereich 1");
    expect(lone?.options).toEqual([]);

    // Ohne „Schriftlich" bleibt nichts Ehrliches übrig — die Karte fällt raus,
    // statt Vokabel-Optionen zu bekommen.
    const mcOnly = buildTestQuestions(deck, {
      count: 99,
      types: ["mc"],
      randomFn: () => 0.99,
    });
    expect(mcOnly.find((q) => q.cardId === "o1")).toBeUndefined();
    expect(mcOnly.length).toBeGreaterThan(0);
  });
});
