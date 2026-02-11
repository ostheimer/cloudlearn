import { beforeEach, describe, expect, it } from "vitest";
import { useOnboardingState } from "./onboardingState";

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
});
