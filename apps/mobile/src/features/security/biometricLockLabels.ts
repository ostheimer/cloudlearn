export const BIOMETRIC_TYPE_FINGERPRINT = 1;
export const BIOMETRIC_TYPE_FACIAL_RECOGNITION = 2;
export const BIOMETRIC_TYPE_IRIS = 3;

export type BiometricAuthenticationType =
  | typeof BIOMETRIC_TYPE_FINGERPRINT
  | typeof BIOMETRIC_TYPE_FACIAL_RECOGNITION
  | typeof BIOMETRIC_TYPE_IRIS;

export function getBiometricLockLabel(types: readonly number[]): string {
  if (types.includes(BIOMETRIC_TYPE_FACIAL_RECOGNITION)) {
    return "Face ID";
  }

  if (types.includes(BIOMETRIC_TYPE_FINGERPRINT)) {
    return "Touch ID";
  }

  return "Biometrie";
}

export function canUseBiometricLock({
  hasHardware,
  isEnrolled,
  supportedTypes,
}: {
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: readonly number[];
}): boolean {
  return hasHardware && isEnrolled && supportedTypes.length > 0;
}
