/**
 * Data-layer tests for the folder IDOR fix (die Kurs-Hälfte fiel mit #437). The admin Supabase client
 * bypasses RLS, so every accessor must scope its query to the owning user_id.
 * These tests replace the admin client with a queued query-builder fake (same
 * pattern as deckStatsDb.test.ts / reviewStatsDb.test.ts) and assert BOTH the
 * behaviour (not-owned → null/false/empty) AND that the query carried the
 * `user_id` filter.
 *
 * The deck-link functions get special attention: linking a deck must verify
 * that the deck ALSO belongs to the caller, otherwise a user could attach
 * another user's deck to their own folder and read its metadata back.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: vi.fn() }));

import {
  listDecks,
  getFolder,
  updateFolder,
  deleteFolder,
  addDeckToFolder,
  removeDeckFromFolder,
  listDecksInFolder,
  setFolderDeckOrder,
} from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase";

const mockedCreateDb = vi.mocked(createSupabaseAdminClient);

const USER_ID = "11111111-1111-4111-8111-111111111111";
const FOLDER_ID = "44444444-4444-4444-8444-444444444444";
const DECK_ID = "55555555-5555-4555-8555-555555555555";

type QueryResponse = { data?: unknown; error: unknown };
interface RecordedCall {
  method: string;
  args: unknown[];
}

/**
 * One queued response is bound per `from()` call; awaiting the builder or
 * calling maybeSingle()/single() resolves it. Every chained method is recorded
 * so tests can assert the `user_id` scoping was applied.
 */
function makeDbMock(responses: QueryResponse[]) {
  const queue = [...responses];
  const calls: RecordedCall[] = [];

  const from = vi.fn().mockImplementation((table: string) => {
    calls.push({ method: "from", args: [table] });
    const response = queue.shift() ?? { data: null, error: null };
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "insert", "update", "delete", "upsert", "eq", "neq", "is", "order"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return builder;
      };
    }
    builder.maybeSingle = () => {
      calls.push({ method: "maybeSingle", args: [] });
      return Promise.resolve(response);
    };
    builder.single = () => {
      calls.push({ method: "single", args: [] });
      return Promise.resolve(response);
    };
    builder.then = (onFulfilled: (v: QueryResponse) => unknown, onRejected?: (r: unknown) => unknown) =>
      Promise.resolve(response).then(onFulfilled, onRejected);
    return builder;
  });

  return { db: { from } as never, calls };
}

const eqArgs = (calls: RecordedCall[]) => calls.filter((c) => c.method === "eq").map((c) => c.args);
const neqArgs = (calls: RecordedCall[]) => calls.filter((c) => c.method === "neq").map((c) => c.args);
const isArgs = (calls: RecordedCall[]) => calls.filter((c) => c.method === "is").map((c) => c.args);
const selectArgs = (calls: RecordedCall[]) => calls.filter((c) => c.method === "select").map((c) => c.args[0]);
const fromTables = (calls: RecordedCall[]) => calls.filter((c) => c.method === "from").map((c) => c.args[0]);

const folderDbRow = {
  id: FOLDER_ID,
  user_id: USER_ID,
  title: "Klasse 10",
  parent_id: null,
  color: null,
  created_at: "2026-07-15T00:00:00.000Z",
  updated_at: "2026-07-15T00:00:00.000Z",
};
const deckDbRow = {
  id: DECK_ID,
  user_id: USER_ID,
  title: "Zellbiologie",
  tags: [],
  deleted_at: null,
  created_at: "2026-07-15T00:00:00.000Z",
  updated_at: "2026-07-15T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Folders ──────────────────────── ────────────────────────────────────────

describe("getFolder — scoped to user_id", () => {
  it("filters by id and user_id and returns the row when owned", async () => {
    const { db, calls } = makeDbMock([{ data: folderDbRow, error: null }]);
    mockedCreateDb.mockReturnValue(db);

    const folder = await getFolder(FOLDER_ID, USER_ID);

    expect(folder?.id).toBe(FOLDER_ID);
    expect(eqArgs(calls)).toContainEqual(["id", FOLDER_ID]);
    expect(eqArgs(calls)).toContainEqual(["user_id", USER_ID]);
  });

  it("returns null when the scoped lookup finds nothing (not owned)", async () => {
    const { db } = makeDbMock([{ data: null, error: null }]);
    mockedCreateDb.mockReturnValue(db);

    expect(await getFolder(FOLDER_ID, USER_ID)).toBeNull();
  });
});

describe("updateFolder — scoped to user_id", () => {
  it("scopes the update by user_id and returns the updated row", async () => {
    const { db, calls } = makeDbMock([{ data: { ...folderDbRow, title: "Neu" }, error: null }]);
    mockedCreateDb.mockReturnValue(db);

    const updated = await updateFolder(FOLDER_ID, USER_ID, { title: "Neu" });

    expect(updated?.title).toBe("Neu");
    expect(eqArgs(calls)).toContainEqual(["user_id", USER_ID]);
  });

  it("returns null when not owned", async () => {
    const { db } = makeDbMock([{ data: null, error: null }]);
    mockedCreateDb.mockReturnValue(db);

    expect(await updateFolder(FOLDER_ID, USER_ID, { title: "Neu" })).toBeNull();
  });
});

describe("deleteFolder — scoped to user_id", () => {
  it("returns true when a scoped row was actually deleted", async () => {
    const { db, calls } = makeDbMock([{ data: { id: FOLDER_ID }, error: null }]);
    mockedCreateDb.mockReturnValue(db);

    expect(await deleteFolder(FOLDER_ID, USER_ID)).toBe(true);
    expect(eqArgs(calls)).toContainEqual(["user_id", USER_ID]);
  });

  it("returns false when nothing was deleted (not owned)", async () => {
    const { db } = makeDbMock([{ data: null, error: null }]);
    mockedCreateDb.mockReturnValue(db);

    expect(await deleteFolder(FOLDER_ID, USER_ID)).toBe(false);
  });
});

describe("addDeckToFolder — verifies folder AND deck ownership before linking", () => {
  it("links the deck when the caller owns both folder and deck", async () => {
    const { db, calls } = makeDbMock([
      { data: folderDbRow, error: null },
      { data: deckDbRow, error: null },
      { data: null, error: null },
    ]);
    mockedCreateDb.mockReturnValue(db);

    expect(await addDeckToFolder(FOLDER_ID, USER_ID, DECK_ID)).toBe(true);
    expect(fromTables(calls)).toEqual(["folders", "decks", "folder_decks"]);
  });

  it("rejects (false) and never links when the folder isn't owned", async () => {
    const { db, calls } = makeDbMock([{ data: null, error: null }]);
    mockedCreateDb.mockReturnValue(db);

    expect(await addDeckToFolder(FOLDER_ID, USER_ID, DECK_ID)).toBe(false);
    expect(fromTables(calls)).toEqual(["folders"]);
  });

  it("rejects (false) when the folder is owned but the DECK isn't the caller's", async () => {
    const { db, calls } = makeDbMock([
      { data: folderDbRow, error: null },
      { data: null, error: null },
    ]);
    mockedCreateDb.mockReturnValue(db);

    expect(await addDeckToFolder(FOLDER_ID, USER_ID, DECK_ID)).toBe(false);
    expect(fromTables(calls)).toEqual(["folders", "decks"]);
    expect(fromTables(calls)).not.toContain("folder_decks");
  });
});

describe("removeDeckFromFolder — requires folder ownership", () => {
  it("removes the link when the folder is owned", async () => {
    const { db, calls } = makeDbMock([
      { data: folderDbRow, error: null },
      { data: null, error: null },
    ]);
    mockedCreateDb.mockReturnValue(db);

    expect(await removeDeckFromFolder(FOLDER_ID, USER_ID, DECK_ID)).toBe(true);
    expect(fromTables(calls)).toEqual(["folders", "folder_decks"]);
  });

  it("returns false and touches nothing when the folder isn't owned", async () => {
    const { db, calls } = makeDbMock([{ data: null, error: null }]);
    mockedCreateDb.mockReturnValue(db);

    expect(await removeDeckFromFolder(FOLDER_ID, USER_ID, DECK_ID)).toBe(false);
    expect(fromTables(calls)).toEqual(["folders"]);
  });
});

describe("listDecksInFolder — requires folder ownership", () => {
  it("returns the owner's decks (empty array when owned but no decks)", async () => {
    const { db } = makeDbMock([
      { data: folderDbRow, error: null },
      { data: [], error: null },
    ]);
    mockedCreateDb.mockReturnValue(db);

    expect(await listDecksInFolder(FOLDER_ID, USER_ID)).toEqual([]);
  });

  it("returns null (not empty) when the folder isn't owned — route will 404", async () => {
    const { db, calls } = makeDbMock([{ data: null, error: null }]);
    mockedCreateDb.mockReturnValue(db);

    expect(await listDecksInFolder(FOLDER_ID, USER_ID)).toBeNull();
    expect(fromTables(calls)).toEqual(["folders"]);
  });

  it("carries cardCount through the embed instead of leaving it undefined", async () => {
    const { db, calls } = makeDbMock([
      { data: folderDbRow, error: null },
      { data: [{ deck_id: DECK_ID, decks: { ...deckDbRow, cards: [{ count: 7 }] } }], error: null },
    ]);
    mockedCreateDb.mockReturnValue(db);

    const decks = await listDecksInFolder(FOLDER_ID, USER_ID);

    expect(decks?.[0]?.cardCount).toBe(7);
    expect(selectArgs(calls)).toContain("deck_id, position, added_at, decks(*, cards(count))");
    expect(neqArgs(calls)).toContainEqual(["decks.cards.card_type", "occlusion"]);
    expect(isArgs(calls)).toContainEqual(["decks.cards.deleted_at", null]);
  });

  it("orders by position (nulls last), then added_at — a table has no order of its own (#437)", async () => {
    const { db, calls } = makeDbMock([
      { data: folderDbRow, error: null },
      { data: [], error: null },
    ]);
    mockedCreateDb.mockReturnValue(db);

    await listDecksInFolder(FOLDER_ID, USER_ID);

    const orderCalls = calls.filter((c) => c.method === "order").map((c) => c.args);
    expect(orderCalls).toEqual([
      ["position", { ascending: true, nullsFirst: false }],
      ["added_at", { ascending: true }],
    ]);
  });

  it("reports 0 (not undefined) for a deck holding only occlusion cards", async () => {
    // The filter empties the embed but PostgREST still returns the aggregate, so
    // the deck says "0 Karten" rather than falling back to "wird gezählt…".
    const { db } = makeDbMock([
      { data: folderDbRow, error: null },
      { data: [{ deck_id: DECK_ID, decks: { ...deckDbRow, cards: [{ count: 0 }] } }], error: null },
    ]);
    mockedCreateDb.mockReturnValue(db);

    const decks = await listDecksInFolder(FOLDER_ID, USER_ID);

    expect(decks?.[0]?.cardCount).toBe(0);
  });
});

describe("setFolderDeckOrder — requires folder ownership, updates only existing links (#437)", () => {
  const DECK_ID_2 = "66666666-6666-4666-8666-666666666666";

  it("writes position 0..n via UPDATE scoped to folder AND deck", async () => {
    const { db, calls } = makeDbMock([
      { data: folderDbRow, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);
    mockedCreateDb.mockReturnValue(db);

    expect(await setFolderDeckOrder(FOLDER_ID, USER_ID, [DECK_ID_2, DECK_ID])).toBe(true);
    expect(fromTables(calls)).toEqual(["folders", "folder_decks", "folder_decks"]);
    // UPDATE statt upsert: ein upsert könnte über die Sortier-Route eine NEUE
    // Zeile anlegen und so ein fremdes Deck in den Ordner hängen.
    expect(calls.filter((c) => c.method === "upsert")).toEqual([]);
    expect(calls.filter((c) => c.method === "update").map((c) => c.args[0])).toEqual([
      { position: 0 },
      { position: 1 },
    ]);
    expect(eqArgs(calls)).toContainEqual(["folder_id", FOLDER_ID]);
    expect(eqArgs(calls)).toContainEqual(["deck_id", DECK_ID_2]);
    expect(eqArgs(calls)).toContainEqual(["deck_id", DECK_ID]);
  });

  it("returns false and writes nothing when the folder isn't owned", async () => {
    const { db, calls } = makeDbMock([{ data: null, error: null }]);
    mockedCreateDb.mockReturnValue(db);

    expect(await setFolderDeckOrder(FOLDER_ID, USER_ID, [DECK_ID])).toBe(false);
    expect(fromTables(calls)).toEqual(["folders"]);
  });
});

// ─── Library (the count folders mirror) ─────────────────────────────

describe("listDecks — cardCount embed", () => {
  it("excludes soft-deleted cards from the count", async () => {
    const { db, calls } = makeDbMock([
      { data: [{ ...deckDbRow, cards: [{ count: 7 }] }], error: null },
    ]);
    mockedCreateDb.mockReturnValue(db);

    const decks = await listDecks(USER_ID);

    expect(decks[0]?.cardCount).toBe(7);
    // softDeleteCard only stamps deleted_at, so the row survives. Without this
    // filter the embed keeps counting it and the library overstates every deck
    // a card was ever deleted from — permanently, since nothing recounts later.
    expect(isArgs(calls)).toContainEqual(["cards.deleted_at", null]);
    // Scoped to the embed, not the decks table: the deck's own deleted_at filter
    // must stay intact alongside it.
    expect(isArgs(calls)).toContainEqual(["deleted_at", null]);
    expect(neqArgs(calls)).toContainEqual(["cards.card_type", "occlusion"]);
  });

  it("reports 0 (not undefined) for a deck whose cards are all deleted", async () => {
    const { db } = makeDbMock([
      { data: [{ ...deckDbRow, cards: [{ count: 0 }] }], error: null },
    ]);
    mockedCreateDb.mockReturnValue(db);

    expect((await listDecks(USER_ID))[0]?.cardCount).toBe(0);
  });
});
