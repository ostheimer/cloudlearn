/**
 * POST /api/v1/lp/earn — das gemeinsame Sitzungs-Ende aller punktenden
 * Lernarten und damit seit #637 der Auslöser für „erste Lernsitzung" und die
 * Streak-Boni.
 *
 * Festgehalten wird hier der Teil, den der Dienst-Test nicht sieht: Was in der
 * Antwort ankommt. Vor allem der Kontostand — die Meilenstein-Punkte fließen
 * NACH der Sitzungs-Gutschrift, stünden in deren `newBalance` also nicht drin.
 * Ohne die Korrektur verkündete der Bildschirm einen Bonus und zeigte darunter
 * einen Kontostand ohne ihn.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

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
  createRequestContext: () => ({ requestId: "req-lp-earn-1" }),
  logInfo: vi.fn(),
  logError: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getAuthUser: vi.fn() }));
vi.mock("@/services/subscriptionService", () => ({ getSubscriptionStatus: vi.fn() }));
vi.mock("@/services/lpService", () => ({
  earnLp: vi.fn(),
  awardSessionMilestones: vi.fn(),
}));

import { POST } from "../../app/api/v1/lp/earn/route";
import { getAuthUser } from "@/lib/auth";
import { getSubscriptionStatus } from "@/services/subscriptionService";
import { awardSessionMilestones, earnLp } from "@/services/lpService";

const USER = "22222222-2222-4222-8222-222222222222";

function post() {
  return POST({
    headers: new Headers(),
    json: async () => ({ type: "session", sessionCardCount: 8 }),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthUser).mockResolvedValue({ userId: USER } as never);
  vi.mocked(getSubscriptionStatus).mockResolvedValue({ tier: "free" } as never);
  vi.mocked(earnLp).mockResolvedValue({ granted: 8, newBalance: 18, capReached: false });
  vi.mocked(awardSessionMilestones).mockResolvedValue([]);
});

describe("POST /api/v1/lp/earn — Meilensteine (#637)", () => {
  it("reicht ohne Bonus die Sitzungs-Gutschrift unverändert durch", async () => {
    const res = await post();

    expect(await res.json()).toMatchObject({
      granted: 8,
      newBalance: 18,
      capReached: false,
      milestones: [],
    });
  });

  it("nennt den Bonus und rechnet ihn in den Kontostand ein", async () => {
    vi.mocked(awardSessionMilestones).mockResolvedValue([
      { key: "first_review", lpGranted: 5 },
    ]);

    const body = (await (await post()).json()) as {
      newBalance: number;
      milestones: Array<{ key: string }>;
    };

    expect(body.milestones).toEqual([{ key: "first_review", lpGranted: 5 }]);
    expect(body.newBalance).toBe(23);
  });

  it("addiert mehrere Boni derselben Sitzung (erste Sitzung trifft 7-Tage-Streak)", async () => {
    vi.mocked(awardSessionMilestones).mockResolvedValue([
      { key: "first_review", lpGranted: 5 },
      { key: "streak_7", lpGranted: 25 },
    ]);

    const body = (await (await post()).json()) as { newBalance: number };

    expect(body.newBalance).toBe(48);
  });

  it("löst die Meilensteine auch aus, wenn das Tageslimit schon erreicht ist", async () => {
    // Gelernt wurde trotzdem — der Meilenstein hängt an der Sitzung, nicht an
    // der Gutschrift.
    vi.mocked(earnLp).mockResolvedValue({ granted: 0, newBalance: 100, capReached: true });
    vi.mocked(awardSessionMilestones).mockResolvedValue([
      { key: "first_review", lpGranted: 5 },
    ]);

    const body = (await (await post()).json()) as {
      granted: number;
      capReached: boolean;
      newBalance: number;
    };

    expect(awardSessionMilestones).toHaveBeenCalledWith(USER);
    expect(body).toMatchObject({ granted: 0, capReached: true, newBalance: 105 });
  });

  it("fragt die Meilensteine für das Konto aus dem Token ab, nicht aus dem Body", async () => {
    await post();

    expect(awardSessionMilestones).toHaveBeenCalledWith(USER);
  });
});
