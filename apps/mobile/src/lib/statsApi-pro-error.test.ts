import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: "test-token" } },
      })),
    },
  },
}));

import { fetchDeckStats, fetchDeckSummaries } from "./statsApi";
import { ApiError } from "./api";

const fetchMock = vi.fn();

// #377/#387: Deck-Vergleich und Einzel-Deck-Statistik sind Pro-only. Die
// Bildschirme erkennen die Server-Absage an `instanceof ApiError` plus
// code/status (403/PRO_REQUIRED) und zeigen dann den Schloss-Teaser. Warf
// statsApi nur ein nacktes Error, lief diese Prüfung ins Leere — Free sah
// statt des Teasers dauerhaft „Konnte die Deck-Liste nicht laden."
describe("statsApi – Serverfehler tragen Status und Code (Pro-Teaser)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("meldet die Pro-Schranke als ApiError mit 403/PRO_REQUIRED", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        code: "PRO_REQUIRED",
        message: "Deck comparison is part of Pro statistics.",
        request_id: "req-1",
      }),
    });

    const error: unknown = await fetchDeckSummaries().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    // Exakt die Bedingung aus stats.tsx bzw. deck-stats/[id].tsx:
    expect(
      error instanceof ApiError &&
        (error.code === "PRO_REQUIRED" || error.status === 403)
    ).toBe(true);
  });

  it("auch die Einzel-Deck-Statistik wirft die Pro-Absage als ApiError", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        code: "PRO_REQUIRED",
        message: "Deck stats are part of Pro statistics.",
        request_id: "req-2",
      }),
    });

    const error: unknown = await fetchDeckStats("deck-1").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error instanceof ApiError && error.code).toBe("PRO_REQUIRED");
  });

  it("gewöhnliche Serverfehler bleiben ApiError OHNE Pro-Code (kein Teaser)", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: "boom" }),
    });

    const error: unknown = await fetchDeckSummaries().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error instanceof ApiError && error.status).toBe(500);
    expect(error instanceof ApiError && error.code).toBeUndefined();
  });
});
