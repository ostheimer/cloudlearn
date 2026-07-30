/**
 * countDecksByFolder + listCardsInFolder und ihre Routen (#612, N+1-Hälfte).
 *
 * Die Ordner-Kacheln holten ihre "3 Decks"-Zeile mit einer eigenen Anfrage pro
 * Ordner, und "Alle Karten lernen" holte die Karten mit einer Anfrage pro Deck.
 * Beides ersetzt jetzt eine gebündelte Server-Abfrage. Die Tests pinnen das,
 * worauf sich die Clients dabei verlassen:
 *
 *  - Fremde und weich gelöschte Decks zählen nicht mit (sonst versprechen die
 *    Kacheln Decks, die die Ordnerseite gar nicht zeigt — Liveness-Regel #495).
 *  - Beide Funktionen blättern über PostgREST' stille 1000-Zeilen-Grenze hinweg,
 *    denn genau dort fingen die alten Zahlen an zu lügen.
 *  - listCardsInFolder behält die Deck-Reihenfolge des Ordners (#437), damit
 *    sich eine Ordner-Runde nach der Umstellung genauso durchlernt wie vorher.
 *  - Ein fremder Ordner ist von einem nicht existierenden nicht zu unterscheiden
 *    (null → 404), und der Zähl-Endpunkt ist auf den Token-Nutzer festgenagelt.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/http", () => ({
  jsonOk: (_requestId: string, data: unknown, status = 200) => ({
    status,
    json: async () => data,
  }),
  jsonError: (requestId: string, code: string, message: string, status = 400) => ({
    status,
    json: async () => ({ code, message, request_id: requestId }),
  }),
  normalizeError: (error: unknown) => ({
    code: "INTERNAL_ERROR",
    message: error instanceof Error ? error.message : "Unknown error",
    status: 500,
  }),
}));
vi.mock("@/lib/observability", () => ({
  createRequestContext: () => ({ requestId: "req-folder-counts-1" }),
}));

import { countDecksByFolder, listCardsInFolder } from "@/lib/db";
import { GET as GET_COUNTS } from "../../app/api/v1/stats/decks-by-folder/route";
import { GET as GET_CARDS } from "../../app/api/v1/folders/[id]/cards/route";
import { getAuthUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase";

const mockedCreateDb = vi.mocked(createSupabaseAdminClient);
const mockedGetAuthUser = vi.mocked(getAuthUser);

const USER_ID = "11111111-1111-4111-8111-111111111111";
const FOLDER_A = "44444444-4444-4444-8444-444444444444";
const FOLDER_B = "44444444-4444-4444-8444-444444444445";
const DECK_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DECK_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

interface RecordedCall {
  method: string;
  args: unknown[];
}
type TableResponse = { data: unknown; error: unknown } | unknown[];

/**
 * Query-Builder-Attrappe je Tabelle statt je Aufruf: selectAllRows ruft
 * `db.from(...)` für JEDE Seite neu, eine Warteschlange müsste also pro Seite
 * gefüttert werden. Arrays werden seitenweise bedient — `range` schneidet sie
 * wie PostgREST zu, damit das Blättern echt getestet wird.
 */
function makeDbMock(tables: Record<string, TableResponse>) {
  const calls: RecordedCall[] = [];

  const from = vi.fn((table: string) => {
    calls.push({ method: "from", args: [table] });
    const entry = tables[table] ?? { data: null, error: null };
    const rows = Array.isArray(entry) ? entry : null;
    const response = Array.isArray(entry) ? { data: entry, error: null } : entry;

    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "neq", "is", "in", "order"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return builder;
      };
    }
    builder.maybeSingle = () => {
      calls.push({ method: "maybeSingle", args: [] });
      return Promise.resolve(response);
    };
    builder.range = (fromIndex: number, toIndex: number) => {
      calls.push({ method: "range", args: [fromIndex, toIndex] });
      return Promise.resolve(
        rows ? { data: rows.slice(fromIndex, toIndex + 1), error: null } : response
      );
    };
    builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (r: unknown) => unknown) =>
      Promise.resolve(response).then(onFulfilled, onRejected);
    return builder;
  });

  return { db: { from } as never, calls };
}

const folderRow = {
  id: FOLDER_A,
  user_id: USER_ID,
  title: "Klasse 10",
  parent_id: null,
  color: null,
  created_at: "2026-07-15T00:00:00.000Z",
  updated_at: "2026-07-15T00:00:00.000Z",
};

const cardRow = (id: string, deckId: string, createdAt: string) => ({
  id,
  user_id: USER_ID,
  deck_id: deckId,
  front: `Frage ${id}`,
  back: `Antwort ${id}`,
  card_type: "basic",
  created_at: createdAt,
  updated_at: createdAt,
  deleted_at: null,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("countDecksByFolder – eine gruppierte Zählung statt Anfrage-je-Ordner", () => {
  it("zählt die Decks je Ordner", async () => {
    const { db } = makeDbMock({
      folder_decks: [
        { folder_id: FOLDER_A },
        { folder_id: FOLDER_A },
        { folder_id: FOLDER_B },
      ],
    });
    mockedCreateDb.mockReturnValue(db);

    await expect(countDecksByFolder(USER_ID)).resolves.toEqual({
      [FOLDER_A]: 2,
      [FOLDER_B]: 1,
    });
  });

  it("leeres Ergebnis, wenn in keinem Ordner ein Deck liegt", async () => {
    const { db } = makeDbMock({ folder_decks: [] });
    mockedCreateDb.mockReturnValue(db);

    await expect(countDecksByFolder(USER_ID)).resolves.toEqual({});
  });

  it("zählt über die 1000-Zeilen-Grenze hinaus vollständig", async () => {
    const rows = [
      ...Array.from({ length: 1200 }, () => ({ folder_id: FOLDER_A })),
      ...Array.from({ length: 50 }, () => ({ folder_id: FOLDER_B })),
    ];
    const { db, calls } = makeDbMock({ folder_decks: rows });
    mockedCreateDb.mockReturnValue(db);

    await expect(countDecksByFolder(USER_ID)).resolves.toEqual({
      [FOLDER_A]: 1200,
      [FOLDER_B]: 50,
    });
    expect(calls.filter((c) => c.method === "range").map((c) => c.args)).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("filtert auf eigene Ordner UND lebende eigene Decks", async () => {
    const { db, calls } = makeDbMock({ folder_decks: [] });
    mockedCreateDb.mockReturnValue(db);

    await countDecksByFolder(USER_ID);

    // Nur folder_id fließt über die Leitung, die Joins dienen dem Filtern.
    expect(calls.find((c) => c.method === "select")?.args[0]).toBe(
      "folder_id, folders!inner(user_id), decks!inner(user_id, deleted_at)"
    );
    const eqArgs = calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqArgs).toContainEqual(["folders.user_id", USER_ID]);
    expect(eqArgs).toContainEqual(["decks.user_id", USER_ID]);
    expect(calls.filter((c) => c.method === "is").map((c) => c.args)).toContainEqual([
      "decks.deleted_at",
      null,
    ]);
  });

  it("meldet einen Datenbankfehler statt halber Zahlen", async () => {
    const { db } = makeDbMock({
      folder_decks: { data: null, error: { message: "connection lost" } },
    });
    mockedCreateDb.mockReturnValue(db);

    await expect(countDecksByFolder(USER_ID)).rejects.toThrow(
      "countDecksByFolder: connection lost"
    );
  });
});

describe("listCardsInFolder – alle Karten des Ordners in einem Rutsch", () => {
  it("liefert die Karten aller Decks des Ordners", async () => {
    const { db } = makeDbMock({
      folders: { data: folderRow, error: null },
      folder_decks: [{ deck_id: DECK_A }, { deck_id: DECK_B }],
      cards: [
        cardRow("c1", DECK_A, "2026-07-01T00:00:00.000Z"),
        cardRow("c2", DECK_B, "2026-07-02T00:00:00.000Z"),
      ],
    });
    mockedCreateDb.mockReturnValue(db);

    const cards = await listCardsInFolder(FOLDER_A, USER_ID);

    expect(cards?.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("behält die Deck-Reihenfolge des Ordners, nicht die Karten-Zeitstempel", async () => {
    // Deck B steht im Ordner vorn, seine Karte ist aber jünger: ohne die
    // Rang-Sortierung käme sie nach hinten und die Runde liefe anders herum
    // als vor der Umstellung.
    const { db } = makeDbMock({
      folders: { data: folderRow, error: null },
      folder_decks: [{ deck_id: DECK_B }, { deck_id: DECK_A }],
      cards: [
        cardRow("alt-a", DECK_A, "2026-07-01T00:00:00.000Z"),
        cardRow("neu-b", DECK_B, "2026-07-09T00:00:00.000Z"),
      ],
    });
    mockedCreateDb.mockReturnValue(db);

    const cards = await listCardsInFolder(FOLDER_A, USER_ID);

    expect(cards?.map((c) => c.id)).toEqual(["neu-b", "alt-a"]);
  });

  it("blättert über die 1000-Zeilen-Grenze hinweg", async () => {
    const rows = Array.from({ length: 1500 }, (_, i) =>
      cardRow(`c${i}`, DECK_A, "2026-07-01T00:00:00.000Z")
    );
    const { db, calls } = makeDbMock({
      folders: { data: folderRow, error: null },
      folder_decks: [{ deck_id: DECK_A }],
      cards: rows,
    });
    mockedCreateDb.mockReturnValue(db);

    const cards = await listCardsInFolder(FOLDER_A, USER_ID);

    expect(cards).toHaveLength(1500);
    expect(calls.filter((c) => c.method === "range").map((c) => c.args)).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("fragt die Karten mit einer Abfrage über alle Deck-IDs ab", async () => {
    const { db, calls } = makeDbMock({
      folders: { data: folderRow, error: null },
      folder_decks: [{ deck_id: DECK_A }, { deck_id: DECK_B }],
      cards: [],
    });
    mockedCreateDb.mockReturnValue(db);

    await listCardsInFolder(FOLDER_A, USER_ID);

    // Genau eine cards-Abfrage — das war der ganze Punkt (vorher eine je Deck).
    expect(calls.filter((c) => c.method === "from" && c.args[0] === "cards")).toHaveLength(1);
    expect(calls.find((c) => c.method === "in")?.args).toEqual(["deck_id", [DECK_A, DECK_B]]);
    const eqArgs = calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqArgs).toContainEqual(["user_id", USER_ID]);
  });

  it("leerer Ordner: leeres Array, ohne die Karten überhaupt zu fragen", async () => {
    const { db, calls } = makeDbMock({
      folders: { data: folderRow, error: null },
      folder_decks: [],
    });
    mockedCreateDb.mockReturnValue(db);

    await expect(listCardsInFolder(FOLDER_A, USER_ID)).resolves.toEqual([]);
    expect(calls.filter((c) => c.method === "from" && c.args[0] === "cards")).toHaveLength(0);
  });

  it("fremder Ordner: null und keine Karten-Abfrage", async () => {
    // getFolder ist auf den Aufrufer gefiltert und findet nichts.
    const { db, calls } = makeDbMock({ folders: { data: null, error: null } });
    mockedCreateDb.mockReturnValue(db);

    await expect(listCardsInFolder(FOLDER_A, USER_ID)).resolves.toBeNull();
    expect(calls.filter((c) => c.method === "from" && c.args[0] === "cards")).toHaveLength(0);
  });

  it("überspringt weich gelöschte und fremde Decks", async () => {
    const { db, calls } = makeDbMock({
      folders: { data: folderRow, error: null },
      folder_decks: [{ deck_id: DECK_A }],
      cards: [],
    });
    mockedCreateDb.mockReturnValue(db);

    await listCardsInFolder(FOLDER_A, USER_ID);

    const eqArgs = calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqArgs).toContainEqual(["decks.user_id", USER_ID]);
    expect(calls.filter((c) => c.method === "is").map((c) => c.args)).toContainEqual([
      "decks.deleted_at",
      null,
    ]);
  });
});

describe("GET /api/v1/stats/decks-by-folder – Vertrag", () => {
  const request = () =>
    new Request("http://localhost/api/v1/stats/decks-by-folder", { method: "GET" }) as never;

  it("liefert die gruppierten Zahlen des angemeldeten Nutzers", async () => {
    mockedGetAuthUser.mockResolvedValue({ userId: USER_ID, email: "lara@example.com" });
    const { db, calls } = makeDbMock({
      folder_decks: [{ folder_id: FOLDER_A }, { folder_id: FOLDER_B }],
    });
    mockedCreateDb.mockReturnValue(db);

    const response = await GET_COUNTS(request());
    const body = (await response.json()) as { decksByFolder: Record<string, number> };

    expect(response.status).toBe(200);
    expect(body.decksByFolder).toEqual({ [FOLDER_A]: 1, [FOLDER_B]: 1 });
    // Auf den Token-Nutzer festgenagelt, nie auf eine mitgeschickte ID.
    expect(calls.filter((c) => c.method === "eq").map((c) => c.args)).toContainEqual([
      "folders.user_id",
      USER_ID,
    ]);
  });

  it("401 ohne Token, ohne die Datenbank anzufassen", async () => {
    mockedGetAuthUser.mockResolvedValue(null);

    const response = await GET_COUNTS(request());

    expect(response.status).toBe(401);
    expect(mockedCreateDb).not.toHaveBeenCalled();
  });

  it("Datenbankfehler wird 500", async () => {
    mockedGetAuthUser.mockResolvedValue({ userId: USER_ID, email: "lara@example.com" });
    const { db } = makeDbMock({
      folder_decks: { data: null, error: { message: "connection lost" } },
    });
    mockedCreateDb.mockReturnValue(db);

    const response = await GET_COUNTS(request());
    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(500);
    expect(body.message).toContain("connection lost");
  });
});

describe("GET /api/v1/folders/[id]/cards – Vertrag", () => {
  const request = () =>
    new Request(`http://localhost/api/v1/folders/${FOLDER_A}/cards`, { method: "GET" }) as never;
  const params = { params: Promise.resolve({ id: FOLDER_A }) };

  it("liefert die Karten des Ordners", async () => {
    mockedGetAuthUser.mockResolvedValue({ userId: USER_ID, email: "lara@example.com" });
    const { db } = makeDbMock({
      folders: { data: folderRow, error: null },
      folder_decks: [{ deck_id: DECK_A }],
      cards: [cardRow("c1", DECK_A, "2026-07-01T00:00:00.000Z")],
    });
    mockedCreateDb.mockReturnValue(db);

    const response = await GET_CARDS(request(), params);
    const body = (await response.json()) as { cards: { id: string }[] };

    expect(response.status).toBe(200);
    expect(body.cards.map((c) => c.id)).toEqual(["c1"]);
  });

  it("404 für einen fremden oder nicht existierenden Ordner", async () => {
    mockedGetAuthUser.mockResolvedValue({ userId: USER_ID, email: "lara@example.com" });
    const { db } = makeDbMock({ folders: { data: null, error: null } });
    mockedCreateDb.mockReturnValue(db);

    const response = await GET_CARDS(request(), params);

    expect(response.status).toBe(404);
  });

  it("401 ohne Token, ohne die Datenbank anzufassen", async () => {
    mockedGetAuthUser.mockResolvedValue(null);

    const response = await GET_CARDS(request(), params);

    expect(response.status).toBe(401);
    expect(mockedCreateDb).not.toHaveBeenCalled();
  });
});
