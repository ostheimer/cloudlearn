/**
 * POST /api/v1/lp/milestone — Altlast aus der Zeit vor der Automatik (#637),
 * seit #696 ein reiner No-Op.
 *
 * Vorher löste diese Route `claimMilestoneReward` wirklich aus. Die RPC
 * dahinter prüfte nur Einmaligkeit (on-conflict-do-nothing) — nie, ob der
 * Meilenstein beim aufrufenden Konto tatsächlich erreicht war. Ein
 * eingeloggtes Konto konnte sich so mit fünf Aufrufen 440 LP gutschreiben,
 * ohne eine einzige Karte gelernt zu haben, und am Tagesdeckel vorbei (#696).
 * Seit der Server dieselben Meilensteine über awardMilestone /
 * awardSessionMilestones / awardFirstDeckMilestone selbst einlöst (#637),
 * lohnt sich der Aufruf ohnehin nicht mehr — diese Route beantwortet ihn jetzt
 * ohne jede echte Gutschrift.
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
  createRequestContext: () => ({ requestId: "req-lp-milestone-1" }),
}));
vi.mock("@/lib/auth", () => ({ getAuthUser: vi.fn() }));
// claimMilestoneReward bleibt gemockt vorhanden (die Route importiert sie seit
// #696 nicht mehr) — genau das prüft der erste Test unten.
vi.mock("@/services/lpService", () => ({ claimMilestoneReward: vi.fn() }));

import { POST } from "../../app/api/v1/lp/milestone/route";
import { getAuthUser } from "@/lib/auth";
import { claimMilestoneReward } from "@/services/lpService";

const USER = "33333333-3333-4333-8333-333333333333";

function post(body: unknown = { milestone: "streak_100" }) {
  return POST({
    headers: new Headers(),
    json: async () => body,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthUser).mockResolvedValue({ userId: USER } as never);
});

describe("POST /api/v1/lp/milestone — No-Op seit #696", () => {
  it("meldet granted:0 und alreadyClaimed:true, ohne claimMilestoneReward aufzurufen", async () => {
    const res = await post({ milestone: "streak_100" });

    expect(await res.json()).toEqual({ granted: 0, alreadyClaimed: true });
    expect(claimMilestoneReward).not.toHaveBeenCalled();
  });

  it("zahlt für KEINEN Meilenstein-Schlüssel mehr etwas aus — auch nicht die teuren", async () => {
    for (const milestone of ["first_deck", "first_review", "streak_7", "streak_30", "streak_100"]) {
      const res = await post({ milestone });
      expect(await res.json()).toEqual({ granted: 0, alreadyClaimed: true });
    }
    // Fünf Aufrufe, null Gutschriften — genau die Lücke aus #696 ist zu.
    expect(claimMilestoneReward).not.toHaveBeenCalled();
  });

  it("bleibt hinter Auth — ohne Token 401, keine Gutschrift", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never);

    const res = await post();

    expect(res.status).toBe(401);
    expect(claimMilestoneReward).not.toHaveBeenCalled();
  });

  it("lehnt einen unbekannten Meilenstein-Schlüssel weiterhin ab (400)", async () => {
    const res = await post({ milestone: "not_a_real_milestone" });

    expect(res.status).toBe(400);
    expect(claimMilestoneReward).not.toHaveBeenCalled();
  });
});
