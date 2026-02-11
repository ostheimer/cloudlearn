import { beforeEach, describe, expect, it } from "vitest";
import { useNotificationPreferences } from "./notificationPreferences";

describe("notification preferences", () => {
  beforeEach(() => {
    useNotificationPreferences.setState({
      enabled: true,
      quietHours: { startHour: 22, endHour: 7 }
    });
  });

  it("toggles opt-in and updates quiet hours", () => {
    useNotificationPreferences.getState().setEnabled(false);
    expect(useNotificationPreferences.getState().enabled).toBe(false);

    useNotificationPreferences.getState().setQuietHours({ startHour: 23, endHour: 6 });
    expect(useNotificationPreferences.getState().quietHours).toEqual({ startHour: 23, endHour: 6 });
  });
});
