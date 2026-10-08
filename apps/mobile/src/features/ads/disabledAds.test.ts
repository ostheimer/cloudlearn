import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const effects = vi.hoisted(() => ({ setState: vi.fn(), alert: vi.fn() }));
vi.mock("react", () => ({
  useState: () => ["idle", effects.setState],
  useRef: () => ({ current: false }),
  useCallback: (callback: unknown) => callback,
}));
vi.mock("react-native", () => ({
  Platform: { OS: "ios", select: (values: { ios: unknown }) => values.ios },
  Alert: { alert: effects.alert },
  Linking: {},
}));
vi.mock("../../i18n", () => ({ i18n: { t: (key: string) => key } }));
vi.mock("../../store/sessionStore", () => ({ useSessionStore: () => "test-user" }));
vi.mock("./trackingConsent", () => ({ useTrackingConsentStore: {} }));

describe("disabled ads release", () => {
  it.each(["./useRewardedAd", "./useRewardedAd.native"])(
    "%s never simulates a showing ad or waits while ads are disabled",
    async (modulePath) => {
      vi.stubGlobal("__DEV__", false);
      vi.useFakeTimers();
      effects.setState.mockClear();
      effects.alert.mockClear();
      try {
        const { useRewardedAd } = await import(modulePath);
        const result = useRewardedAd().watchAd();
        expect(effects.setState).not.toHaveBeenCalledWith("showing");
        expect(vi.getTimerCount()).toBe(0);
        await expect(result).resolves.toBeNull();
        expect(effects.alert).not.toHaveBeenCalled();
      } finally {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.unstubAllGlobals();
      }
    },
  );

  it("hides both ad entry points while retaining learning as an earn option", () => {
    const modal = readFileSync(new URL("../../components/LpInsufficientModal.tsx", import.meta.url), "utf8");
    const store = readFileSync(new URL("../../../app/lp-store.tsx", import.meta.url), "utf8");
    expect(modal).toContain("{REAL_ADS_ENABLED && showWatchAd ? (");
    expect(store).toContain('{REAL_ADS_ENABLED && tier === "free" && (');
    expect(modal).toContain('t("lp.learnNow")');
    expect(store).toContain('t("lp.earnByLearningTitle")');
  });

  it("keeps tracking preferences without describing disabled ads as active", () => {
    const screen = readFileSync(new URL("../../../app/tracking-preferences.tsx", import.meta.url), "utf8");
    expect(screen).toContain("export default function TrackingPreferencesScreen");
    expect(screen).toContain('if (!REAL_ADS_ENABLED) return "tracking.modeDisabled";');
    expect(screen).toContain('REAL_ADS_ENABLED ? "tracking.explainerBody" : "tracking.adsDisabledBody"');
    expect(screen).toContain("{REAL_ADS_ENABLED ? (");
  });
});
