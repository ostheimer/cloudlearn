import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: vi.fn() }));

import { getLastLearnedByDeck } from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase";

const mockedCreateDb = vi.mocked(createSupabaseAdminClient);
const USER_ID = "11111111-1111-4111-8111-111111111111";

interface RecordedCall {
  method: string;
  args: unknown[];
}

function makeDbMock(rows: unknown[]) {
  const calls: RecordedCall[] = [];
  let served = false;

  const from = vi.fn(() => {
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is", "order"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return builder;
      };
    }
    builder.range = (...args: unknown[]) => {
      calls.push({ method: "range", args });
      return builder;
    };
    builder.then = (
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => {
      // Erste Seite liefert die Zeilen, danach leer — so endet selectAllRows.
      const data = served ? [] : rows;
      served = true;
      return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
    };
    return builder;
  });

  return { db: { from } as never, calls };
}

function log(deckId: string, reviewedAt: string) {
  return { reviewed_at: reviewedAt, cards: { deck_id: deckId } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getLastLearnedByDeck (#614)", () => {
  it("nimmt je Deck die SPÄTESTE Antwort", async () => {
    const { db } = makeDbMock([
      log("bio", "2026-07-20T08:00:00.000Z"),
      log("bio", "2026-07-29T18:30:00.000Z"),
      log("bio", "2026-07-25T12:00:00.000Z"),
      log("chemie", "2026-07-10T09:00:00.000Z"),
    ]);
    mockedCreateDb.mockReturnValue(db);

    expect(await getLastLearnedByDeck(USER_ID)).toEqual({
      bio: "2026-07-29T18:30:00.000Z",
      chemie: "2026-07-10T09:00:00.000Z",
    });
  });

  it("zählt nur lebende Karten in lebenden Decks", async () => {
    // Ohne diese Filter stünde ein Deck aus dem Papierkorb in der Sortierung —
    // dieselbe Liveness-Regel wie bei allen gehärteten Lesern (#495).
    const { db, calls } = makeDbMock([]);
    mockedCreateDb.mockReturnValue(db);

    await getLastLearnedByDeck(USER_ID);

    expect(calls.find((c) => c.method === "select")?.args[0]).toContain("cards!inner");
    expect(calls.find((c) => c.method === "select")?.args[0]).toContain("decks!inner");
    expect(calls.filter((c) => c.method === "is").map((c) => c.args)).toEqual([
      ["cards.deleted_at", null],
      ["cards.decks.deleted_at", null],
    ]);
    expect(calls.filter((c) => c.method === "eq").map((c) => c.args)).toEqual([
      ["user_id", USER_ID],
    ]);
  });

  it("blättert deterministisch statt bei 1000 Zeilen still zu kappen", async () => {
    // Bei ~180 Karten pro Stunde ist die 1000er-Grenze nach wenigen Sitzungen
    // erreicht; ohne Blättern fehlen ausgerechnet die neuesten Tage (#612).
    const { db, calls } = makeDbMock([]);
    mockedCreateDb.mockReturnValue(db);

    await getLastLearnedByDeck(USER_ID);

    expect(calls.find((c) => c.method === "order")?.args).toEqual([
      "id",
      { ascending: true },
    ]);
    expect(calls.some((c) => c.method === "range")).toBe(true);
  });

  it("überspringt Zeilen ohne Deck oder ohne Zeitstempel", async () => {
    const { db } = makeDbMock([
      log("bio", "2026-07-20T08:00:00.000Z"),
      { reviewed_at: "2026-07-21T08:00:00.000Z", cards: null },
      { reviewed_at: null, cards: { deck_id: "chemie" } },
    ]);
    mockedCreateDb.mockReturnValue(db);

    expect(await getLastLearnedByDeck(USER_ID)).toEqual({
      bio: "2026-07-20T08:00:00.000Z",
    });
  });

  it("gibt für ein Konto ohne Antworten ein leeres Ergebnis", async () => {
    const { db } = makeDbMock([]);
    mockedCreateDb.mockReturnValue(db);
    expect(await getLastLearnedByDeck(USER_ID)).toEqual({});
  });
});
