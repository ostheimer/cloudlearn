import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { create } from "zustand";
import {
  isPersonalizedAdsEnabledSnapshot,
  type AdPersonalizationPreference,
  type TrackingPermissionStatus,
} from "./trackingConsentUtils";
export type {
  AdPersonalizationPreference,
  TrackingPermissionStatus,
} from "./trackingConsentUtils";

const TRACKING_CONSENT_STORAGE_KEY = "clearn_tracking_consent_v1";

interface PersistedTrackingConsentState {
  autoPromptCompleted: boolean;
  preference: AdPersonalizationPreference;
}

export interface TrackingPermissionResult {
  granted: boolean;
  canAskAgain: boolean;
  permissionStatus: TrackingPermissionStatus;
}

interface TrackingConsentState extends PersistedTrackingConsentState {
  hydrated: boolean;
  permissionStatus: TrackingPermissionStatus;
  initialize: () => Promise<void>;
  refreshPermissionStatus: () => Promise<TrackingPermissionResult>;
  chooseNonPersonalizedAds: (options?: {
    markPromptCompleted?: boolean;
  }) => Promise<void>;
  allowPersonalizedAds: (options?: {
    markPromptCompleted?: boolean;
  }) => Promise<TrackingPermissionResult>;
  isPersonalizedAdsEnabled: () => boolean;
}

function normalizePermissionStatus(status: string): TrackingPermissionStatus {
  if (status === "granted") {
    return "granted";
  }
  if (status === "undetermined") {
    return "undetermined";
  }
  return "denied";
}

async function readPersistedState(): Promise<PersistedTrackingConsentState> {
  try {
    const raw = await AsyncStorage.getItem(TRACKING_CONSENT_STORAGE_KEY);
    if (!raw) {
      return { autoPromptCompleted: false, preference: "unknown" };
    }

    const parsed = JSON.parse(raw) as Partial<PersistedTrackingConsentState>;
    const preference =
      parsed.preference === "personalized" ||
      parsed.preference === "non_personalized"
        ? parsed.preference
        : "unknown";

    return {
      autoPromptCompleted: Boolean(parsed.autoPromptCompleted),
      preference,
    };
  } catch {
    return { autoPromptCompleted: false, preference: "unknown" };
  }
}

async function writePersistedState(
  state: PersistedTrackingConsentState
): Promise<void> {
  await AsyncStorage.setItem(
    TRACKING_CONSENT_STORAGE_KEY,
    JSON.stringify(state)
  );
}

async function getTrackingPermissionStatus(): Promise<TrackingPermissionResult> {
  if (Platform.OS !== "ios") {
    return {
      granted: true,
      canAskAgain: true,
      permissionStatus: "unavailable",
    };
  }

  try {
    const TrackingTransparency = await import("expo-tracking-transparency");
    if (!TrackingTransparency.isAvailable()) {
      return {
        granted: false,
        canAskAgain: false,
        permissionStatus: "unavailable",
      };
    }

    const response =
      await TrackingTransparency.getTrackingPermissionsAsync();
    return {
      granted: response.granted,
      canAskAgain: response.canAskAgain,
      permissionStatus: normalizePermissionStatus(response.status),
    };
  } catch {
    return {
      granted: false,
      canAskAgain: false,
      permissionStatus: "unavailable",
    };
  }
}

async function requestTrackingPermission(): Promise<TrackingPermissionResult> {
  if (Platform.OS !== "ios") {
    return {
      granted: true,
      canAskAgain: true,
      permissionStatus: "unavailable",
    };
  }

  try {
    const TrackingTransparency = await import("expo-tracking-transparency");
    if (!TrackingTransparency.isAvailable()) {
      return {
        granted: false,
        canAskAgain: false,
        permissionStatus: "unavailable",
      };
    }

    const response =
      await TrackingTransparency.requestTrackingPermissionsAsync();
    return {
      granted: response.granted,
      canAskAgain: response.canAskAgain,
      permissionStatus: normalizePermissionStatus(response.status),
    };
  } catch {
    return {
      granted: false,
      canAskAgain: false,
      permissionStatus: "unavailable",
    };
  }
}

export const useTrackingConsentStore = create<TrackingConsentState>(
  (set, get) => ({
    hydrated: false,
    autoPromptCompleted: false,
    preference: "unknown",
    permissionStatus: Platform.OS === "ios" ? "undetermined" : "unavailable",

    initialize: async () => {
      const [persisted, permission] = await Promise.all([
        readPersistedState(),
        getTrackingPermissionStatus(),
      ]);

      set({
        hydrated: true,
        autoPromptCompleted: persisted.autoPromptCompleted,
        preference: persisted.preference,
        permissionStatus: permission.permissionStatus,
      });
    },

    refreshPermissionStatus: async () => {
      const permission = await getTrackingPermissionStatus();
      set({ permissionStatus: permission.permissionStatus });
      return permission;
    },

    chooseNonPersonalizedAds: async (options) => {
      const markPromptCompleted = options?.markPromptCompleted ?? true;
      const nextState: PersistedTrackingConsentState = {
        autoPromptCompleted: markPromptCompleted
          ? true
          : get().autoPromptCompleted,
        preference: "non_personalized",
      };

      set(nextState);
      await writePersistedState(nextState);
    },

    allowPersonalizedAds: async (options) => {
      const markPromptCompleted = options?.markPromptCompleted ?? true;
      const currentPermission = await getTrackingPermissionStatus();
      const permission =
        currentPermission.permissionStatus === "undetermined"
          ? await requestTrackingPermission()
          : currentPermission;

      const nextState: PersistedTrackingConsentState = {
        autoPromptCompleted: markPromptCompleted
          ? true
          : get().autoPromptCompleted,
        preference: permission.granted
          ? "personalized"
          : "non_personalized",
      };

      set({
        ...nextState,
        permissionStatus: permission.permissionStatus,
      });
      await writePersistedState(nextState);

      return permission;
    },

    isPersonalizedAdsEnabled: () =>
      isPersonalizedAdsEnabledSnapshot(
        get().preference,
        get().permissionStatus,
        Platform.OS
      ),
  })
);
