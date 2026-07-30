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

import { filterBySource, isCardDue, type CardSource } from "./cardSourcePicker";

type TestCard = { id: string; starred?: boolean; fsrsDue?: string };

const NOW = Date.parse("2026-07-29T12:00:00.000Z");

const cards: TestCard[] = [
  { id: "a", starred: true, fsrsDue: "2026-07-29T08:00:00.000Z" }, // due today
  { id: "b", starred: false, fsrsDue: "2026-08-05T08:00:00.000Z" }, // due next week
  { id: "c", starred: true, fsrsDue: "2026-07-29T12:00:00.000Z" }, // due right now
  { id: "d" }, // starred/fsrsDue omitted → not starred, never due
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

  it("returns only cards whose due time has arrived for 'due' (#610)", () => {
    expect(filterBySource(cards, "due", wobblyIds, NOW).map((c) => c.id)).toEqual([
      "a",
      "c",
    ]);
  });

  it("keeps the source type usable as a discriminated value", () => {
    const sources: CardSource[] = ["all", "starred", "wobbly", "due"];
    expect(sources).toHaveLength(4);
  });
});

describe("isCardDue", () => {
  it("due from the scheduled moment on, not before", () => {
    expect(isCardDue({ fsrsDue: "2026-07-29T08:00:00.000Z" }, NOW)).toBe(true);
    expect(isCardDue({ fsrsDue: "2026-07-29T12:00:00.000Z" }, NOW)).toBe(true);
    expect(isCardDue({ fsrsDue: "2026-07-30T08:00:00.000Z" }, NOW)).toBe(false);
  });

  it("never due without or with a broken date", () => {
    expect(isCardDue({}, NOW)).toBe(false);
    expect(isCardDue({ fsrsDue: "not a date" }, NOW)).toBe(false);
  });
});
