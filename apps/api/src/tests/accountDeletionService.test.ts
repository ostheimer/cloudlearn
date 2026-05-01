import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteAccount } from "@/services/accountDeletionService";
import { createSupabaseAdminClient } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

function makeMockDb(authDeleteError: unknown = null) {
  const deleteUser = vi.fn().mockResolvedValue({ error: authDeleteError });
  const rpc = vi.fn().mockResolvedValue({ error: null });
  return {
    rpc,
    auth: {
      admin: {
        deleteUser,
      },
    },
    __deleteUser: deleteUser,
  };
}

describe("accountDeletionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes public app data and the auth user", async () => {
    const db = makeMockDb();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(db as never);

    const result = await deleteAccount("11111111-1111-4111-8111-111111111111", "office@ostheimer.at");

    expect(db.rpc).toHaveBeenCalledWith("delete_account_data", {
      target_user_id: "11111111-1111-4111-8111-111111111111",
      target_email: "office@ostheimer.at",
    });
    expect(db.__deleteUser).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
    expect(result).toEqual({
      deleted: true,
      message: "Account und Lerninhalte wurden endgültig gelöscht.",
    });
  });

  it("returns a warning when auth cleanup is pending", async () => {
    const db = makeMockDb({ message: "network error", status: 500 });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(db as never);

    const result = await deleteAccount("11111111-1111-4111-8111-111111111111", "office@ostheimer.at");

    expect(result.deleted).toBe(true);
    expect(result.warning).toContain("technische Auth-Löschung ist noch offen");
    expect(result.message).toBe("Account und Lerninhalte wurden endgültig gelöscht.");
  });

  it("treats a missing auth user as a clean success", async () => {
    const db = makeMockDb({ message: "User not found", status: 404 });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(db as never);

    const result = await deleteAccount("11111111-1111-4111-8111-111111111111", "office@ostheimer.at");

    expect(result).toEqual({
      deleted: true,
      message: "Account und Lerninhalte wurden endgültig gelöscht.",
    });
  });
});
