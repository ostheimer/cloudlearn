import { create } from "zustand";

export interface QuietHours {
  startHour: number;
  endHour: number;
}

interface NotificationPreferencesState {
  enabled: boolean;
  quietHours: QuietHours;
  setEnabled: (enabled: boolean) => void;
  setQuietHours: (quietHours: QuietHours) => void;
}

export const useNotificationPreferences = create<NotificationPreferencesState>((set) => ({
  enabled: true,
  quietHours: { startHour: 22, endHour: 7 },
  setEnabled: (enabled) => set({ enabled }),
  setQuietHours: (quietHours) => set({ quietHours })
}));
