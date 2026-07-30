import { describe, expect, it } from "vitest";
import {
  canAffordStreakRepair,
  streakRepairBannerLine,
  streakRepairPrompt,
} from "./streak-repair";

describe("Streak-Reparatur nennt den Kontostand (#611)", () => {
  it("erlaubt die Reparatur, wenn das Guthaben reicht", () => {
    expect(canAffordStreakRepair(40, 40)).toBe(true);
    expect(canAffordStreakRepair(200, 40)).toBe(true);
  });

  it("sperrt bei zu wenig Punkten, statt in den Serverfehler zu laufen", () => {
    expect(canAffordStreakRepair(12, 40)).toBe(false);
    expect(canAffordStreakRepair(0, 40)).toBe(false);
  });

  it("sperrt NICHT, solange der Kontostand lädt", () => {
    // Sonst wäre der Knopf bei jedem Seitenaufruf kurz grau — auch für ein
    // Konto, das längst genug Punkte hat.
    expect(canAffordStreakRepair(null, 40)).toBe(true);
  });

  it("nennt in der Banner-Zeile Preis und Stand", () => {
    expect(streakRepairBannerLine(12, 40, 7)).toBe(
      "Zurückholen kostet 40 LP — du hast 12 LP."
    );
  });

  it("behauptet ohne geladenen Stand keine Zahl", () => {
    expect(streakRepairBannerLine(null, 40, 7)).toBe("Dein 7-Tage-Streak ist weg");
  });

  it("nennt in der Nachfrage beide Zahlen", () => {
    expect(streakRepairPrompt(12, 40, 7)).toBe(
      "Deinen 7-Tage-Streak zurückholen? Das kostet 40 LP — du hast 12 LP."
    );
  });

  it("fällt in der Nachfrage auf den alten Wortlaut zurück", () => {
    expect(streakRepairPrompt(null, 40, 7)).toBe(
      "Deinen 7-Tage-Streak für 40 LP zurückholen?"
    );
  });
});
