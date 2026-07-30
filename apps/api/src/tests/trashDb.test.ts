import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: vi.fn() }));

import { listTrash, purgeAllTrash, restoreDeck } from "@/lib/db";
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

  it("zählt beim gelöschten Deck ALLE Karten, nicht nur lebende", async () => {
    const { db } = makeDbMock({
      decks: [
        {
          data: [
            { id: DECK_ID, title: "Waidmannssprache", deleted_at: DELETED_AT, cards: [{ count: 16 }] },
          ],
          error: null,
        },
      ],
      cards: [{ data: [], error: null }],
    });
    mockedCreateDb.mockReturnValue(db);

    const trash = await listTrash(USER_ID);
    expect(trash.decks).toEqual([
      { id: DECK_ID, title: "Waidmannssprache", cardCount: 16, deletedAt: DELETED_AT },
    ]);
  });
});

describe("restoreDeck", () => {
  it("holt nur die Karten zurück, die MIT dem Deck gelöscht wurden", async () => {
    const { db, calls } = makeDbMock({
      decks: [
        // 1. getDeletedDeck
        { data: { id: DECK_ID, title: "Waidmannssprache", deleted_at: DELETED_AT }, error: null },
        // 2. Deck selbst wiederbeleben
        { data: { id: DECK_ID }, error: null },
      ],
      cards: [{ data: null, error: null }],
    });
    mockedCreateDb.mockReturnValue(db);

    expect(await restoreDeck(DECK_ID, USER_ID)).toBe(true);

    // Der Kern der Regel: die Karten werden über den EXAKTEN Zeitstempel des
    // Decks gefiltert (`eq`), nicht über „irgendwie gelöscht". Eine vorher
    // einzeln weggeworfene Karte trägt einen älteren Stempel und bleibt weg —
    // Laras Entscheidung „selbst Gelöschtes kommt nicht zurück".
    const cardEqs = calls.filter((c) => c.table === "cards" && c.method === "eq");
    expect(cardEqs.map((c) => c.args)).toEqual([
      ["deck_id", DECK_ID],
      ["user_id", USER_ID],
      ["deleted_at", DELETED_AT],
    ]);

    // Reihenfolge Karten -> Deck: bricht der zweite Schritt ab, bleiben die
    // Karten unter einem noch gelöschten Deck unsichtbar, statt ein sichtbar
    // leeres Deck zu hinterlassen.
    const updates = calls.filter((c) => c.method === "update").map((c) => c.table);
    expect(updates).toEqual(["cards", "decks"]);
  });

  it("tut nichts, wenn das Deck nicht im Papierkorb liegt", async () => {
    const { db, calls } = makeDbMock({ decks: [{ data: null, error: null }] });
    mockedCreateDb.mockReturnValue(db);

    expect(await restoreDeck(DECK_ID, USER_ID)).toBe(false);
    expect(calls.some((c) => c.method === "update")).toBe(false);
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
