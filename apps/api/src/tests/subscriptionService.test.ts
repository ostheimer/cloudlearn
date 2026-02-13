import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSubscriptionStatus,
  updateSubscriptionStatus,
} from "@/services/subscriptionService";
import { getSubscriptionTier, updateSubscriptionTier } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  getSubscriptionTier: vi.fn(),
  updateSubscriptionTier: vi.fn(),
}));

describe("subscriptionService", () => {
  const mockedGetSubscriptionTier = vi.mocked(getSubscriptionTier);
  const mockedUpdateSubscriptionTier = vi.mocked(updateSubscriptionTier);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("downgrades inactive paid tiers to free on read", async () => {
    mockedGetSubscriptionTier.mockResolvedValueOnce({
      tier: "pro",
      expiresAt: "2026-01-01T00:00:00.000Z",
      isActive: false,
    });

    const status = await getSubscriptionStatus(
      "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a"
    );

    expect(status).toEqual({
      userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      tier: "free",
      isActive: false,
      expiresAt: null,
    });
  });

  it("keeps active lifetime subscriptions intact on read", async () => {
    mockedGetSubscriptionTier.mockResolvedValueOnce({
      tier: "lifetime",
      expiresAt: null,
      isActive: true,
    });

    const status = await getSubscriptionStatus(
      "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a"
    );

    expect(status).toEqual({
      userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      tier: "lifetime",
      isActive: true,
      expiresAt: null,
    });
  });

  it("normalizes inactive updates to free before persisting", async () => {
    const updated = await updateSubscriptionStatus({
      userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      tier: "pro",
      isActive: false,
      expiresAt: "2026-03-01T00:00:00.000Z",
    });

    expect(mockedUpdateSubscriptionTier).toHaveBeenCalledWith(
      "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      "free",
      false,
      null
    );
    expect(updated).toEqual({
      userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      tier: "free",
      isActive: false,
      expiresAt: null,
    });
  });

  it("persists active paid updates unchanged", async () => {
    const updated = await updateSubscriptionStatus({
      userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      tier: "pro",
      isActive: true,
      expiresAt: "2026-03-01T00:00:00.000Z",
    });

    expect(mockedUpdateSubscriptionTier).toHaveBeenCalledWith(
      "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      "pro",
      true,
      "2026-03-01T00:00:00.000Z"
    );
    expect(updated.tier).toBe("pro");
    expect(updated.isActive).toBe(true);
  });
});
