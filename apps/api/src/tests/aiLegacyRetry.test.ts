import { beforeEach, describe, expect, it, vi } from "vitest";
import { aiRequestIdentity } from "@/lib/aiRequestIdentity";
import { POST as scan } from "../../app/api/v1/scan/process/route";
import { POST as url } from "../../app/api/v1/import/url/route";
import { POST as pdf } from "../../app/api/v1/import/pdf/route";

const fixture = vi.hoisted(() => ({
  userId: "22222222-2222-4222-8222-222222222222",
  oldKey: "legacy-job-client-key",
  oldResponse: { requestId: "old-request-id", cards: [{ front: "private fixture", back: "private answer" }] },
  process: vi.fn(async () => ({ requestId: "new-request-id", cards: [] })),
  spend: vi.fn(async () => ({ allowed: true, cost: 10, newBalance: 90 })),
  selectedLegacyColumns: [] as string[],
  sharedCacheKey: null as string | null,
  claimedResponse: null as unknown,
  legacyStoreDown: false,
}));

vi.mock("@/lib/auth", () => ({
  getAuthUser: async () => ({ userId: fixture.userId }),
}));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: async () => true, rateLimitPerMinuteForTier: () => 60 }));
vi.mock("@/services/subscriptionService", () => ({ getSubscriptionStatus: async () => ({ tier: "free" }) }));
vi.mock("@/services/scanService", () => ({ processScan: fixture.process }));
vi.mock("@/services/urlImportService", () => ({ processUrlImport: fixture.process }));
vi.mock("@/services/pdfImportService", () => ({ processPdfImport: fixture.process }));
vi.mock("@/services/lpService", () => ({ spendLp: fixture.spend, getLpProfile: async () => ({ balance: 90 }) }));
vi.mock("@/lib/supabase", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({
      select: (columns: string) => ({
        eq: (_column: string, key: string) => ({
          maybeSingle: async () => {
            if (key === fixture.sharedCacheKey) {
              return { data: { response: fixture.oldResponse }, error: null };
            }
            if (key !== fixture.oldKey) return { data: null, error: null };
            fixture.selectedLegacyColumns.push(columns);
            if (fixture.legacyStoreDown) return { data: null, error: { message: "storage fixture unavailable" } };
            return {
              data: columns === "key" ? { key } : { key, response: fixture.oldResponse },
              error: null,
            };
          },
        }),
      }),
    }),
    rpc: async (name: string) => ({
      data: name === "claim_ai_request"
        ? fixture.claimedResponse
          ? { status: "complete", response: fixture.claimedResponse }
          : { status: "claimed" }
        : true,
      error: null,
    }),
  }),
}));

const routes = [
  ["scan/process", scan, { extractedText: "Ein synthetischer Lerntext." }],
  ["import/url", url, { sourceUrl: "https://example.test/article" }],
  ["import/pdf", pdf, { fileName: "fixture.pdf", fileBase64: "A".repeat(100) }],
] as const;

const request = (path: string, body: object) => new Request(`http://localhost/api/v1/${path}`, {
  method: "POST",
  body: JSON.stringify({ idempotencyKey: fixture.oldKey, ...body }),
}) as Parameters<typeof scan>[0];

describe("AI job retries across the release boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixture.legacyStoreDown = false;
    fixture.selectedLegacyColumns = [];
    fixture.sharedCacheKey = null;
    fixture.claimedResponse = null;
  });

  it.each(routes)("rejects a legacy-key retry through %s without charging or using the old response", async (path, post, body) => {
    const result = await post(request(path, body));
    expect(result.status).toBe(409);
    expect(await result.json()).toMatchObject({ code: "AI_REQUEST_LEGACY_CONFLICT" });
    expect(fixture.selectedLegacyColumns).toEqual(["key"]);
    expect(fixture.spend).not.toHaveBeenCalled();
    expect(fixture.process).not.toHaveBeenCalled();
  });

  it("replays the matching claim even when the shared save cache contains a different payload under that key", async () => {
    const body = {
      idempotencyKey: "claim-client-key",
      extractedText: "Ein synthetischer Lerntext.",
      sourceLanguage: "de",
      preview: false,
    };
    fixture.sharedCacheKey = aiRequestIdentity(fixture.userId, "aiScan", body).key;
    fixture.claimedResponse = { requestId: "owned-claim", cards: [{ front: "own fixture", back: "own answer" }] };

    const result = await scan(request("scan/process", body));
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ ...fixture.claimedResponse as object, usage: { lpSpent: 0 } });
    expect(fixture.spend).not.toHaveBeenCalled();
    expect(fixture.process).not.toHaveBeenCalled();
  });

  it("fails closed when the legacy presence check cannot be completed", async () => {
    fixture.legacyStoreDown = true;
    const result = await scan(request("scan/process", routes[0][2]));
    expect(result.status).toBe(503);
    expect(await result.json()).toMatchObject({ code: "AI_REQUEST_UNAVAILABLE" });
    expect(fixture.spend).not.toHaveBeenCalled();
    expect(fixture.process).not.toHaveBeenCalled();
  });
});
