import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: vi.fn() }));

import { countUserCards } from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase";

const mockedCreateDb = vi.mocked(createSupabaseAdminClient);
const USER_ID = "11111111-1111-4111-8111-111111111111";

interface RecordedCall {
  method: string;
  args: unknown[];
}

function makeDbMock() {
  const calls: RecordedCall[] = [];
  const response = { count: 4, error: null };
  const builder: Record<string, unknown> = {};

  for (const method of ["select", "eq", "is"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.then = (
    onFulfilled: (value: typeof response) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(response).then(onFulfilled, onRejected);

  const from = vi.fn((table: string) => {
    calls.push({ method: "from", args: [table] });
    return builder;
  });

  return { db: { from } as never, calls };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("countUserCards — cards in deleted decks do not consume plan capacity", () => {
  it("counts only live cards whose deck is still live", async () => {
    const { db, calls } = makeDbMock();
    mockedCreateDb.mockReturnValue(db);

    expect(await countUserCards(USER_ID)).toBe(4);
    expect(calls.find((call) => call.method === "select")?.args).toEqual([
      "*, decks!inner(deleted_at)",
      { count: "exact", head: true },
    ]);
    expect(calls.filter((call) => call.method === "is").map((call) => call.args)).toEqual([
      ["deleted_at", null],
      ["decks.deleted_at", null],
    ]);
  });
});
