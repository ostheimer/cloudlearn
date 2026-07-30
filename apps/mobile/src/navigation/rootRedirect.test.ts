import { describe, expect, it } from "vitest";
import { resolveRootRedirect } from "./rootRedirect";

describe("resolveRootRedirect", () => {
  it("lets unauthenticated users stay in the guest tabs", () => {
    expect(
      resolveRootRedirect({
        isAuthenticated: false,
        isLoading: false,
        onboardingLoaded: false,
        onboardingCompleted: false,
        firstSegment: "(tabs)",
      })
    ).toBeNull();

    expect(
      resolveRootRedirect({
        isAuthenticated: false,
        isLoading: false,
        onboardingLoaded: false,
        onboardingCompleted: false,
        firstSegment: undefined,
      })
    ).toBe("/(tabs)");
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

    expect(
      resolveRootRedirect({
        isAuthenticated: true,
        isLoading: false,
        onboardingLoaded: true,
        onboardingCompleted: false,
        firstSegment: "reset-password",
      })
    ).toBeNull();

    expect(
      resolveRootRedirect({
        isAuthenticated: true,
        isLoading: false,
        onboardingLoaded: true,
        onboardingCompleted: false,
        firstSegment: "auth-callback",
      })
    ).toBeNull();
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

  it("lässt fertige Konten die Einführung erneut ansehen (#609)", () => {
    // Ohne den Merker würde die Regel oben sofort in die Tabs zurückschicken —
    // „Einführung erneut ansehen" im Profil wäre ein Knopf, der nichts tut.
    expect(
      resolveRootRedirect({
        isAuthenticated: true,
        isLoading: false,
        onboardingLoaded: true,
        onboardingCompleted: true,
        firstSegment: "onboarding",
        onboardingReplay: true,
      })
    ).toBeNull();
  });

  it("der Merker gilt nur für die Einführung, nicht für andere Bildschirme (#609)", () => {
    expect(
      resolveRootRedirect({
        isAuthenticated: true,
        isLoading: false,
        onboardingLoaded: true,
        onboardingCompleted: true,
        firstSegment: "auth",
        onboardingReplay: true,
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

    expect(
      resolveRootRedirect({
        isAuthenticated: true,
        isLoading: false,
        onboardingLoaded: true,
        onboardingCompleted: true,
        firstSegment: "auth-callback",
      })
    ).toBeNull();
  });

  it("lässt Gäste die Beispielkarten öffnen (#609)", () => {
    // Würde /demo hier auf /(tabs) umgeleitet, wäre die einzige Sache, die
    // ohne Konto wirklich funktioniert, nicht erreichbar.
    expect(
      resolveRootRedirect({
        isAuthenticated: false,
        isLoading: false,
        onboardingLoaded: false,
        onboardingCompleted: false,
        firstSegment: "demo",
      })
    ).toBeNull();
  });
});
