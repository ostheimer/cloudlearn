import { describe, expect, it } from "vitest";
import { toggleSelection } from "./deckSelection";

describe("toggleSelection — Antipp-Reihenfolge ist Ziel-Reihenfolge", () => {
  it("hängt neu Angetipptes hinten an", () => {
    expect(toggleSelection([], "a")).toEqual(["a"]);
    expect(toggleSelection(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleSelection(["a", "b"], "c")).toEqual(["a", "b", "c"]);
  });

  it("entfernt beim Abwählen — die späteren rücken auf, ihre Reihenfolge bleibt", () => {
    // Aus 1=a, 2=b, 3=c wird nach Abwahl von a: 1=b, 2=c.
    expect(toggleSelection(["a", "b", "c"], "a")).toEqual(["b", "c"]);
    expect(toggleSelection(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  it("verändert das übergebene Array nie (pure)", () => {
    const before = ["a", "b"];
    toggleSelection(before, "c");
    toggleSelection(before, "a");
    expect(before).toEqual(["a", "b"]);
  });

  it("erneutes An- und Abtippen landet wieder hinten, nicht am alten Platz", () => {
    // a abgewählt und nochmal getippt → a ist jetzt Letzter, nicht mehr Erster.
    const after = toggleSelection(toggleSelection(["a", "b"], "a"), "a");
    expect(after).toEqual(["b", "a"]);
  });
});
