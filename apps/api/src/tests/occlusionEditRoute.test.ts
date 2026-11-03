import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ getAuthUser: vi.fn(), editOcclusionImageForUser: vi.fn(), enforceUserRateLimit: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/services/occlusionService", () => ({ editOcclusionImageForUser: mocks.editOcclusionImageForUser }));
vi.mock("@/lib/apiRateLimit", () => ({ enforceUserRateLimit: mocks.enforceUserRateLimit, API_RATE_LIMITS: { bulkCardOperations: 4000 } }));
import { PUT } from "../../app/api/v1/decks/[id]/occlusion/route";
import { HttpError } from "@/lib/http";
const authenticated = "20000000-0000-4000-8000-000000000731";
const deck = "10000000-0000-4000-8000-000000000731";
const request = () => new NextRequest(`http://localhost/api/v1/decks/${deck}/occlusion`, { method: "PUT", body: JSON.stringify({ userId: "spoofed", deckId: "spoofed", sourceImageUrl: "image.png", regions: [] }) });
describe("occlusion edit route", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.enforceUserRateLimit.mockResolvedValue(undefined); mocks.getAuthUser.mockResolvedValue({ userId: authenticated }); mocks.editOcclusionImageForUser.mockResolvedValue({ updated: 2, created: 0, deleted: 1 }); });
  it("uses the authenticated owner and URL deck, ignoring spoofed body ownership", async () => {
    const response = await PUT(request(), { params: Promise.resolve({ id: deck }) });
    expect(response.status).toBe(200);
    expect(mocks.editOcclusionImageForUser).toHaveBeenCalledWith(expect.objectContaining({ userId: authenticated, deckId: deck }));
    expect(await response.json()).toMatchObject({ updated: 2, deleted: 1 });
  });
  it("rejects anonymous requests without mutation", async () => {
    mocks.getAuthUser.mockResolvedValue(null);
    expect((await PUT(request(), { params: Promise.resolve({ id: deck }) })).status).toBe(401);
    expect(mocks.editOcclusionImageForUser).not.toHaveBeenCalled();
  });
  it("applies the existing bulk-operation budget before mutation", async () => {
    mocks.enforceUserRateLimit.mockRejectedValue(new HttpError("Too many requests", 429, "RATE_LIMITED"));
    expect((await PUT(request(), { params: Promise.resolve({ id: deck }) })).status).toBe(429);
    expect(mocks.editOcclusionImageForUser).not.toHaveBeenCalled();
  });
  it("surfaces stale-edit conflicts without reporting success", async () => {
    mocks.editOcclusionImageForUser.mockRejectedValue(new HttpError("Changed elsewhere", 409, "OCCLUSION_CONFLICT"));
    const response = await PUT(request(), { params: Promise.resolve({ id: deck }) });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "OCCLUSION_CONFLICT" });
  });
});
