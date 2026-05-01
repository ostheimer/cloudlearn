export type TrackingPermissionStatus =
  | "unavailable"
  | "undetermined"
  | "granted"
  | "denied";

export type AdPersonalizationPreference =
  | "unknown"
  | "personalized"
  | "non_personalized";

export function shouldPromptForAdPersonalization(
  preference: AdPersonalizationPreference,
  autoPromptCompleted: boolean
): boolean {
  return preference === "unknown" && !autoPromptCompleted;
}

export function isPersonalizedAdsEnabledSnapshot(
  preference: AdPersonalizationPreference,
  permissionStatus: TrackingPermissionStatus,
  platformOS: string
): boolean {
  if (preference !== "personalized") {
    return false;
  }

  if (platformOS !== "ios") {
    return true;
  }

  return permissionStatus === "granted";
}

