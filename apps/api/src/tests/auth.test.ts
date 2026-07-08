import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

function makeMockDb({
  deletedAccount = null,
}: {
  deletedAccount?: Record<string, unknown> | null;
}) {
  const profileUpsert = vi.fn().mockResolvedValue({ error: null });
  const deletedAccountsSelect = vi.fn().mockReturnValue({
    eq: () => ({
      maybeSingle: async () => ({ data: deletedAccount, error: null }),
    }),
  });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "11111111-1111-4111-8111-111111111111",
            email: "office@ostheimer.at",
          },
        },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "deleted_accounts") {
        return {
          select: deletedAccountsSelect,
        };
      }
      if (table === "profiles") {
        return {
          upsert: profileUpsert,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
    __profileUpsert: profileUpsert,
  };
}

describe("auth helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks deleted accounts from being rehydrated", async () => {
    const db = makeMockDb({
      deletedAccount: { user_id: "11111111-1111-4111-8111-111111111111" },
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(db as never);

    const user = await getAuthUser(
      new Request("http://localhost", {
        headers: { Authorization: "Bearer token" },
      }) as never
    );

    expect(user).toBeNull();
    expect(db.__profileUpsert).not.toHaveBeenCalled();
  });

  it("still bootstraps a profile for active accounts", async () => {
    const db = makeMockDb({ deletedAccount: null });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(db as never);

    const user = await getAuthUser(
      new Request("http://localhost", {
        headers: { Authorization: "Bearer token" },
      }) as never
    );

    expect(user).toEqual({
      userId: "11111111-1111-4111-8111-111111111111",
      email: "office@ostheimer.at",
    });
    expect(db.__profileUpsert).toHaveBeenCalledWith(
      { id: "11111111-1111-4111-8111-111111111111" },
      { onConflict: "id", ignoreDuplicates: true }
    );
  });
});
