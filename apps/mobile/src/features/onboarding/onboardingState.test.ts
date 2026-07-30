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

  it("counts five steps since the LP step exists (#609)", () => {
    expect(useOnboardingState.getState().totalSteps).toBe(5);
  });

  it("nextStep stops at the last step instead of overshooting", () => {
    for (let i = 0; i < 10; i++) {
      useOnboardingState.getState().nextStep();
    }
    expect(useOnboardingState.getState().step).toBe(5);
  });

  it("prevStep geht zurück und bleibt bei Schritt 1 stehen (#609)", () => {
    useOnboardingState.getState().nextStep();
    useOnboardingState.getState().nextStep();
    useOnboardingState.getState().prevStep();
    expect(useOnboardingState.getState().step).toBe(2);

    for (let i = 0; i < 10; i++) {
      useOnboardingState.getState().prevStep();
    }
    expect(useOnboardingState.getState().step).toBe(1);
  });
});

describe("Einführung erneut ansehen (#609)", () => {
  beforeEach(() => {
    useOnboardingState.getState().reset();
  });

  it("startReplay beginnt bei Schritt 1 und setzt den Merker", () => {
    useOnboardingState.getState().nextStep();
    useOnboardingState.getState().nextStep();
    useOnboardingState.getState().startReplay();

    expect(useOnboardingState.getState().step).toBe(1);
    expect(useOnboardingState.getState().replay).toBe(true);
  });

  it("startReplay lässt den Haken 'erledigt' in Ruhe — sonst gäbe es ein zweites Beispiel-Deck", () => {
    useOnboardingState.getState().complete();
    useOnboardingState.getState().startReplay();

    expect(useOnboardingState.getState().completed).toBe(true);
  });

  it("endReplay räumt den Merker weg", () => {
    useOnboardingState.getState().startReplay();
    useOnboardingState.getState().endReplay();

    expect(useOnboardingState.getState().replay).toBe(false);
  });

  it("reset räumt den Merker mit weg", () => {
    useOnboardingState.getState().startReplay();
    useOnboardingState.getState().reset();

    expect(useOnboardingState.getState().replay).toBe(false);
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
