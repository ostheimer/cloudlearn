import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSubscriptionStatus,
  transferSubscriptionBetweenUsers,
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
      billingIssueAt: null,
    });

    const status = await getSubscriptionStatus(
      "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a"
    );

    expect(status).toEqual({
      userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      tier: "free",
      isActive: false,
      expiresAt: null,
      billingIssueAt: null,
    });
  });

  it("keeps active pro subscriptions intact on read", async () => {
    mockedGetSubscriptionTier.mockResolvedValueOnce({
      tier: "pro",
      expiresAt: "2027-01-01T00:00:00.000Z",
      isActive: true,
      billingIssueAt: null,
    });

    const status = await getSubscriptionStatus(
      "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a"
    );

    expect(status).toEqual({
      userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      tier: "pro",
      isActive: true,
      expiresAt: "2027-01-01T00:00:00.000Z",
      billingIssueAt: null,
    });
  });

  it("keeps active lifetime subscriptions intact on read", async () => {
    mockedGetSubscriptionTier.mockResolvedValueOnce({
      tier: "lifetime",
      expiresAt: null,
      isActive: true,
      billingIssueAt: null,
    });

    const status = await getSubscriptionStatus(
      "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a"
    );

    expect(status).toEqual({
      userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      tier: "lifetime",
      isActive: true,
      expiresAt: null,
      billingIssueAt: null,
    });
  });

  it("exposes a billing issue for an active paid subscription (#607)", async () => {
    mockedGetSubscriptionTier.mockResolvedValueOnce({
      tier: "pro",
      expiresAt: "2027-01-01T00:00:00.000Z",
      isActive: true,
      billingIssueAt: "2026-07-29T10:00:00.000Z",
    });

    const status = await getSubscriptionStatus(
      "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a"
    );

    expect(status.billingIssueAt).toBe("2026-07-29T10:00:00.000Z");
  });

  it("hides a stale billing issue once the subscription is inactive (#607)", async () => {
    // Ablauf ohne EXPIRATION-Webhook: Konto ist effektiv free, ein
    // „Zahlungsproblem"-Banner wäre irreführend.
    mockedGetSubscriptionTier.mockResolvedValueOnce({
      tier: "pro",
      expiresAt: "2026-01-01T00:00:00.000Z",
      isActive: false,
      billingIssueAt: "2026-07-29T10:00:00.000Z",
    });

    const status = await getSubscriptionStatus(
      "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a"
    );

    expect(status.billingIssueAt).toBeNull();
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
      null,
      null
    );
    expect(updated).toEqual({
      userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      tier: "free",
      isActive: false,
      expiresAt: null,
      billingIssueAt: null,
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
      "2026-03-01T00:00:00.000Z",
      null
    );
    expect(updated.tier).toBe("pro");
    expect(updated.isActive).toBe(true);
  });
});

describe("transferSubscriptionBetweenUsers – RevenueCat TRANSFER (#607)", () => {
  const mockedGetSubscriptionTier = vi.mocked(getSubscriptionTier);
  const mockedUpdateSubscriptionTier = vi.mocked(updateSubscriptionTier);

  const FROM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const FROM_ID_2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const TO_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("moves an active pro subscription from the old to the new account", async () => {
    mockedGetSubscriptionTier.mockResolvedValueOnce({
      tier: "pro",
      expiresAt: "2099-01-01T00:00:00.000Z",
      isActive: true,
      billingIssueAt: null,
    });

    const result = await transferSubscriptionBetweenUsers([FROM_ID], [TO_ID]);

    expect(result.movedTier).toBe("pro");
    expect(mockedUpdateSubscriptionTier).toHaveBeenCalledWith(FROM_ID, "free", false, null, null);
    expect(mockedUpdateSubscriptionTier).toHaveBeenCalledWith(
      TO_ID,
      "pro",
      true,
      "2099-01-01T00:00:00.000Z",
      null
    );
  });

  it("prefers lifetime over pro when several source accounts are paid", async () => {
    mockedGetSubscriptionTier
      .mockResolvedValueOnce({
        tier: "pro",
        expiresAt: "2099-01-01T00:00:00.000Z",
        isActive: true,
        billingIssueAt: null,
      })
      .mockResolvedValueOnce({
        tier: "lifetime",
        expiresAt: null,
        isActive: true,
        billingIssueAt: null,
      });

    const result = await transferSubscriptionBetweenUsers([FROM_ID, FROM_ID_2], [TO_ID]);

    expect(result.movedTier).toBe("lifetime");
    expect(mockedUpdateSubscriptionTier).toHaveBeenCalledWith(TO_ID, "lifetime", true, null, null);
  });

  it("leaves the target untouched when no source account is paid (replay safety)", async () => {
    // Zweite Zustellung desselben Webhooks: Quellkonto ist schon free.
    mockedGetSubscriptionTier.mockResolvedValueOnce({
      tier: "free",
      expiresAt: null,
      isActive: true,
      billingIssueAt: null,
    });

    const result = await transferSubscriptionBetweenUsers([FROM_ID], [TO_ID]);

    expect(result.movedTier).toBeNull();
    // Quellkonto wird (wirkungslos) erneut auf free gesetzt, Zielkonto NIE angefasst.
    expect(mockedUpdateSubscriptionTier).toHaveBeenCalledTimes(1);
    expect(mockedUpdateSubscriptionTier).toHaveBeenCalledWith(FROM_ID, "free", false, null, null);
  });

  it("does not move an expired subscription", async () => {
    mockedGetSubscriptionTier.mockResolvedValueOnce({
      tier: "pro",
      expiresAt: "2020-01-01T00:00:00.000Z",
      isActive: false,
      billingIssueAt: null,
    });

    const result = await transferSubscriptionBetweenUsers([FROM_ID], [TO_ID]);

    expect(result.movedTier).toBeNull();
    expect(mockedUpdateSubscriptionTier).not.toHaveBeenCalledWith(
      TO_ID,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  it("skips RevenueCat anonymous ids — only Supabase UUIDs are our accounts", async () => {
    const result = await transferSubscriptionBetweenUsers(
      ["$RCAnonymousID:1234567890abcdef"],
      ["$RCAnonymousID:fedcba0987654321"]
    );

    expect(result.movedTier).toBeNull();
    expect(mockedGetSubscriptionTier).not.toHaveBeenCalled();
    expect(mockedUpdateSubscriptionTier).not.toHaveBeenCalled();
  });
});
