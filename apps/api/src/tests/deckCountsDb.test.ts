/**
 * Deck-Zähler (#612): getDeckWithCardCount zählt nach DERSELBEN Regel wie
 * listDecks — cardCount sind die Text-Karten, Bild-Occlusion-Karten stehen
 * getrennt in imageCardCount. Vorher zählte "Details" alles in einen Topf
 * ("30 Karten"), während der Deck-Kopf "20 Karten · 10 Bild-Karten" sagte.
 *
 * Ausserdem: listDecks holt die Bild-Karten-Zeilen seitenweise — ab 1000
 * Bild-Karten im Konto kappte PostgREST die Liste still und die Zähler logen.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: vi.fn() }));

import { getDeckWithCardCount, listDecks } from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase";

const mockedCreateDb = vi.mocked(createSupabaseAdminClient);

const USER_ID = "11111111-1111-4111-8111-111111111111";
const DECK_ID = "22222222-2222-4222-8222-222222222222";
const DECK_B = "33333333-3333-4333-8333-333333333333";

interface RecordedCall {
  method: string;
  args: unknown[];
}

function deckRow(id: string) {
  return {
    id,
    user_id: USER_ID,
    title: `Deck ${id.slice(0, 4)}`,
    tags: [],
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    deleted_at: null,
    cards: [{ count: 20 }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getDeckWithCardCount — Text- und Bild-Karten getrennt (#612)", () => {
  function makeDbMock(textCount: number, imageCount: number) {
    const calls: RecordedCall[] = [];
    const counts = [textCount, imageCount];
    let cardQuery = 0;

    const from = vi.fn((table: string) => {
      calls.push({ method: `from:${table}`, args: [] });
      if (table === "decks") {
        const builder: Record<string, unknown> = {};
        for (const method of ["select", "eq", "is"]) {
          builder[method] = () => builder;
        }
        builder.maybeSingle = async () => ({ data: deckRow(DECK_ID), error: null });
        return builder;
      }
      // cards-Zählungen: erst Text (neq occlusion), dann Bild (eq occlusion) —
      // die Reihenfolge entsteht synchron beim Aufbau des Promise.all-Arrays.
      const response = { count: counts[cardQuery++], data: null, error: null };
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "neq", "is"]) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ method, args });
          return builder;
        };
      }
      builder.then = (
        onFulfilled: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise.resolve(response).then(onFulfilled, onRejected);
      return builder;
    });

    return { db: { from } as never, calls };
  }

  it("liefert die geteilten Zähler des Deck-Kopfs, nicht mehr die Gesamtsumme", async () => {
    const { db } = makeDbMock(20, 10);
    mockedCreateDb.mockReturnValue(db);

    const deck = await getDeckWithCardCount(DECK_ID, USER_ID);

    // Vorher: cardCount 30 — "Details" widersprach dem Kopf.
    expect(deck?.cardCount).toBe(20);
    expect(deck?.imageCardCount).toBe(10);
  });

  it("filtert die beiden Zählungen gegenläufig nach card_type", async () => {
    const { db, calls } = makeDbMock(20, 10);
    mockedCreateDb.mockReturnValue(db);

    await getDeckWithCardCount(DECK_ID, USER_ID);

    expect(calls.filter((c) => c.method === "neq").map((c) => c.args)).toContainEqual([
      "card_type",
      "occlusion",
    ]);
    expect(calls.filter((c) => c.method === "eq").map((c) => c.args)).toContainEqual([
      "card_type",
      "occlusion",
    ]);
  });
});

describe("listDecks — Bild-Karten-Zuordnung übersteht die 1000er-Kappung (#612)", () => {
  it("zählt 1500 Bild-Karten über zwei Seiten vollständig", async () => {
    // 1200 Bild-Karten in Deck A, 300 in Deck B.
    const imageRows = [
      ...Array.from({ length: 1200 }, () => ({ deck_id: DECK_ID })),
      ...Array.from({ length: 300 }, () => ({ deck_id: DECK_B })),
    ];
    const rangeCalls: unknown[][] = [];

    const from = vi.fn((table: string) => {
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "neq", "is", "order"]) {
        builder[method] = () => builder;
      }
      if (table === "decks") {
        builder.then = (
          onFulfilled: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) =>
          Promise.resolve({ data: [deckRow(DECK_ID), deckRow(DECK_B)], error: null }).then(
            onFulfilled,
            onRejected
          );
        return builder;
      }
      builder.range = (fromIndex: number, toIndex: number) => {
        rangeCalls.push([fromIndex, toIndex]);
        return Promise.resolve({ data: imageRows.slice(fromIndex, toIndex + 1), error: null });
      };
      return builder;
    });
    mockedCreateDb.mockReturnValue({ from } as never);

    const decks = await listDecks(USER_ID);

    expect(decks.find((d) => d.id === DECK_ID)?.imageCardCount).toBe(1200);
    expect(decks.find((d) => d.id === DECK_B)?.imageCardCount).toBe(300);
    expect(rangeCalls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });
});
