import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: vi.fn() }));

import { getSessionProgress } from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase";

const mockedCreateDb = vi.mocked(createSupabaseAdminClient);

function progressDb(response: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq"]) {
    builder[method] = () => builder;
  }
  builder.maybeSingle = () => Promise.resolve(response);
  return { from: () => builder } as never;
}

beforeEach(() => vi.clearAllMocks());

describe("getSessionProgress", () => {
  it("unterscheidet einen Datenbankfehler von einem fehlenden Lernstand (#702)", async () => {
    mockedCreateDb.mockReturnValue(
      progressDb({ data: null, error: { message: "connection terminated" } })
    );

    await expect(
      getSessionProgress(
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        "flashcards"
      )
    ).rejects.toThrow("getSessionProgress: connection terminated");
  });

  it("liefert nur bei einer erfolgreichen leeren Abfrage null", async () => {
    mockedCreateDb.mockReturnValue(progressDb({ data: null, error: null }));

    await expect(
      getSessionProgress(
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        "cloze"
      )
    ).resolves.toBeNull();
  });
});
