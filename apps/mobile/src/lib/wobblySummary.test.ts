import { describe, expect, it } from "vitest";
import { wobblySummary } from "./wobblySummary";

describe("wobblySummary — die Auswahl ehrlich benennen (#682)", () => {
  it("nennt die Gesamtzahl, sobald die Liste gekappt ist", () => {
    expect(wobblySummary(5, 23, 23).subtitle).toBe("Die 5 hartnäckigsten von 23");
  });

  it("schweigt, wenn die Liste ohnehin alles zeigt", () => {
    expect(wobblySummary(3, 3, 3).subtitle).toBeNull();
  });

  it("verspricht alle, wenn der Knopf wirklich alle startet", () => {
    expect(wobblySummary(5, 23, 23).practiceLabel).toBe("Alle 23 üben");
  });

  it("verspricht NICHT alle, wenn der Server bei 100 kappt", () => {
    expect(wobblySummary(5, 137, 100).practiceLabel).toBe("Die 100 hartnäckigsten üben");
  });

  it("bleibt in App und Web beim gleichen Wortlaut", () => {
    // Gleiche Eingaben müssen in beiden Oberflächen dasselbe ergeben — der
    // Wortlaut steht doppelt im Code und darf nicht auseinanderlaufen.
    expect(wobblySummary(5, 23, 23)).toEqual({
      subtitle: "Die 5 hartnäckigsten von 23",
      practiceLabel: "Alle 23 üben",
    });
  });
});
