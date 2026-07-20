import { describe, expect, it } from "vitest";
import { dropSelfRevealingCards, revealsOwnAnswer } from "@/lib/cardQuality";

const cloze = (front: string, back: string) => ({ front, back, type: "cloze" });

describe("revealsOwnAnswer", () => {
  // The card that prompted this: measured once in 70 generated cloze cards.
  it("catches a leak hidden behind German inflection", () => {
    expect(
      revealsOwnAnswer(
        cloze("Wenn eine KI mit fehlerhaften Daten gefüttert wird, liefert sie ______ Ergebnisse.", "fehlerhafte")
      )
    ).toBe(true);
  });

  it("catches an exact repeat and ignores case and punctuation", () => {
    expect(revealsOwnAnswer(cloze("Die Clusterung bildet Gruppen: ______", "Clusterung"))).toBe(true);
    expect(revealsOwnAnswer(cloze("PREDICTIVE MAINTENANCE heißt ______.", "Predictive-Maintenance"))).toBe(true);
  });

  it("keeps a sound cloze card", () => {
    expect(
      revealsOwnAnswer(cloze("Das Erkennen auffälliger Käufe beim Online-Shopping nennt man ______.", "Fraud Detection"))
    ).toBe(false);
  });

  // A basic card may legitimately echo its question ("Was ist X?" -> "X ist ..."),
  // so the rule must not touch them.
  it("never judges non-cloze cards", () => {
    const basic = { front: "Was ist Clusterung?", back: "Clusterung ist die Bildung von Gruppen.", type: "basic" };
    expect(revealsOwnAnswer(basic)).toBe(false);
    // A card without a type at all is not a cloze card either.
    expect(revealsOwnAnswer({ front: basic.front, back: basic.back })).toBe(false);
  });

  // Short answers collide inside unrelated words ("Ort" within "Antwort").
  it("ignores answers too short to match meaningfully", () => {
    expect(revealsOwnAnswer(cloze("Die Antwort lautet ______.", "Ort"))).toBe(false);
  });

  it("survives empty and missing text", () => {
    expect(revealsOwnAnswer(cloze("", ""))).toBe(false);
    expect(revealsOwnAnswer({ front: "Frage ______", back: "", type: "cloze" })).toBe(false);
  });
});

describe("dropSelfRevealingCards", () => {
  it("removes only the leaking card and preserves order", () => {
    const good1 = cloze("Der Prozentsatz steigt auf ______.", "80 Prozent");
    const bad = cloze("Bei fehlerhaften Daten entstehen ______ Ergebnisse.", "fehlerhafte");
    const good2 = { front: "Was ist Fraud Detection?", back: "Erkennen auffälliger Käufe.", type: "basic" };

    expect(dropSelfRevealingCards([good1, bad, good2])).toEqual([good1, good2]);
  });

  it("leaves a clean batch untouched", () => {
    const cards = [cloze("Die Hauptstadt ist ______.", "Paris"), { front: "Was ist X?", back: "Y", type: "basic" }];
    expect(dropSelfRevealingCards(cards)).toEqual(cards);
  });
});
