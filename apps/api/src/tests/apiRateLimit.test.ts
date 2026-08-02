import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: vi.fn() }));

import { enforceUserRateLimit } from "@/lib/apiRateLimit";
import { checkRateLimit } from "@/lib/rateLimit";

const mockedCheck = vi.mocked(checkRateLimit);

beforeEach(() => vi.clearAllMocks());

describe("enforceUserRateLimit", () => {
  it("isoliert den Topf nach Route und Nutzer und reicht das Gewicht durch", async () => {
    mockedCheck.mockResolvedValue(true);

    await enforceUserRateLimit("user-1", "cards-delete-many", 4000, 2000);

    expect(mockedCheck).toHaveBeenCalledWith("cards-delete-many:user-1", 4000, 60, 2000);
  });

  it("liefert bei erschöpftem Topf einen standardisierten 429-Fehler", async () => {
    mockedCheck.mockResolvedValue(false);

    await expect(enforceUserRateLimit("user-1", "trash", 60)).rejects.toMatchObject({
      code: "RATE_LIMITED",
      status: 429,
    });
  });
});
