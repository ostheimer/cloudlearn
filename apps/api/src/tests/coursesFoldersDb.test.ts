/**
 * Data-layer tests for the course & folder IDOR fix. The admin Supabase client
 * bypasses RLS, so every accessor must scope its query to the owning user_id.
 * These tests replace the admin client with a queued query-builder fake (same
 * pattern as deckStatsDb.test.ts / reviewStatsDb.test.ts) and assert BOTH the
 * behaviour (not-owned → null/false/empty) AND that the query carried the
 * `user_id` filter.
 *
 * The deck-link functions get special attention: linking a deck must verify
 * that the deck ALSO belongs to the caller, otherwise a user could attach
 * another user's deck to their own course/folder and read its metadata back.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: vi.fn() }));

import {
  listDecks,
  getCourse,
  updateCourse,
  deleteCourse,
  addDeckToCourse,
  removeDeckFromCourse,
  listDecksInCourse,
  getFolder,
  updateFolder,
  deleteFolder,
  addDeckToFolder,
  removeDeckFromFolder,
  listDecksInFolder,
} from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase";

const mockedCreateDb = vi.mocked(createSupabaseAdminClient);

const USER_ID = "11111111-1111-4111-8111-111111111111";
const COURSE_ID = "33333333-3333-4333-8333-333333333333";
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

const courseDbRow = {
  id: COURSE_ID,
  user_id: USER_ID,
  title: "Bio",
  description: null,
  color: null,
  created_at: "2026-07-15T00:00:00.000Z",
  updated_at: "2026-07-15T00:00:00.000Z",
};
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

describe("listDecks — cardCount ignores deleted cards", () => {
  it("filters soft-deleted cards out of the embedded card count", async () => {
    const { db, calls } = makeDbMock([{ data: [{ ...deckDbRow, cards: [{ count: 2 }] }], error: null }]);
    mockedCreateDb.mockReturnValue(db);

    const decks = await listDecks(USER_ID);

    expect(decks[0]?.cardCount).toBe(2);
    expect(selectArgs(calls)).toContain("*, cards(count)");
    expect(neqArgs(calls)).toContainEqual(["cards.card_type", "occlusion"]);
    expect(isArgs(calls)).toContainEqual(["cards.deleted_at", null]);
  });
});

// ─── Courses ─────────────────────────────────────────────────────────────────

describe("getCourse — scoped to user_id", () => {
  it("filters by both id and user_id and returns the row when owned", async () => {
    const { db, calls } = makeDbMock([{ data: courseDbRow, error: null }]);
    mockedCreateDb.mockReturnValue(db);

    const course = await getCourse(COURSE_ID, USER_ID);

    expect(course?.id).toBe(COURSE_ID);
    expect(eqArgs(calls)).toContainEqual(["id", COURSE_ID]);
    expect(eqArgs(calls)).toContainEqual(["user_id", USER_ID]);
  });

  it("returns null when the scoped lookup finds nothing (not owned)", async () => {
    const { db, calls } = makeDbMock([{ data: null, error: null }]);
    mockedCreateDb.mockReturnValue(db);

    expect(await getCourse(COURSE_ID, USER_ID)).toBeNull();
    expect(eqArgs(calls)).toContainEqual(["user_id", USER_ID]);
  });
});

describe("updateCourse — scoped to user_id", () => {
  it("scopes the update by user_id and returns the updated row", async () => {
    const { db, calls } = makeDbMock([{ data: { ...courseDbRow, title: "Neu" }, error: null }]);
    mockedCreateDb.mockReturnValue(db);

    const updated = await updateCourse(COURSE_ID, USER_ID, { title: "Neu" });

    expect(updated?.title).toBe("Neu");
    expect(eqArgs(calls)).toContainEqual(["id", COURSE_ID]);
    expect(eqArgs(calls)).toContainEqual(["user_id", USER_ID]);
  });

  it("returns null when the scoped update matched no row (not owned)", async () => {
    const { db } = makeDbMock([{ data: null, error: null }]);
    mockedCreateDb.mockReturnValue(db);

    expect(await updateCourse(COURSE_ID, USER_ID, { title: "Neu" })).toBeNull();
  });
});

describe("deleteCourse — scoped to user_id", () => {
  it("returns true when a scoped row was actually deleted", async () => {
    const { db, calls } = makeDbMock([{ data: { id: COURSE_ID }, error: null }]);
    mockedCreateDb.mockReturnValue(db);

    expect(await deleteCourse(COURSE_ID, USER_ID)).toBe(true);
    expect(eqArgs(calls)).toContainEqual(["user_id", USER_ID]);
  });

  it("returns false when nothing was deleted (not owned) — route will 404", async () => {
    const { db, calls } = makeDbMock([{ data: null, error: null }]);
    mockedCreateDb.mockReturnValue(db);

    expect(await deleteCourse(COURSE_ID, USER_ID)).toBe(false);
    expect(eqArgs(calls)).toContainEqual(["user_id", USER_ID]);
  });
});

describe("addDeckToCourse — verifies course AND deck ownership before linking", () => {
  it("links the deck when the caller owns both course and deck", async () => {
    // 1: getCourse → owned, 2: getDeck → owned, 3: upsert into course_decks
    const { db, calls } = makeDbMock([
      { data: courseDbRow, error: null },
      { data: deckDbRow, error: null },
      { data: null, error: null },
    ]);
    mockedCreateDb.mockReturnValue(db);

    expect(await addDeckToCourse(COURSE_ID, USER_ID, DECK_ID, 0)).toBe(true);
    expect(fromTables(calls)).toEqual(["courses", "decks", "course_decks"]);
    // The deck lookup was scoped to the caller.
    expect(eqArgs(calls)).toContainEqual(["id", DECK_ID]);
    expect(eqArgs(calls)).toContainEqual(["user_id", USER_ID]);
  });

  it("rejects (false) and never links when the course isn't owned", async () => {
    const { db, calls } = makeDbMock([{ data: null, error: null }]); // getCourse → null
    mockedCreateDb.mockReturnValue(db);

    expect(await addDeckToCourse(COURSE_ID, USER_ID, DECK_ID, 0)).toBe(false);
    // Bailed after the course check — deck was never queried, nothing inserted.
    expect(fromTables(calls)).toEqual(["courses"]);
  });

  it("rejects (false) when the course is owned but the DECK isn't the caller's", async () => {
    const { db, calls } = makeDbMock([
      { data: courseDbRow, error: null }, // getCourse → owned
      { data: null, error: null }, // getDeck → not owned
    ]);
    mockedCreateDb.mockReturnValue(db);

    expect(await addDeckToCourse(COURSE_ID, USER_ID, DECK_ID, 0)).toBe(false);
    // Verified the deck, then bailed — never inserted into course_decks.
    expect(fromTables(calls)).toEqual(["courses", "decks"]);
    expect(fromTables(calls)).not.toContain("course_decks");
  });
});

describe("removeDeckFromCourse — requires course ownership", () => {
  it("removes the link when the course is owned", async () => {
    const { db, calls } = makeDbMock([
      { data: courseDbRow, error: null }, // getCourse → owned
      { data: null, error: null }, // delete from course_decks
    ]);
    mockedCreateDb.mockReturnValue(db);

    expect(await removeDeckFromCourse(COURSE_ID, USER_ID, DECK_ID)).toBe(true);
    expect(fromTables(calls)).toEqual(["courses", "course_decks"]);
  });

  it("returns false and touches nothing when the course isn't owned", async () => {
    const { db, calls } = makeDbMock([{ data: null, error: null }]); // getCourse → null
    mockedCreateDb.mockReturnValue(db);

    expect(await removeDeckFromCourse(COURSE_ID, USER_ID, DECK_ID)).toBe(false);
    expect(fromTables(calls)).toEqual(["courses"]);
  });
});

describe("listDecksInCourse — requires course ownership", () => {
  it("returns the owner's decks (empty array when owned but no decks)", async () => {
    const { db } = makeDbMock([
      { data: courseDbRow, error: null }, // getCourse → owned
      { data: [], error: null }, // course_decks join
    ]);
    mockedCreateDb.mockReturnValue(db);

    expect(await listDecksInCourse(COURSE_ID, USER_ID)).toEqual([]);
  });

  it("returns null (not empty) when the course isn't owned — route will 404", async () => {
    const { db, calls } = makeDbMock([{ data: null, error: null }]); // getCourse → null
    mockedCreateDb.mockReturnValue(db);

    expect(await listDecksInCourse(COURSE_ID, USER_ID)).toBeNull();
    expect(fromTables(calls)).toEqual(["courses"]);
  });

  it("filters out any joined deck not belonging to the caller (defense in depth)", async () => {
    const foreignDeck = { ...deckDbRow, id: "99999999-9999-4999-8999-999999999999", user_id: "someone-else" };
    const { db } = makeDbMock([
      { data: courseDbRow, error: null },
      {
        data: [
          { deck_id: DECK_ID, position: 0, decks: deckDbRow },
          { deck_id: foreignDeck.id, position: 1, decks: foreignDeck },
        ],
        error: null,
      },
    ]);
    mockedCreateDb.mockReturnValue(db);

    const decks = await listDecksInCourse(COURSE_ID, USER_ID);
    expect(decks?.map((d) => d.id)).toEqual([DECK_ID]);
  });

  it("carries cardCount through the embed instead of leaving it undefined", async () => {
    const { db, calls } = makeDbMock([
      { data: courseDbRow, error: null },
      { data: [{ deck_id: DECK_ID, position: 0, decks: { ...deckDbRow, cards: [{ count: 7 }] } }], error: null },
    ]);
    mockedCreateDb.mockReturnValue(db);

    const decks = await listDecksInCourse(COURSE_ID, USER_ID);

    expect(decks?.[0]?.cardCount).toBe(7);
    // mapDeckRow reads row.cards[0].count — without the nested embed the count
    // never arrives and every deck reports "undefined" cards.
    expect(selectArgs(calls)).toContain("deck_id, position, decks(*, cards(count))");
    // Occlusion cards are their own mode and must not inflate the count (listDecks
    // filters them the same way, one level up).
    expect(neqArgs(calls)).toContainEqual(["decks.cards.card_type", "occlusion"]);
    expect(isArgs(calls)).toContainEqual(["decks.cards.deleted_at", null]);
  });
});

// ─── Folders (symmetric with courses) ────────────────────────────────────────

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
    expect(selectArgs(calls)).toContain("deck_id, decks(*, cards(count))");
    expect(neqArgs(calls)).toContainEqual(["decks.cards.card_type", "occlusion"]);
    expect(isArgs(calls)).toContainEqual(["decks.cards.deleted_at", null]);
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
