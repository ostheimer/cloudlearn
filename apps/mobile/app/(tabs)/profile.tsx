import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Mail,
  Crown,
  Globe,
  LogOut,
  Bell,
  Clock,
  Moon,
  Sun,
} from "lucide-react-native";
import { i18n } from "../../src/i18n";
import { useSessionStore } from "../../src/store/sessionStore";
import { getSubscriptionStatus } from "../../src/lib/api";
import { useColors, useThemeStore, spacing, radius, typography, shadows } from "../../src/theme";
import {
  requestNotificationPermissions,
  scheduleDailyReminder,
  cancelDailyReminder,
} from "../../src/lib/notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

const REMINDER_KEY = "clearn_reminder_enabled";
const REMINDER_HOUR_KEY = "clearn_reminder_hour";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const themeMode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const userId = useSessionStore((state) => state.userId);
  const email = useSessionStore((state) => state.email);
  const signOut = useSessionStore((state) => state.signOut);
  const [tier, setTier] = useState("...");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(19);

  useEffect(() => {
    if (!userId) return;
    getSubscriptionStatus(userId)
      .then((res) => setTier(res.status.tier))
      .catch(() => setTier("unbekannt"));
  }, [userId]);

  useEffect(() => {
    AsyncStorage.getItem(REMINDER_KEY).then((val) => {
      if (val === "true") setReminderEnabled(true);
    });
    AsyncStorage.getItem(REMINDER_HOUR_KEY).then((val) => {
      if (val) setReminderHour(parseInt(val, 10));
    });
  }, []);

  const toggleReminder = async (value: boolean) => {
    if (value) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert("Berechtigung benötigt", "Bitte erlaube Benachrichtigungen in den Einstellungen.");
        return;
      }
      await scheduleDailyReminder(reminderHour, 0);
      setReminderEnabled(true);
      await AsyncStorage.setItem(REMINDER_KEY, "true");
    } else {
      await cancelDailyReminder();
      setReminderEnabled(false);
      await AsyncStorage.setItem(REMINDER_KEY, "false");
    }
  };

  const changeReminderHour = () => {
    const hours = [7, 8, 9, 10, 12, 14, 17, 18, 19, 20, 21];
    const options = hours.map((h) => ({
      text: `${h}:00`,
      onPress: async () => {
        setReminderHour(h);
        await AsyncStorage.setItem(REMINDER_HOUR_KEY, String(h));
        if (reminderEnabled) await scheduleDailyReminder(h, 0);
      },
    }));
    Alert.alert("Erinnerungszeit", "Wann möchtest du erinnert werden?", [
      ...options,
      { text: "Abbrechen", style: "cancel" },
    ]);
  };

  const tierLabel = tier === "free" ? "Free" : tier === "pro" ? "Pro" : tier;
  const isDark = themeMode === "dark";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ flex: 1, gap: spacing.lg, padding: spacing.lg }}>
        <Text style={{ fontSize: typography.xxl, fontWeight: typography.bold, color: c.text }}>
          {t("profileTab")}
        </Text>

        {/* Account info card */}
        <View style={{
          backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg,
          borderWidth: 1, borderColor: c.border, gap: spacing.lg, ...shadows.sm,
        }}>
          {/* Email */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View style={{
              width: 40, height: 40, borderRadius: radius.md, backgroundColor: c.primaryLight,
              justifyContent: "center", alignItems: "center",
            }}>
              <Mail size={18} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: typography.xs, color: c.textTertiary, textTransform: "uppercase",
                fontWeight: typography.semibold, letterSpacing: 0.5,
              }}>E-Mail</Text>
              <Text style={{ fontSize: typography.base, fontWeight: typography.medium, color: c.text, marginTop: 2 }}>
                {email ?? "—"}
              </Text>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: c.borderLight }} />

          {/* Subscription */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View style={{
              width: 40, height: 40, borderRadius: radius.md, backgroundColor: c.warningLight,
              justifyContent: "center", alignItems: "center",
            }}>
              <Crown size={18} color={c.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: typography.xs, color: c.textTertiary, textTransform: "uppercase",
                fontWeight: typography.semibold, letterSpacing: 0.5,
              }}>Abo-Stufe</Text>
              <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: c.text, marginTop: 2 }}>
                {tierLabel}
              </Text>
            </View>
          </View>
        </View>

        {/* Appearance: Dark Mode Toggle */}
        <View style={{
          backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg,
          borderWidth: 1, borderColor: c.border, ...shadows.sm,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View style={{
                width: 40, height: 40, borderRadius: radius.md,
                backgroundColor: isDark ? c.primaryLight : c.surfaceSecondary,
                justifyContent: "center", alignItems: "center",
              }}>
                {isDark
                  ? <Moon size={18} color={c.primary} />
                  : <Sun size={18} color={c.textTertiary} />}
              </View>
              <View>
                <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: c.text }}>
                  Dark Mode
                </Text>
                <Text style={{ fontSize: typography.xs, color: c.textTertiary, marginTop: 2 }}>
                  {isDark ? "Dunkles Design aktiv" : "Helles Design aktiv"}
                </Text>
              </View>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: c.surfaceSecondary, true: c.primaryLight }}
              thumbColor={isDark ? c.primary : c.textTertiary}
            />
          </View>
        </View>

        {/* Notification settings */}
        <View style={{
          backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg,
          borderWidth: 1, borderColor: c.border, gap: spacing.md, ...shadows.sm,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View style={{
                width: 40, height: 40, borderRadius: radius.md,
                backgroundColor: reminderEnabled ? c.primaryLight : c.surfaceSecondary,
                justifyContent: "center", alignItems: "center",
              }}>
                <Bell size={18} color={reminderEnabled ? c.primary : c.textTertiary} />
              </View>
              <View>
                <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: c.text }}>
                  Tägliche Erinnerung
                </Text>
                <Text style={{ fontSize: typography.xs, color: c.textTertiary, marginTop: 2 }}>
                  Erinnert dich ans Lernen
                </Text>
              </View>
            </View>
            <Switch
              value={reminderEnabled}
              onValueChange={toggleReminder}
              trackColor={{ false: c.surfaceSecondary, true: c.primaryLight }}
              thumbColor={reminderEnabled ? c.primary : c.textTertiary}
            />
          </View>
          {reminderEnabled && (
            <>
              <View style={{ height: 1, backgroundColor: c.borderLight }} />
              <TouchableOpacity onPress={changeReminderHour} activeOpacity={0.7}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <View style={{
                    width: 40, height: 40, borderRadius: radius.md,
                    backgroundColor: c.surfaceSecondary, justifyContent: "center", alignItems: "center",
                  }}>
                    <Clock size={18} color={c.textSecondary} />
                  </View>
                  <Text style={{ fontSize: typography.base, color: c.text, fontWeight: typography.medium }}>
                    Uhrzeit
                  </Text>
                </View>
                <Text style={{ fontSize: typography.base, color: c.primary, fontWeight: typography.bold }}>
                  {reminderHour}:00
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Language */}
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs }}>
            <Globe size={16} color={c.textSecondary} />
            <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: c.text }}>
              Sprache
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm + 2 }}>
            {(["de", "en"] as const).map((lang) => {
              const isActive = i18n.language === lang;
              return (
                <TouchableOpacity key={lang} onPress={() => void i18n.changeLanguage(lang)} activeOpacity={0.8}
                  style={{
                    flex: 1, backgroundColor: isActive ? c.primary : c.surface, borderRadius: radius.md,
                    paddingVertical: 14, alignItems: "center", borderWidth: isActive ? 0 : 1, borderColor: c.border,
                  }}
                >
                  <Text style={{
                    color: isActive ? "#fff" : c.text, fontWeight: typography.semibold, fontSize: typography.base,
                  }}>
                    {lang === "de" ? "Deutsch" : "English"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ flex: 1 }} />

        {/* Sign out */}
        <TouchableOpacity onPress={signOut} activeOpacity={0.8}
          style={{
            backgroundColor: c.errorLight, borderRadius: radius.md, paddingVertical: 16,
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
            marginBottom: spacing.md, borderWidth: 1, borderColor: "rgba(239,68,68,0.2)",
          }}
        >
          <LogOut size={18} color={c.error} />
          <Text style={{ color: c.error, fontSize: typography.lg, fontWeight: typography.bold }}>
            {t("signOut")}
          </Text>
        </TouchableOpacity>

        <Text style={{ fontSize: typography.xs, color: c.textTertiary, textAlign: "center" }}>
          clearn.ai v0.3.0
        </Text>
      </View>
    </SafeAreaView>
  );
}
