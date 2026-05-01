import { describe, expect, it } from "vitest";
import {
  isPersonalizedAdsEnabledSnapshot,
  shouldPromptForAdPersonalization,
} from "./trackingConsentUtils";

describe("tracking consent helpers", () => {
  it("prompts only while no ad preference has been chosen", () => {
    expect(shouldPromptForAdPersonalization("unknown", false)).toBe(true);
    expect(shouldPromptForAdPersonalization("unknown", true)).toBe(false);
    expect(shouldPromptForAdPersonalization("non_personalized", false)).toBe(
      false
    );
  });

  it("enables personalized ads only for granted iOS consent", () => {
    expect(
      isPersonalizedAdsEnabledSnapshot("personalized", "granted", "ios")
    ).toBe(true);
    expect(
      isPersonalizedAdsEnabledSnapshot("personalized", "denied", "ios")
    ).toBe(false);
    expect(
      isPersonalizedAdsEnabledSnapshot(
        "non_personalized",
        "granted",
        "ios"
      )
    ).toBe(false);
  });

  it("treats non-iOS devices as app-managed for personalization", () => {
    expect(
      isPersonalizedAdsEnabledSnapshot(
        "personalized",
        "unavailable",
        "android"
      )
    ).toBe(true);
    expect(
      isPersonalizedAdsEnabledSnapshot("personalized", "unavailable", "web")
    ).toBe(true);
  });
});
