import { describe, expect, it } from "vitest";
import { formatCloze } from "./cloze";

describe("formatCloze", () => {
  it("replaces the gap with a blank and returns the answer", () => {
    const parsed = formatCloze("Die Hauptstadt von Frankreich ist {{c1::Paris}}.");
    expect(parsed.display).toBe("Die Hauptstadt von Frankreich ist ______.");
    expect(parsed.clozeAnswer).toBe("Paris");
  });

  it("replaces every gap, the answer is the first one's", () => {
    const parsed = formatCloze("{{c1::Wasser}} besteht aus {{c2::H2O}}.");
    expect(parsed.display).toBe("______ besteht aus ______.");
    expect(parsed.clozeAnswer).toBe("Wasser");
  });

  it("leaves text without a gap unchanged", () => {
    const parsed = formatCloze("Was ist Photosynthese?");
    expect(parsed.display).toBe("Was ist Photosynthese?");
    expect(parsed.clozeAnswer).toBeNull();
  });

  it("accepts a custom blank (speech uses a pause)", () => {
    const parsed = formatCloze("Berlin liegt an der {{c1::Spree}}.", "…");
    expect(parsed.display).toBe("Berlin liegt an der ….");
    expect(parsed.clozeAnswer).toBe("Spree");
  });
});
