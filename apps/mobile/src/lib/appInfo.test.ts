import appConfig from "../../app.json";
import {
  APP_MARKETING_NAME,
  APP_PROFILE_LABEL,
  APP_RELEASE_VERSION,
} from "./appInfo";

import { describe, expect, it } from "vitest";

describe("app info", () => {
  it("keeps the displayed release version aligned with Expo config", () => {
    expect(appConfig.expo.version).toBe(APP_RELEASE_VERSION);
    expect(APP_PROFILE_LABEL).toBe(`${APP_MARKETING_NAME} v${APP_RELEASE_VERSION}`);
  });

  it("does not expose the old preview version label", () => {
    expect(APP_PROFILE_LABEL).not.toContain("v0.3.0");
  });
});
