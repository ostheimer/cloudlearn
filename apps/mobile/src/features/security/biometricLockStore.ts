import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { create } from "zustand";
import {
  canUseBiometricLock,
  getBiometricLockLabel,
} from "./biometricLockLabels";

const BIOMETRIC_LOCK_STORAGE_KEY = "clearn_biometric_lock_enabled_v1";

type LocalAuthenticationModule = typeof import("expo-local-authentication");

interface BiometricAvailability {
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: number[];
  label: string;
  canUse: boolean;
}

interface BiometricLockState extends BiometricAvailability {
  enabled: boolean;
  hydrated: boolean;
  unlocked: boolean;
  authenticating: boolean;
  lastError: string | null;
  initialize: () => Promise<void>;
  refreshAvailability: () => Promise<BiometricAvailability>;
  setEnabled: (enabled: boolean) => Promise<boolean>;
  unlock: () => Promise<boolean>;
  lock: () => void;
  clearError: () => void;
  resetAfterSignOut: () => void;
}

const unavailableAvailability: BiometricAvailability = {
  hasHardware: false,
  isEnrolled: false,
  supportedTypes: [],
  label: "Biometrie",
  canUse: false,
};

async function loadLocalAuthentication(): Promise<LocalAuthenticationModule | null> {
  if (Platform.OS === "web") {
    return null;
  }

  try {
    return await import("expo-local-authentication");
  } catch {
    return null;
  }
}

async function readEnabledPreference(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(BIOMETRIC_LOCK_STORAGE_KEY)) === "true";
  } catch {
    return false;
  }
}

async function persistEnabledPreference(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(
      BIOMETRIC_LOCK_STORAGE_KEY,
      enabled ? "true" : "false"
    );
  } catch {
    // Security preference persistence is best-effort; the UI state still updates.
  }
}

function toBiometricErrorMessage(error?: string): string {
  switch (error) {
    case "not_enrolled":
      return "Face ID ist auf diesem Gerät noch nicht eingerichtet.";
    case "not_available":
      return "Face ID ist auf diesem Gerät nicht verfügbar.";
    case "passcode_not_set":
      return "Bitte richte zuerst einen Gerätecode ein.";
    case "lockout":
      return "Face ID ist vorübergehend gesperrt. Nutze den Gerätecode oder versuche es später erneut.";
    case "user_cancel":
    case "system_cancel":
    case "app_cancel":
      return "Entsperren abgebrochen.";
    case "timeout":
      return "Face ID hat zu lange gebraucht. Bitte versuche es erneut.";
    default:
      return "Entsperren fehlgeschlagen. Bitte versuche es erneut.";
  }
}

export const useBiometricLockStore = create<BiometricLockState>()(
  (set, get) => ({
    ...unavailableAvailability,
    enabled: false,
    hydrated: false,
    unlocked: true,
    authenticating: false,
    lastError: null,

    initialize: async () => {
      const [enabled, availability] = await Promise.all([
        readEnabledPreference(),
        get().refreshAvailability(),
      ]);

      set({
        enabled,
        hydrated: true,
        unlocked: !enabled || !availability.canUse,
        lastError: null,
      });
    },

    refreshAvailability: async () => {
      const LocalAuthentication = await loadLocalAuthentication();
      if (!LocalAuthentication) {
        set(unavailableAvailability);
        return unavailableAvailability;
      }

      try {
        const [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          LocalAuthentication.supportedAuthenticationTypesAsync(),
        ]);
        const availability = {
          hasHardware,
          isEnrolled,
          supportedTypes: supportedTypes.map(Number),
          label: getBiometricLockLabel(supportedTypes),
          canUse: canUseBiometricLock({
            hasHardware,
            isEnrolled,
            supportedTypes,
          }),
        };
        set(availability);
        return availability;
      } catch {
        set(unavailableAvailability);
        return unavailableAvailability;
      }
    },

    setEnabled: async (enabled) => {
      if (!enabled) {
        await persistEnabledPreference(false);
        set({
          enabled: false,
          unlocked: true,
          authenticating: false,
          lastError: null,
        });
        return true;
      }

      const availability = await get().refreshAvailability();
      if (!availability.canUse) {
        set({
          enabled: false,
          unlocked: true,
          lastError: availability.hasHardware
            ? "Bitte richte Face ID zuerst in iOS ein."
            : "Face ID ist auf diesem Gerät nicht verfügbar.",
        });
        return false;
      }

      const unlocked = await get().unlock();
      if (!unlocked) {
        return false;
      }

      await persistEnabledPreference(true);
      set({ enabled: true, unlocked: true, lastError: null });
      return true;
    },

    unlock: async () => {
      const state = get();
      const availability = state.canUse
        ? state
        : await get().refreshAvailability();
      if (!availability.canUse) {
        set({
          unlocked: true,
          authenticating: false,
          lastError: null,
        });
        return true;
      }

      const LocalAuthentication = await loadLocalAuthentication();
      if (!LocalAuthentication) {
        set({ unlocked: true, authenticating: false, lastError: null });
        return true;
      }

      set({ authenticating: true, lastError: null });
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "clearn entsperren",
          cancelLabel: "Abbrechen",
          fallbackLabel: "Code verwenden",
          disableDeviceFallback: false,
        });

        if (result.success) {
          set({ unlocked: true, authenticating: false, lastError: null });
          return true;
        }

        set({
          unlocked: false,
          authenticating: false,
          lastError: toBiometricErrorMessage(result.error),
        });
        return false;
      } catch {
        set({
          unlocked: false,
          authenticating: false,
          lastError: toBiometricErrorMessage(),
        });
        return false;
      }
    },

    lock: () => {
      const { enabled, canUse } = get();
      if (enabled && canUse) {
        set({ unlocked: false, lastError: null });
      }
    },

    clearError: () => set({ lastError: null }),

    resetAfterSignOut: () => {
      set({ unlocked: true, authenticating: false, lastError: null });
    },
  })
);
