import { describe, it, expect } from "vitest";
import { parseLastUsedDeck } from "./lastUsedDeck";

describe("parseLastUsedDeck", () => {
  it("parses a valid entry", () => {
    expect(parseLastUsedDeck('{"id":"d1","title":"Nature"}')).toEqual({
      id: "d1",
      title: "Nature",
    });
  });

  it("tolerates a missing title", () => {
    expect(parseLastUsedDeck('{"id":"d1"}')).toEqual({ id: "d1", title: "" });
  });

  it("rejects missing, corrupt or id-less values", () => {
    expect(parseLastUsedDeck(null)).toBeNull();
    expect(parseLastUsedDeck("")).toBeNull();
    expect(parseLastUsedDeck("not json")).toBeNull();
    expect(parseLastUsedDeck('{"title":"x"}')).toBeNull();
    expect(parseLastUsedDeck('{"id":""}')).toBeNull();
  });
});
