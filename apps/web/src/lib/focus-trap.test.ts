import { describe, expect, it } from "vitest";
import { trapTabTarget } from "./focus-trap";

// Stellvertreter für DOM-Elemente — die Logik vergleicht nur Identitäten.
const a = { name: "a" };
const b = { name: "b" };
const c = { name: "c" };
const items = [a, b, c];

describe("trapTabTarget", () => {
  it("springt vom letzten Element vorwärts zum ersten (die eigentliche Falle)", () => {
    expect(trapTabTarget(items, c, false)).toBe(a);
  });

  it("springt vom ersten Element rückwärts zum letzten", () => {
    expect(trapTabTarget(items, a, true)).toBe(c);
  });

  it("holt den Fokus von außerhalb in den Dialog: vorwärts nach vorn, rückwärts ans Ende", () => {
    expect(trapTabTarget(items, null, false)).toBe(a);
    expect(trapTabTarget(items, null, true)).toBe(c);
  });

  it("lässt Sprünge mitten in der Liste dem Browser (null)", () => {
    expect(trapTabTarget(items, a, false)).toBeNull();
    expect(trapTabTarget(items, b, false)).toBeNull();
    expect(trapTabTarget(items, b, true)).toBeNull();
    expect(trapTabTarget(items, c, true)).toBeNull();
  });

  it("behandelt ein unbekanntes aktives Element wie Fokus außerhalb", () => {
    const fremd = { name: "fremd" };
    expect(trapTabTarget(items, fremd, false)).toBe(a);
    expect(trapTabTarget(items, fremd, true)).toBe(c);
  });

  it("bleibt bei leerer Liste neutral — der Aufrufer fokussiert dann den Dialog selbst", () => {
    expect(trapTabTarget([], null, false)).toBeNull();
  });

  it("kreist bei genau einem Element auf diesem Element", () => {
    expect(trapTabTarget([a], a, false)).toBe(a);
    expect(trapTabTarget([a], a, true)).toBe(a);
  });
});
