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
  "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY",
  "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY",
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
    updates?: { enabled?: boolean };
    runtimeVersion?: { policy?: string };
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

  it("requires production RevenueCat API keys before production builds", () => {
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

    expect(() => loadAppConfig()).toThrow(
      "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY is required for production builds"
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
      EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: "appl_12345678901234567890",
      EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: "goog_12345678901234567890",
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

  // ── Drahtlose Auslieferung (OTA) ────────────────────────────────────────
  //
  // Vorschau-Builds stehen auf runtimeVersion "fingerprint" — genau die
  // Einstellung, an der Build b5263d5e am 16.07. gestorben ist: Der
  // Fingerabdruck löst im pnpm-Monorepo lokal anders auf als auf EAS
  // (expoConfigPlugins zieht @babel/*-Dateien aus dem pnpm-Store), also
  // verweigerte EAS den Build.
  //
  // Heute ist das folgenlos, weil `expo-updates` gar nicht installiert ist:
  // Ohne das Paket läuft die "Configure expo-updates"-Phase nicht. Diese
  // Sicherheit hängt also an einer Abwesenheit — und die kann jemand mit
  // einem einzigen `pnpm add` versehentlich beenden, ohne die Warnung im
  // Kommentar von app.config.js je gelesen zu haben.
  //
  // Vorschau ist der Weg, über den Laras iPhone die App bekommt, und jeder
  // Build kostet ihr Kontingent. Ein fehlgeschlagener Build kostet es
  // genauso. Deshalb steht die Warnung ab hier nicht mehr nur im Kommentar.

  it("schaltet die drahtlose Auslieferung in Vorschau-Builds ab", () => {
    // Ein alter OTA-Stand kann eine neuere native App beim Start abschießen.
    resetEnv({ APP_VARIANT: "preview" });

    const config = loadAppConfig()({ config: { ios: {}, plugins: [] } });

    expect(config.updates?.enabled).toBe(false);
  });

  it("verhindert die Kombination, an der der Build im Juli gestorben ist", () => {
    resetEnv({ APP_VARIANT: "preview" });
    const config = loadAppConfig()({ config: { ios: {}, plugins: [] } });

    const pkg = require("../../package.json") as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const hatExpoUpdates =
      "expo-updates" in (pkg.dependencies ?? {}) ||
      "expo-updates" in (pkg.devDependencies ?? {});

    // Fingerabdruck ist NUR erlaubt, solange expo-updates fehlt. Wer das
    // Paket hinzufügt, muss zuerst das Fingerabdruck-Problem lösen (oder auf
    // "appVersion" wechseln) — sonst verweigert EAS den Build, und zwar erst
    // nach Minuten in der Warteschlange.
    if (config.runtimeVersion?.policy === "fingerprint") {
      expect(
        hatExpoUpdates,
        'expo-updates ist installiert, während Vorschau-Builds auf runtimeVersion "fingerprint" stehen. ' +
          "Genau diese Kombination ließ Build b5263d5e (16.07.) in der Phase " +
          '"Configure expo-updates" scheitern. Erst das Fingerabdruck-Problem lösen ' +
          'oder in app.config.js auf { policy: "appVersion" } wechseln.'
      ).toBe(false);
    }
  });

  it("lässt Produktions-Builds bei der Vorgabe aus app.json", () => {
    // Produktion erbt runtimeVersion/updates aus app.json — dort steht
    // "appVersion". Nur Vorschau weicht bewusst ab.
    resetEnv({
      APP_VARIANT: "production",
      EXPO_PUBLIC_ADMOB_APP_IOS_ID: "ca-app-pub-1234567890123456~1111111111",
      EXPO_PUBLIC_ADMOB_APP_ANDROID_ID: "ca-app-pub-1234567890123456~2222222222",
      EXPO_PUBLIC_ADMOB_REWARDED_IOS_ID: "ca-app-pub-1234567890123456/3333333333",
      EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_ID: "ca-app-pub-1234567890123456/4444444444",
      EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: "appl_12345678901234567890",
      EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: "goog_12345678901234567890",
    });

    const config = loadAppConfig()({
      config: {
        ios: {},
        plugins: [],
        runtimeVersion: { policy: "appVersion" },
        updates: { enabled: true },
      },
    });

    expect(config.runtimeVersion?.policy).toBe("appVersion");
  });
});
