import { describe, it, expect } from "vitest";
import { cleanTerm } from "./cardTerms";

describe("cleanTerm", () => {
  it("extracts the term from a translation question", () => {
    expect(cleanTerm("Was bedeutet 'le record' auf Deutsch?")).toBe("le record");
    expect(cleanTerm("Wie heißt 'la chaleur' auf Deutsch?")).toBe("la chaleur");
    expect(cleanTerm("Was heißt 'le soleil' auf Französisch?")).toBe("le soleil");
    expect(cleanTerm("Übersetze: 'la moitié'")).toBe("la moitié");
  });

  it("handles German and curly quotes", () => {
    expect(cleanTerm("Was bedeutet „le record“ auf Deutsch?")).toBe("le record");
    expect(cleanTerm("Was bedeutet ‘le record’ auf Deutsch?")).toBe("le record");
  });

  it("leaves genuine subject questions unchanged", () => {
    expect(cleanTerm("Was ist ein Intervall?")).toBe("Was ist ein Intervall?");
    expect(cleanTerm("Nenne die Teile eines Taktes")).toBe(
      "Nenne die Teile eines Taktes"
    );
  });

  it("leaves definition questions without a target language unchanged", () => {
    // "bedeutet" alone is not enough — no target language, so it stays a
    // definition question whose answer is the definition, not the quoted word.
    expect(cleanTerm("Was bedeutet 'Legato'?")).toBe("Was bedeutet 'Legato'?");
  });

  it("leaves plain answers unchanged", () => {
    expect(cleanTerm("der Rekord")).toBe("der Rekord");
    expect(cleanTerm("die Hälfte")).toBe("die Hälfte");
    expect(cleanTerm("")).toBe("");
  });

  it("only fires when a quoted term is actually present", () => {
    // Translation signal but no quoted term → leave as-is.
    expect(cleanTerm("Übersetze diesen Satz auf Deutsch")).toBe(
      "Übersetze diesen Satz auf Deutsch"
    );
  });
});
