import { beforeEach, describe, expect, it } from "vitest";
import {
  shouldShowOnboardingForDeckCount,
  useOnboardingState,
} from "./onboardingState";

describe("onboarding state", () => {
  beforeEach(() => {
    useOnboardingState.getState().reset();
  });

  it("advances through steps and can complete", () => {
    useOnboardingState.getState().nextStep();
    useOnboardingState.getState().nextStep();
    expect(useOnboardingState.getState().step).toBe(3);

    useOnboardingState.getState().complete();
    expect(useOnboardingState.getState().completed).toBe(true);
  });

  it("counts four steps since the scan step exists", () => {
    expect(useOnboardingState.getState().totalSteps).toBe(4);
  });

  it("nextStep stops at the last step instead of overshooting", () => {
    for (let i = 0; i < 10; i++) {
      useOnboardingState.getState().nextStep();
    }
    expect(useOnboardingState.getState().step).toBe(4);
  });
});

describe("shouldShowOnboardingForDeckCount", () => {
  it("shows the intro only to accounts without a single deck", () => {
    expect(shouldShowOnboardingForDeckCount(0)).toBe(true);
  });

  it("skips existing accounts — no second sample deck after reinstall", () => {
    expect(shouldShowOnboardingForDeckCount(1)).toBe(false);
    expect(shouldShowOnboardingForDeckCount(24)).toBe(false);
  });
});
