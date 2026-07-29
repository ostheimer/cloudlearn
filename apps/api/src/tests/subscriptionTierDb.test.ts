/**
 * getSubscriptionTier (#607): Ein DB-LESEFEHLER muss den Fehler durchreichen,
 * statt still "free" zu behaupten — an diesem Tier hängen LP-Preise,
 * Tarifgrenzen, Rate-Limits und 402-Paywalls, ein Pro-Konto zahlte sonst bei
 * jedem DB-Schluckauf Free-Preise. Ein FEHLENDES Profil (ohne Fehler) bleibt
 * dagegen wirklich "free".
 *
 * Supabase-Client als Query-Builder-Fake (Muster wie deckStatsDb.test.ts).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: vi.fn() }));

import { getSubscriptionTier } from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase";

const mockedCreateDb = vi.mocked(createSupabaseAdminClient);

const USER_ID = "11111111-1111-4111-8111-111111111111";

function makeDbMock(response: { data: unknown; error: { message: string } | null }) {
  const from = vi.fn().mockImplementation(() => {
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq"]) {
      builder[method] = () => builder;
    }
    builder.maybeSingle = () => Promise.resolve(response);
    return builder;
  });
  return { from } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSubscriptionTier – Fehler durchreichen statt still free (#607)", () => {
  it("throws when the profiles read errors instead of pretending free", async () => {
    mockedCreateDb.mockReturnValue(
      makeDbMock({ data: null, error: { message: "connection reset" } })
    );

    await expect(getSubscriptionTier(USER_ID)).rejects.toThrow(
      "getSubscriptionTier: connection reset"
    );
  });

  it("returns free when the profile row is genuinely missing (no error)", async () => {
    mockedCreateDb.mockReturnValue(makeDbMock({ data: null, error: null }));

    await expect(getSubscriptionTier(USER_ID)).resolves.toEqual({
      tier: "free",
      expiresAt: null,
      isActive: true,
    });
  });

  it("maps an active pro row with future expiry", async () => {
    mockedCreateDb.mockReturnValue(
      makeDbMock({
        data: {
          subscription_tier: "pro",
          subscription_expires_at: "2099-01-01T00:00:00.000Z",
        },
        error: null,
      })
    );

    await expect(getSubscriptionTier(USER_ID)).resolves.toEqual({
      tier: "pro",
      expiresAt: "2099-01-01T00:00:00.000Z",
      isActive: true,
    });
  });

  it("maps an unknown tier string to free", async () => {
    mockedCreateDb.mockReturnValue(
      makeDbMock({
        data: { subscription_tier: "premium_legacy", subscription_expires_at: null },
        error: null,
      })
    );

    const result = await getSubscriptionTier(USER_ID);
    expect(result.tier).toBe("free");
  });
});
