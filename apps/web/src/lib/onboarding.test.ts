import { afterEach, describe, expect, it, vi } from "vitest";
import {
  consumeFreshWelcome,
  decideOnboarding,
  isOnboardingCompleted,
  markOnboardingCompleted,
  rememberFreshWelcome,
} from "./onboarding";

function stubLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
  });
  return store;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("decideOnboarding", () => {
  it("shows the intro only to accounts without a single deck", () => {
    expect(decideOnboarding(0)).toBe("show");
  });

  it("silently marks existing accounts as done — no second sample deck", () => {
    expect(decideOnboarding(1)).toBe("markCompleted");
    expect(decideOnboarding(24)).toBe("markCompleted");
  });
});

describe("completed flag in localStorage", () => {
  it("round-trips through the same key the app uses on device", () => {
    const store = stubLocalStorage();
    expect(isOnboardingCompleted()).toBe(false);
    markOnboardingCompleted();
    expect(store.get("clearn_onboarding_completed")).toBe("true");
    expect(isOnboardingCompleted()).toBe(true);
  });

  it("treats a blocked localStorage as completed, never as a redirect loop", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(isOnboardingCompleted()).toBe(true);
    expect(() => markOnboardingCompleted()).not.toThrow();
  });

  it("reports completed during server-side rendering (no window)", () => {
    expect(isOnboardingCompleted()).toBe(true);
  });
});

describe("fresh-welcome marker in sessionStorage", () => {
  function stubSessionStorage() {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
    });
    return store;
  }

  it("greets freshly only once — consuming clears the marker", () => {
    stubSessionStorage();
    rememberFreshWelcome();
    expect(consumeFreshWelcome()).toBe(true);
    expect(consumeFreshWelcome()).toBe(false);
  });

  it("defaults to the usual greeting without a marker or without storage", () => {
    stubSessionStorage();
    expect(consumeFreshWelcome()).toBe(false);
    vi.unstubAllGlobals();
    expect(consumeFreshWelcome()).toBe(false);
  });
});
