import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const configPath = "../../react-native.config.js";
const originalVariant = process.env.APP_VARIANT;

function loadNativeConfig(variant: string) {
  process.env.APP_VARIANT = variant;
  const resolvedPath = require.resolve(configPath);
  delete require.cache[resolvedPath];
  return require(configPath) as {
    dependencies?: Record<
      string,
      { platforms?: { ios?: null; android?: null } }
    >;
  };
}

afterEach(() => {
  if (originalVariant === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = originalVariant;
});

describe("native ads autolinking", () => {
  it("excludes Google Mobile Ads from a production build when real ads are disabled", () => {
    const config = loadNativeConfig("production");

    expect(config.dependencies?.["react-native-google-mobile-ads"]?.platforms).toEqual({
      ios: null,
      android: null,
    });
  });

  it("keeps Google Mobile Ads available to preview builds", () => {
    const config = loadNativeConfig("preview");

    expect(config.dependencies?.["react-native-google-mobile-ads"]).toBeUndefined();
  });
});
