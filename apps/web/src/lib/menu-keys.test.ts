import { describe, expect, it } from "vitest";
import { menuArrowTarget } from "./menu-keys";

// Stellvertreter für DOM-Elemente — die Logik vergleicht nur Identitäten.
const a = { name: "a" };
const b = { name: "b" };
const c = { name: "c" };
const items = [a, b, c];

describe("menuArrowTarget", () => {
  it("wandert mit Pfeil runter zum nächsten Eintrag", () => {
    expect(menuArrowTarget(items, a, 1)).toBe(b);
    expect(menuArrowTarget(items, b, 1)).toBe(c);
  });

  it("wandert mit Pfeil hoch zum vorherigen Eintrag", () => {
    expect(menuArrowTarget(items, c, -1)).toBe(b);
    expect(menuArrowTarget(items, b, -1)).toBe(a);
  });

  it("läuft an den Enden um (letzter → erster und umgekehrt)", () => {
    expect(menuArrowTarget(items, c, 1)).toBe(a);
    expect(menuArrowTarget(items, a, -1)).toBe(c);
  });

  it("steigt von außerhalb ein: runter vorn, hoch hinten", () => {
    expect(menuArrowTarget(items, null, 1)).toBe(a);
    expect(menuArrowTarget(items, null, -1)).toBe(c);
  });

  it("behandelt ein unbekanntes aktives Element wie Fokus außerhalb", () => {
    const fremd = { name: "fremd" };
    expect(menuArrowTarget(items, fremd, 1)).toBe(a);
    expect(menuArrowTarget(items, fremd, -1)).toBe(c);
  });

  it("bleibt bei leerer Liste neutral", () => {
    expect(menuArrowTarget([], null, 1)).toBeNull();
  });

  it("kreist bei genau einem Eintrag auf diesem", () => {
    expect(menuArrowTarget([a], a, 1)).toBe(a);
    expect(menuArrowTarget([a], a, -1)).toBe(a);
  });
});
