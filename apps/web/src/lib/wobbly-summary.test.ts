import { describe, expect, it } from "vitest";
import { wobblySummary } from "./wobbly-summary";

describe("wobblySummary — die Auswahl ehrlich benennen (#682)", () => {
  it("nennt die Gesamtzahl, sobald die Liste gekappt ist", () => {
    const { subtitle } = wobblySummary(5, 23, 23);

    expect(subtitle).toBe("Die 5 hartnäckigsten von 23");
  });

  it("schweigt, wenn die Liste ohnehin alles zeigt", () => {
    expect(wobblySummary(3, 3, 3).subtitle).toBeNull();
  });

  it("verspricht alle, wenn der Knopf wirklich alle startet", () => {
    expect(wobblySummary(5, 23, 23).practiceLabel).toBe("Alle 23 üben");
  });

  it("verspricht NICHT alle, wenn der Server bei 100 kappt", () => {
    const { practiceLabel } = wobblySummary(5, 137, 100);

    expect(practiceLabel).toBe("Die 100 hartnäckigsten üben");
  });

  it("bleibt bei kleinen Decks bei alle", () => {
    expect(wobblySummary(2, 2, 2).practiceLabel).toBe("Alle 2 üben");
  });
});
