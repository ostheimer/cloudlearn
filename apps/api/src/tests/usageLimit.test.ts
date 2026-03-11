import { beforeEach, describe, expect, it, vi } from "vitest";
import { consumeAiScanQuota, consumeUrlImportQuota } from "@/lib/usageLimit";
import { createSupabaseAdminClient } from "@/lib/supabase";

// Mock Supabase DB calls
vi.mock("@/lib/supabase", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

function makeMockDb(selectData: Record<string, unknown> | null, updateError: string | null = null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: selectData, error: null }),
        }),
      }),
      update: () => ({
        eq: async () => ({ error: updateError ? { message: updateError } : null }),
      }),
    }),
  };
}

const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

describe("consumeAiScanQuota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("always allows pro users without touching DB counter", async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(null as never);
    const result = await consumeAiScanQuota(TEST_USER_ID, "pro", 5);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(Infinity);
  });

  it("allows first scan in new month and sets count to 1", async () => {
    const now = new Date("2026-03-15T12:00:00Z");
    const mockDb = makeMockDb({ ai_scans_used: 0, usage_period_start: "2026-02-01" });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(mockDb as never);

    const result = await consumeAiScanQuota(TEST_USER_ID, "free", 5, now);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("blocks scan when limit is reached", async () => {
    const now = new Date("2026-03-15T12:00:00Z");
    const mockDb = makeMockDb({ ai_scans_used: 5, usage_period_start: "2026-03-01" });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(mockDb as never);

    const result = await consumeAiScanQuota(TEST_USER_ID, "free", 5, now);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets counter for new month and allows scan", async () => {
    const now = new Date("2026-03-01T00:00:00Z");
    // Row still has February's data
    const mockDb = makeMockDb({ ai_scans_used: 5, usage_period_start: "2026-02-01" });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(mockDb as never);

    const result = await consumeAiScanQuota(TEST_USER_ID, "free", 5, now);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("allows last scan (limit - 1 used → 0 remaining after)", async () => {
    const now = new Date("2026-03-10T00:00:00Z");
    const mockDb = makeMockDb({ ai_scans_used: 4, usage_period_start: "2026-03-01" });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(mockDb as never);

    const result = await consumeAiScanQuota(TEST_USER_ID, "free", 5, now);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });
});

describe("consumeUrlImportQuota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("always allows lifetime users", async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(null as never);
    const result = await consumeUrlImportQuota(TEST_USER_ID, "lifetime", 2);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(Infinity);
  });

  it("blocks URL import when limit is reached", async () => {
    const now = new Date("2026-03-15T12:00:00Z");
    const mockDb = makeMockDb({ ai_url_imports_used: 2, usage_period_start: "2026-03-01" });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(mockDb as never);

    const result = await consumeUrlImportQuota(TEST_USER_ID, "free", 2, now);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("allows URL import when under limit", async () => {
    const now = new Date("2026-03-15T12:00:00Z");
    const mockDb = makeMockDb({ ai_url_imports_used: 1, usage_period_start: "2026-03-01" });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(mockDb as never);

    const result = await consumeUrlImportQuota(TEST_USER_ID, "free", 2, now);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });
});
