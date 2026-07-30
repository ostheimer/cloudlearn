import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: vi.fn() }));

import { softDeleteCardsByIds } from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase";

const mockedCreateDb = vi.mocked(createSupabaseAdminClient);
const USER_ID = "11111111-1111-4111-8111-111111111111";
const DECK_ID = "22222222-2222-4222-8222-222222222222";

/** Schreibt je Aufruf mit, wie viele IDs in der `in(...)`-Liste standen. */
function makeDbMock(hitsPerChunk: (ids: string[]) => number) {
  const chunkSizes: number[] = [];
  const stamps = new Set<string>();

  const from = vi.fn(() => {
    let ids: string[] = [];
    const builder: Record<string, unknown> = {};
    for (const method of ["update", "eq", "is", "select"]) {
      builder[method] = (...args: unknown[]) => {
        if (method === "update") stamps.add(String((args[0] as { deleted_at: string }).deleted_at));
        return builder;
      };
    }
    builder.in = (_column: string, value: string[]) => {
      ids = value;
      chunkSizes.push(value.length);
      return builder;
    };
    builder.then = (
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) =>
      Promise.resolve({
        data: ids.slice(0, hitsPerChunk(ids)).map((id) => ({ id })),
        error: null,
      }).then(onFulfilled, onRejected);
    return builder;
  });

  return { db: { from } as never, chunkSizes, stamps };
}

function ids(count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) => `cccccccc-cccc-4ccc-8ccc-cccccccc${String(i).padStart(4, "0")}`
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("softDeleteCardsByIds — stückweise statt in einer Riesen-Adresse (#614)", () => {
  it("schickt bis 200 IDs in einer Anfrage", async () => {
    const { db, chunkSizes } = makeDbMock((chunk) => chunk.length);
    mockedCreateDb.mockReturnValue(db);

    expect(await softDeleteCardsByIds(USER_ID, DECK_ID, ids(200))).toBe(200);
    expect(chunkSizes).toEqual([200]);
  });

  it("teilt eine Auswahl über 200 auf und summiert die Treffer", async () => {
    // 2.000 UUIDs in einem `in(...)` ergeben rund 78 kB Query-String — PostgREST
    // setzt die Liste in die Adresse, und über etwa 8 kB bricht die Anfrage ab.
    // Vor der Aufteilung wäre „alle Karten eines Pro-Decks löschen" also
    // vollständig gescheitert, nicht teilweise.
    const { db, chunkSizes } = makeDbMock((chunk) => chunk.length);
    mockedCreateDb.mockReturnValue(db);

    expect(await softDeleteCardsByIds(USER_ID, DECK_ID, ids(450))).toBe(450);
    expect(chunkSizes).toEqual([200, 200, 50]);
  });

  it("stempelt alle Stücke mit DERSELBEN Zeit", async () => {
    // Ein Mehrfach-Löschen ist ein Vorgang. Ein gemeinsamer Zeitstempel hält die
    // Karten im Papierkorb zusammen — dieselbe Idee wie beim Deck-Löschen.
    const { db, stamps } = makeDbMock((chunk) => chunk.length);
    mockedCreateDb.mockReturnValue(db);

    await softDeleteCardsByIds(USER_ID, DECK_ID, ids(450));
    expect(stamps.size).toBe(1);
  });

  it("zählt nur, was wirklich getroffen wurde", async () => {
    // Jedes Stück meldet nur die Hälfte als geändert (der Rest war schon weg).
    const { db } = makeDbMock((chunk) => Math.floor(chunk.length / 2));
    mockedCreateDb.mockReturnValue(db);

    expect(await softDeleteCardsByIds(USER_ID, DECK_ID, ids(400))).toBe(200);
  });

  it("fragt bei leerer Liste gar nicht nach", async () => {
    const { db, chunkSizes } = makeDbMock((chunk) => chunk.length);
    mockedCreateDb.mockReturnValue(db);

    expect(await softDeleteCardsByIds(USER_ID, DECK_ID, [])).toBe(0);
    expect(chunkSizes).toEqual([]);
  });
});
