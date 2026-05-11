import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const configPath = "../../app.config.js";

const ENV_KEYS = [
  "APP_VARIANT",
  "EXPO_PUBLIC_APP_VARIANT",
  "EXPO_PUBLIC_ADMOB_APP_IOS_ID",
  "EXPO_PUBLIC_ADMOB_APP_ANDROID_ID",
  "EXPO_PUBLIC_ADMOB_REWARDED_IOS_ID",
  "EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_ID",
] as const;

const originalEnv = new Map(
  ENV_KEYS.map((key) => [key, process.env[key]] as const)
);

function resetEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string>> = {}) {
  for (const key of ENV_KEYS) {
    const originalValue = originalEnv.get(key);
    if (originalValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalValue;
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value;
  }
}

function loadAppConfig() {
  const resolvedPath = require.resolve(configPath);
  delete require.cache[resolvedPath];
  return require(configPath) as (input: { config: Record<string, unknown> }) => {
    ios?: { infoPlist?: Record<string, unknown> };
    plugins?: unknown[];
  };
}

afterEach(() => {
  resetEnv();
  delete require.cache[require.resolve(configPath)];
});

describe("app.config", () => {
  it("keeps Google AdMob test app IDs in preview builds", () => {
    resetEnv({ APP_VARIANT: "preview" });

    const createConfig = loadAppConfig();
    const config = createConfig({ config: { ios: {}, plugins: [] } });

    expect(config.ios?.infoPlist?.GADApplicationIdentifier).toBe(
      "ca-app-pub-3940256099942544~1458002511"
    );
    expect(config.plugins).toContainEqual([
      "react-native-google-mobile-ads",
      expect.objectContaining({
        androidAppId: "ca-app-pub-3940256099942544~3347511713",
        iosAppId: "ca-app-pub-3940256099942544~1458002511",
      }),
    ]);
  });

  it("requires production AdMob app IDs before production builds", () => {
    resetEnv({ APP_VARIANT: "production" });

    expect(() => loadAppConfig()).toThrow(
      "EXPO_PUBLIC_ADMOB_APP_IOS_ID is required for production builds"
    );
  });

  it("uses configured production AdMob app IDs for production builds", () => {
    resetEnv({
      APP_VARIANT: "production",
      EXPO_PUBLIC_ADMOB_APP_IOS_ID: "ca-app-pub-1234567890123456~1111111111",
      EXPO_PUBLIC_ADMOB_APP_ANDROID_ID:
        "ca-app-pub-1234567890123456~2222222222",
      EXPO_PUBLIC_ADMOB_REWARDED_IOS_ID:
        "ca-app-pub-1234567890123456/3333333333",
      EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_ID:
        "ca-app-pub-1234567890123456/4444444444",
    });

    const createConfig = loadAppConfig();
    const config = createConfig({ config: { ios: {}, plugins: [] } });

    expect(config.ios?.infoPlist?.GADApplicationIdentifier).toBe(
      "ca-app-pub-1234567890123456~1111111111"
    );
    expect(config.plugins).toContainEqual([
      "react-native-google-mobile-ads",
      expect.objectContaining({
        androidAppId: "ca-app-pub-1234567890123456~2222222222",
        iosAppId: "ca-app-pub-1234567890123456~1111111111",
      }),
    ]);
  });
});
