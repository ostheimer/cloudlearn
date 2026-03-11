import { describe, expect, it } from "vitest";
import { resolveRootRedirect } from "./rootRedirect";

describe("resolveRootRedirect", () => {
  it("sends unauthenticated users to auth", () => {
    expect(
      resolveRootRedirect({
        isAuthenticated: false,
        isLoading: false,
        onboardingLoaded: false,
        onboardingCompleted: false,
        firstSegment: "(tabs)",
      })
    ).toBe("/auth");
  });

  it("waits while auth or onboarding state is still loading", () => {
    expect(
      resolveRootRedirect({
        isAuthenticated: true,
        isLoading: true,
        onboardingLoaded: true,
        onboardingCompleted: true,
        firstSegment: undefined,
      })
    ).toBeNull();

    expect(
      resolveRootRedirect({
        isAuthenticated: true,
        isLoading: false,
        onboardingLoaded: false,
        onboardingCompleted: false,
        firstSegment: "auth",
      })
    ).toBeNull();
  });

  it("routes authenticated users without completed onboarding to onboarding", () => {
    expect(
      resolveRootRedirect({
        isAuthenticated: true,
        isLoading: false,
        onboardingLoaded: true,
        onboardingCompleted: false,
        firstSegment: "auth",
      })
    ).toBe("/onboarding");

    expect(
      resolveRootRedirect({
        isAuthenticated: true,
        isLoading: false,
        onboardingLoaded: true,
        onboardingCompleted: false,
        firstSegment: undefined,
      })
    ).toBe("/onboarding");
  });

  it("routes authenticated users with completed onboarding to tabs", () => {
    expect(
      resolveRootRedirect({
        isAuthenticated: true,
        isLoading: false,
        onboardingLoaded: true,
        onboardingCompleted: true,
        firstSegment: "auth",
      })
    ).toBe("/(tabs)");

    expect(
      resolveRootRedirect({
        isAuthenticated: true,
        isLoading: false,
        onboardingLoaded: true,
        onboardingCompleted: true,
        firstSegment: "onboarding",
      })
    ).toBe("/(tabs)");

    expect(
      resolveRootRedirect({
        isAuthenticated: true,
        isLoading: false,
        onboardingLoaded: true,
        onboardingCompleted: true,
        firstSegment: undefined,
      })
    ).toBe("/(tabs)");
  });

  it("keeps valid routes unchanged", () => {
    expect(
      resolveRootRedirect({
        isAuthenticated: false,
        isLoading: false,
        onboardingLoaded: false,
        onboardingCompleted: false,
        firstSegment: "auth",
      })
    ).toBeNull();

    expect(
      resolveRootRedirect({
        isAuthenticated: true,
        isLoading: false,
        onboardingLoaded: true,
        onboardingCompleted: false,
        firstSegment: "onboarding",
      })
    ).toBeNull();

    expect(
      resolveRootRedirect({
        isAuthenticated: true,
        isLoading: false,
        onboardingLoaded: true,
        onboardingCompleted: true,
        firstSegment: "(tabs)",
      })
    ).toBeNull();
  });
});
