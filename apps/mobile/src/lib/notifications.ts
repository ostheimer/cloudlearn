import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerPushToken } from "./api";

// Configure notification handler (show even when app is in foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions from the user.
 * Returns true if granted.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return false;
  }

  // Required for Android
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("daily-reminder", {
      name: "Tägliche Erinnerung",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    });
  }

  return true;
}

/**
 * Ask for notification permission (if still undecided) and, when granted,
 * register this device's Expo push token with the backend — so server-sent
 * pushes (friend-streak invites, streak reminders) can actually reach the
 * user. This closes the gap where the app only ever *checked* permission and
 * so never received a push. Returns true if notifications are enabled after.
 */
export async function enablePushNotifications(): Promise<boolean> {
  const granted = await requestNotificationPermissions();
  if (!granted) return false;
  try {
    const token = await Notifications.getExpoPushTokenAsync();
    if (token.data) {
      const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
      await registerPushToken(token.data, platform);
    }
  } catch {
    // Token registration is best-effort; the permission itself is still granted.
  }
  return true;
}

/**
 * Schedule a daily local notification at the given hour/minute.
 * Cancels any existing daily reminders first.
 */
export async function scheduleDailyReminder(
  hour: number,
  minute: number,
  dueCount?: number
): Promise<string | null> {
  // Cancel existing daily reminders
  await cancelDailyReminder();

  const body =
    dueCount && dueCount > 0
      ? `Du hast ${dueCount} fällige Karten. Halte deinen Streak aufrecht!`
      : "Zeit zum Lernen! Halte deinen Streak aufrecht.";

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "clearn — Lernzeit!",
      body,
      sound: "default",
      ...(Platform.OS === "android" && { channelId: "daily-reminder" }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  return id;
}

/**
 * Cancel all scheduled daily reminder notifications.
 */
export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Check if there are any scheduled notifications.
 */
export async function hasScheduledReminder(): Promise<boolean> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.length > 0;
}
