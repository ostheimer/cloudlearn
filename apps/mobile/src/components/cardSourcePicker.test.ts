import { describe, it, expect, vi } from "vitest";

// The component module imports react-native + the theme (which pulls in
// AsyncStorage) at the top level. We only exercise the pure `filterBySource`
// helper here, so stub those out to keep the test in the node environment.
vi.mock("react-native", () => ({
  Text: "Text",
  View: "View",
  TouchableOpacity: "TouchableOpacity",
}));
vi.mock("../theme", () => ({
  useColors: () => ({}),
  spacing: {},
  radius: {},
  typography: {},
  shadows: {},
}));

import { filterBySource, type CardSource } from "./cardSourcePicker";

type TestCard = { id: string; starred?: boolean };

const cards: TestCard[] = [
  { id: "a", starred: true },
  { id: "b", starred: false },
  { id: "c", starred: true },
  { id: "d" }, // starred omitted → treated as not starred
];

const wobblyIds = new Set(["b", "d"]);

describe("filterBySource", () => {
  it("returns every card for 'all'", () => {
    expect(filterBySource(cards, "all", wobblyIds)).toEqual(cards);
  });

  it("returns only starred cards for 'starred'", () => {
    expect(filterBySource(cards, "starred", wobblyIds).map((c) => c.id)).toEqual([
      "a",
      "c",
    ]);
  });

  it("treats a missing starred flag as not starred", () => {
    const result = filterBySource(cards, "starred", wobblyIds);
    expect(result.some((c) => c.id === "d")).toBe(false);
  });

  it("returns only cards whose id is in wobblyIds for 'wobbly'", () => {
    expect(filterBySource(cards, "wobbly", wobblyIds).map((c) => c.id)).toEqual([
      "b",
      "d",
    ]);
  });

  it("yields no cards for 'wobbly' when the wobbly set is empty", () => {
    expect(filterBySource(cards, "wobbly", new Set<string>())).toEqual([]);
  });

  it("yields no cards for 'starred' when nothing is starred", () => {
    const none: TestCard[] = [{ id: "x" }, { id: "y", starred: false }];
    expect(filterBySource(none, "starred", wobblyIds)).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input: TestCard[] = [{ id: "a", starred: true }, { id: "b" }];
    const snapshot = [...input];
    filterBySource(input, "starred", wobblyIds);
    expect(input).toEqual(snapshot);
  });

  it("keeps the source type usable as a discriminated value", () => {
    const sources: CardSource[] = ["all", "starred", "wobbly"];
    expect(sources).toHaveLength(3);
  });
});
