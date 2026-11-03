import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: vi.fn() }));

import { listTrash, purgeAllTrash, restoreDeckWithinLimit } from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase";

const mockedCreateDb = vi.mocked(createSupabaseAdminClient);
const USER_ID = "11111111-1111-4111-8111-111111111111";
const DECK_ID = "22222222-2222-4222-8222-222222222222";
const DELETED_AT = "2026-07-09T12:00:00.000Z";

interface RecordedCall {
  table: string;
  method: string;
  args: unknown[];
}

/**
 * Eine Supabase-Attrappe, die jeden Kettenaufruf samt Tabelle mitschreibt.
 *
 * `responses` liefert die Antwort je Tabelle in der Reihenfolge der `from()`-
 * Aufrufe — restoreDeck fasst dieselbe Tabelle mehrfach an (lesen, dann Karten,
 * dann Deck), und genau diese Reihenfolge ist das, was der Test prüft.
 */
function makeDbMock(responses: Record<string, unknown[]>) {
  const calls: RecordedCall[] = [];
  const cursor: Record<string, number> = {};

  const from = vi.fn((table: string) => {
    const index = cursor[table] ?? 0;
    cursor[table] = index + 1;
    const response = responses[table]?.[index] ?? { data: null, error: null };
    const builder: Record<string, unknown> = {};
    for (const method of [
      "select",
      "eq",
      "in",
      "is",
      "not",
      "update",
      "delete",
      "order",
      "range",
      "maybeSingle",
    ]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        // maybeSingle beendet die Kette und liefert die Antwort.
        return method === "maybeSingle" ? Promise.resolve(response) : builder;
      };
    }
    builder.then = (
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(response).then(onFulfilled, onRejected);
    calls.push({ table, method: "from", args: [table] });
    return builder;
  });

  return { db: { from } as never, calls };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listTrash", () => {
  it("zeigt einzelne Karten nur aus LEBENDEN Decks", async () => {
    const { db, calls } = makeDbMock({
      decks: [{ data: [], error: null }],
      cards: [{ data: [], error: null }],
    });
    mockedCreateDb.mockReturnValue(db);

    await listTrash(USER_ID);

    // Die Kartenabfrage joint verpflichtend aufs Deck und verlangt, dass es lebt.
    // Ohne das stünden die Karten eines gelöschten Decks doppelt im Papierkorb —
    // einmal am Deck und einmal einzeln, wo ihr Zurückholen scheitern müsste.
    const cardSelect = calls.find((c) => c.table === "cards" && c.method === "select");
    expect(cardSelect?.args[0]).toContain("decks!inner");
    expect(
      calls.filter((c) => c.table === "cards" && c.method === "is").map((c) => c.args)
    ).toEqual([["decks.deleted_at", null]]);
    expect(
      calls.filter((c) => c.table === "cards" && c.method === "not").map((c) => c.args)
    ).toEqual([["deleted_at", "is", null]]);
  });

  it("zählt beim gelöschten Deck nur Karten mit demselben Löschzeitpunkt wie das Deck (#702)", async () => {
    const EARLIER = "2026-07-01T09:00:00.000Z";
    const { db, calls } = makeDbMock({
      decks: [
        { data: [{ id: DECK_ID, title: "Waidmannssprache", deleted_at: DELETED_AT }], error: null },
      ],
      cards: [
        // 1. Zeitstempel-Abfrage für den Kartenzähler (neu, #702).
        {
          data: [
            { deck_id: DECK_ID, deleted_at: DELETED_AT },
            { deck_id: DECK_ID, deleted_at: DELETED_AT },
            // Individuell VOR dem Deck gelöscht (älterer Stempel) — restoreDeck
            // holt diese Karte nicht zurück, sie darf also auch nicht mitzählen.
            { deck_id: DECK_ID, deleted_at: EARLIER },
          ],
          error: null,
        },
        // 2. „listTrash cards" — einzeln gelöschte Karten in lebenden Decks (hier keine).
        { data: [], error: null },
      ],
    });
    mockedCreateDb.mockReturnValue(db);

    const trash = await listTrash(USER_ID);

    // 3 gelöschte Karten insgesamt, aber nur 2 tragen denselben Stempel wie das
    // Deck — genau die, die restoreDeck auch tatsächlich zurückholen würde.
    expect(trash.decks).toEqual([
      { id: DECK_ID, title: "Waidmannssprache", cardCount: 2, deletedAt: DELETED_AT },
    ]);

    // Dieselbe Grundbedingung wie restoreDeck (user_id + deck_id + „gelöscht"),
    // der exakte Zeitstempel-Abgleich läuft danach in JS.
    const countQueryIn = calls.filter((c) => c.table === "cards" && c.method === "in");
    expect(countQueryIn.map((c) => c.args)).toEqual([["deck_id", [DECK_ID]]]);
  });
});

describe("restoreDeckWithinLimit", () => {
  it("delegiert Limit-Prüfung und Restore an eine atomare Datenbankfunktion", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "restored", error: null });
    mockedCreateDb.mockReturnValue({ rpc } as never);

    expect(await restoreDeckWithinLimit(DECK_ID, USER_ID, 20)).toBe("restored");
    expect(rpc).toHaveBeenCalledWith("restore_deck_with_limit", {
      p_deck: DECK_ID,
      p_user: USER_ID,
      p_max_decks: 20,
    });
  });
});

describe("purgeAllTrash", () => {
  it("löscht zuerst die Karten, dann die Decks", async () => {
    const { db, calls } = makeDbMock({
      cards: [{ data: [{ id: "c1" }, { id: "c2" }], error: null }],
      decks: [{ data: [{ id: "d1" }], error: null }],
    });
    mockedCreateDb.mockReturnValue(db);

    expect(await purgeAllTrash(USER_ID)).toEqual({ decks: 1, cards: 2 });

    // Karten zuerst: einzeln gelöschte Karten in LEBENDEN Decks fallen nicht
    // über den Deck-Cascade, die erwischt nur dieser erste Schritt.
    expect(calls.filter((c) => c.method === "delete").map((c) => c.table)).toEqual([
      "cards",
      "decks",
    ]);

    // Sicherung: nur Gestempeltes darf verschwinden, nie eine lebende Zeile.
    for (const table of ["cards", "decks"]) {
      expect(
        calls.filter((c) => c.table === table && c.method === "not").map((c) => c.args)
      ).toEqual([["deleted_at", "is", null]]);
    }
  });
});
