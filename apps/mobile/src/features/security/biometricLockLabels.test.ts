import { describe, expect, it } from "vitest";
import {
  BIOMETRIC_TYPE_FACIAL_RECOGNITION,
  BIOMETRIC_TYPE_FINGERPRINT,
  BIOMETRIC_TYPE_IRIS,
  canUseBiometricLock,
  getBiometricLockLabel,
} from "./biometricLockLabels";

describe("biometricLockLabels", () => {
  it("prefers Face ID when facial recognition is available", () => {
    expect(
      getBiometricLockLabel([
        BIOMETRIC_TYPE_FINGERPRINT,
        BIOMETRIC_TYPE_FACIAL_RECOGNITION,
      ])
    ).toBe("Face ID");
  });

  it("uses Touch ID for fingerprint-only devices", () => {
    expect(getBiometricLockLabel([BIOMETRIC_TYPE_FINGERPRINT])).toBe(
      "Touch ID"
    );
  });

  it("falls back to generic biometrics for unknown biometric types", () => {
    expect(getBiometricLockLabel([BIOMETRIC_TYPE_IRIS])).toBe("Biometrie");
  });

  it("requires hardware, enrollment and at least one supported biometric type", () => {
    expect(
      canUseBiometricLock({
        hasHardware: true,
        isEnrolled: true,
        supportedTypes: [BIOMETRIC_TYPE_FACIAL_RECOGNITION],
      })
    ).toBe(true);
    expect(
      canUseBiometricLock({
        hasHardware: false,
        isEnrolled: true,
        supportedTypes: [BIOMETRIC_TYPE_FACIAL_RECOGNITION],
      })
    ).toBe(false);
    expect(
      canUseBiometricLock({
        hasHardware: true,
        isEnrolled: false,
        supportedTypes: [BIOMETRIC_TYPE_FACIAL_RECOGNITION],
      })
    ).toBe(false);
    expect(
      canUseBiometricLock({
        hasHardware: true,
        isEnrolled: true,
        supportedTypes: [],
      })
    ).toBe(false);
  });
});
