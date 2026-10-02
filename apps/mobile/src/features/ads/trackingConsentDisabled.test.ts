import { beforeEach, describe, expect, it, vi } from "vitest";

const nativeTracking = vi.hoisted(() => ({
  get: vi.fn(async () => ({
    granted: false,
    canAskAgain: true,
    status: "undetermined",
  })),
  request: vi.fn(async () => ({
    granted: true,
    canAskAgain: true,
    status: "granted",
  })),
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
  },
}));
vi.mock("expo-tracking-transparency", () => ({
  isAvailable: () => true,
  getTrackingPermissionsAsync: nativeTracking.get,
  requestTrackingPermissionsAsync: nativeTracking.request,
}));

import { useTrackingConsentStore } from "./trackingConsent";

describe("tracking consent while real ads are disabled", () => {
  beforeEach(() => {
    nativeTracking.get.mockClear();
    nativeTracking.request.mockClear();
    useTrackingConsentStore.setState({
      hydrated: false,
      autoPromptCompleted: false,
      preference: "unknown",
      permissionStatus: "undetermined",
    });
  });

  it("never reads or requests Apple's native tracking permission", async () => {
    await useTrackingConsentStore.getState().initialize();
    const result = await useTrackingConsentStore
      .getState()
      .allowPersonalizedAds();

    expect(nativeTracking.get).not.toHaveBeenCalled();
    expect(nativeTracking.request).not.toHaveBeenCalled();
    expect(result).toEqual({
      granted: false,
      canAskAgain: false,
      permissionStatus: "unavailable",
    });
    expect(useTrackingConsentStore.getState().preference).toBe(
      "non_personalized"
    );
  });
});
