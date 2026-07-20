import { describe, it, expect } from "vitest";
import { parseLastUsedDeck, pickShownDeck } from "./lastUsedDeck";

describe("parseLastUsedDeck", () => {
  it("parses a valid entry", () => {
    expect(parseLastUsedDeck('{"id":"d1","title":"Nature","at":"2026-07-20T12:00:00.000Z"}')).toEqual({
      id: "d1",
      title: "Nature",
      at: "2026-07-20T12:00:00.000Z",
    });
  });

  it("tolerates a missing title", () => {
    expect(parseLastUsedDeck('{"id":"d1"}')).toEqual({ id: "d1", title: "", at: null });
  });

  it("reads a pre-#415 marker as undated rather than rejecting it", () => {
    expect(parseLastUsedDeck('{"id":"d1","title":"Nature"}')).toEqual({
      id: "d1",
      title: "Nature",
      at: null,
    });
  });

  it("drops an unparseable timestamp instead of trusting it", () => {
    expect(parseLastUsedDeck('{"id":"d1","title":"x","at":"gestern"}')?.at).toBeNull();
    expect(parseLastUsedDeck('{"id":"d1","title":"x","at":123}')?.at).toBeNull();
  });

  it("rejects missing, corrupt or id-less values", () => {
    expect(parseLastUsedDeck(null)).toBeNull();
    expect(parseLastUsedDeck("")).toBeNull();
    expect(parseLastUsedDeck("not json")).toBeNull();
    expect(parseLastUsedDeck('{"title":"x"}')).toBeNull();
    expect(parseLastUsedDeck('{"id":""}')).toBeNull();
  });
});

describe("pickShownDeck", () => {
  const morning = "2026-07-20T07:30:00.000Z";
  const afternoon = "2026-07-20T12:44:00.000Z";
  const edited = { id: "old", title: "Alt" };

  it("shows the deck actually studied later, not the one merely opened earlier", () => {
    // The #415 report: Französisch opened at 09:30, PIT studied at 14:44.
    expect(
      pickShownDeck(
        { id: "fr", title: "Französisch", at: morning },
        { id: "pit", title: "PIT", reviewedAt: afternoon },
        edited
      )
    ).toEqual({ id: "pit", title: "PIT", source: "studied" });
  });

  it("keeps the local marker when it is the more recent signal", () => {
    // Quiz/Zuordnen write no review_logs, so this is the only trace of them.
    expect(
      pickShownDeck(
        { id: "pit", title: "PIT", at: afternoon },
        { id: "fr", title: "Französisch", reviewedAt: morning },
        edited
      )
    ).toEqual({ id: "pit", title: "PIT", source: "used" });
  });

  it("lets the dated server value beat an undated pre-#415 marker", () => {
    expect(
      pickShownDeck(
        { id: "fr", title: "Französisch", at: null },
        { id: "pit", title: "PIT", reviewedAt: afternoon },
        edited
      )
    ).toEqual({ id: "pit", title: "PIT", source: "studied" });
  });

  it("keeps the marker when the API is too old to send a timestamp", () => {
    expect(
      pickShownDeck(
        { id: "fr", title: "Französisch", at: morning },
        { id: "pit", title: "PIT" },
        edited
      )
    ).toEqual({ id: "fr", title: "Französisch", source: "used" });
  });

  it("falls back through studied, then edited, then nothing", () => {
    expect(pickShownDeck(null, { id: "pit", title: "PIT", reviewedAt: morning }, edited)).toEqual({
      id: "pit",
      title: "PIT",
      source: "studied",
    });
    expect(pickShownDeck(null, null, edited)).toEqual({ id: "old", title: "Alt", source: "edited" });
    expect(pickShownDeck(null, null, null)).toBeNull();
  });
});
