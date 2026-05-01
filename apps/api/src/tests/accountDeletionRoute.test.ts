import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "../../app/api/v1/account/route";
import { getAuthUser } from "@/lib/auth";
import { deleteAccount } from "@/services/accountDeletionService";

vi.mock("@/lib/auth", () => ({
  getAuthUser: vi.fn(),
}));

vi.mock("@/services/accountDeletionService", () => ({
  deleteAccount: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  createRequestContext: () => ({ requestId: "req-account-1" }),
  withRequestIdHeaders: (requestId: string) => {
    const headers = new Headers();
    headers.set("x-request-id", requestId);
    return headers;
  },
}));

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedDeleteAccount = vi.mocked(deleteAccount);

describe("account route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a compact success payload", async () => {
    mockedGetAuthUser.mockResolvedValue({
      userId: "11111111-1111-4111-8111-111111111111",
      email: "office@ostheimer.at",
    });
    mockedDeleteAccount.mockResolvedValue({
      deleted: true,
      message: "Account und Lerninhalte wurden endgültig gelöscht.",
    });

    const response = await DELETE(
      new Request("http://localhost/api/v1/account", { method: "DELETE" }) as never
    );
    const body = (await response.json()) as {
      requestId: string;
      deleted: boolean;
      message: string;
      warning?: string;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      requestId: "req-account-1",
      deleted: true,
      message: "Account und Lerninhalte wurden endgültig gelöscht.",
    });
  });

  it("returns a warning payload when auth cleanup is pending", async () => {
    mockedGetAuthUser.mockResolvedValue({
      userId: "11111111-1111-4111-8111-111111111111",
      email: "office@ostheimer.at",
    });
    mockedDeleteAccount.mockResolvedValue({
      deleted: true,
      message: "Account und Lerninhalte wurden endgültig gelöscht.",
      warning: "Die Lerninhalte wurden gelöscht, aber die technische Auth-Löschung ist noch offen.",
    });

    const response = await DELETE(
      new Request("http://localhost/api/v1/account", { method: "DELETE" }) as never
    );
    const body = (await response.json()) as {
      requestId: string;
      deleted: boolean;
      message: string;
      warning?: string;
    };

    expect(response.status).toBe(202);
    expect(body.warning).toContain("Auth-Löschung");
  });

  it("rejects unauthenticated requests", async () => {
    mockedGetAuthUser.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost/api/v1/account", { method: "DELETE" }) as never
    );
    const body = (await response.json()) as { code: string; message: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(mockedDeleteAccount).not.toHaveBeenCalled();
  });
});
