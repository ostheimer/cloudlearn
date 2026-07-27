import { describe, expect, it } from "vitest";
import { cleanTerm, speechTexts, stripMarkdownImages } from "./speech-text";

describe("stripMarkdownImages", () => {
  it("removes markdown images so no URL gets read aloud", () => {
    expect(stripMarkdownImages("Schau: ![Zelle](https://x.test/a.png) fertig")).toBe(
      "Schau: fertig"
    );
  });

  it("leaves plain text untouched", () => {
    expect(stripMarkdownImages("Was ist Photosynthese?")).toBe("Was ist Photosynthese?");
  });
});

describe("cleanTerm", () => {
  it("shortens a translation question to the quoted term", () => {
    expect(cleanTerm("Was heißt „le record“ auf Deutsch?")).toBe("le record");
  });

  it("keeps definition questions whole — no target language, no shortening", () => {
    expect(cleanTerm("Was bedeutet 'Legato'?")).toBe("Was bedeutet 'Legato'?");
  });
});

describe("speechTexts", () => {
  it("cleans both sides", () => {
    expect(speechTexts("Übersetze 'der Hund' ins Französische", "le chien")).toEqual({
      front: "der Hund",
      back: "le chien",
    });
  });

  it("speaks a cloze gap as a pause and answers with the first gap's solution", () => {
    expect(speechTexts("Die Hauptstadt ist {{c1::Paris}}.", "egal")).toEqual({
      front: "Die Hauptstadt ist ….",
      back: "Paris",
    });
  });

  it("turns an image-only card into empty texts instead of reading the URL", () => {
    expect(speechTexts("![Diagramm](https://x.test/d.png)", "Antwort")).toEqual({
      front: "",
      back: "Antwort",
    });
  });
});
