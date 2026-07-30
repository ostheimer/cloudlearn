import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Alert, Linking, Platform, ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Mail,
  Crown,
  Gift,
  LogOut,
  Bell,
  Clock,
  Moon,
  Sun,
  Trophy,
  Shield,
  CircleHelp,
  FileText,
  SlidersHorizontal,
  Trash2,
  ChevronRight,
  UserRound,
  GraduationCap,
  BookOpen,
} from "lucide-react-native";
import { useSessionStore } from "../../src/store/sessionStore";
import { useOnboardingState } from "../../src/features/onboarding/onboardingState";
import {
  deleteAccount,
  getProfile,
  getSubscriptionStatus,
  updateDisplayName,
  updateGender,
  displayNameErrorKey,
  type Gender,
} from "../../src/lib/api";
import TextPromptModal from "../../src/components/TextPromptModal";
import { APP_PROFILE_LABEL } from "../../src/lib/appInfo";
import { IMPRESSUM_URL, PRIVACY_URL, SUPPORT_URL, TERMS_URL } from "../../src/lib/publicLinks";
import { getSubscriptionManagementUrls } from "../../src/lib/subscriptionManagement";
import {
  useColors,
  useResolvedThemeMode,
  useThemeStore,
  spacing,
  radius,
  typography,
  shadows,
} from "../../src/theme";
import {
  requestNotificationPermissions,
  scheduleDailyReminder,
  cancelDailyReminder,
} from "../../src/lib/notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useBiometricLockStore } from "../../src/features/security/biometricLockStore";

const REMINDER_KEY = "clearn_reminder_enabled";
const REMINDER_HOUR_KEY = "clearn_reminder_hour";

export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const c = useColors();
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const setSystemTheme = useThemeStore((s) => s.setSystem);
  const resolvedThemeMode = useResolvedThemeMode();
  const userId = useSessionStore((state) => state.userId);
  const email = useSessionStore((state) => state.email);
  const signOut = useSessionStore((state) => state.signOut);
  const [tier, setTier] = useState("...");
  const [subExpiresAt, setSubExpiresAt] = useState<string | null>(null);
  const [billingIssueAt, setBillingIssueAt] = useState<string | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(19);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [nameEditVisible, setNameEditVisible] = useState(false);
  const [gender, setGender] = useState<Gender | null>(null);
  const [genderBusy, setGenderBusy] = useState(false);
  const isGuest = !userId;
  const startOnboardingReplay = useOnboardingState((state) => state.startReplay);
  const biometricEnabled = useBiometricLockStore((state) => state.enabled);
  const biometricCanUse = useBiometricLockStore((state) => state.canUse);
  const biometricHasHardware = useBiometricLockStore(
    (state) => state.hasHardware
  );
  const biometricLabel = useBiometricLockStore((state) => state.label);
  const refreshBiometricAvailability = useBiometricLockStore(
    (state) => state.refreshAvailability
  );
  const setBiometricLockEnabled = useBiometricLockStore(
    (state) => state.setEnabled
  );

  useEffect(() => {
    if (!userId) return;
    getSubscriptionStatus()
      .then((res) => {
        setTier(res.status.tier);
        setSubExpiresAt(res.status.expiresAt ?? null);
        setBillingIssueAt(res.status.billingIssueAt ?? null);
      })
      .catch(() => setTier("unbekannt"));
    getProfile()
      .then((p) => {
        setDisplayName(p.displayName);
        setGender(p.gender ?? null);
      })
      .catch(() => {
        /* Zeile zeigt dann den Platzhalter; Ändern geht trotzdem. */
      });
  }, [userId]);

  const handleNameSave = async (value: string) => {
    try {
      const res = await updateDisplayName(value);
      setDisplayName(res.displayName);
      setNameEditVisible(false);
    } catch (error) {
      // Blatt bleibt offen, der Wert steht noch im Feld — nur erklären, warum.
      Alert.alert(t("displayName.errorTitle"), t(displayNameErrorKey(error)));
    }
  };

  const handleGenderSelect = async (value: Gender) => {
    if (genderBusy || value === gender) return;
    const previous = gender;
    setGender(value);
    setGenderBusy(true);
    try {
      await updateGender(value);
    } catch {
      setGender(previous);
      Alert.alert(t("gender.errorTitle"), t("gender.errorGeneric"));
    } finally {
      setGenderBusy(false);
    }
  };

  useEffect(() => {
    AsyncStorage.getItem(REMINDER_KEY).then((val) => {
      if (val === "true") setReminderEnabled(true);
    });
    AsyncStorage.getItem(REMINDER_HOUR_KEY).then((val) => {
      if (val) setReminderHour(parseInt(val, 10));
    });
  }, []);

  useEffect(() => {
    void refreshBiometricAvailability();
  }, [refreshBiometricAvailability]);

  const openExternalLink = async (url: string, label: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        t("profile.linkOpenErrorTitle"),
        t("profile.linkOpenErrorBody", { label })
      );
    }
  };

  const openSubscriptionManagement = async () => {
    const urls = getSubscriptionManagementUrls(Platform.OS);

    if (urls.length === 0) {
      router.push("/paywall");
      return;
    }

    for (const url of urls) {
      try {
        await Linking.openURL(url);
        return;
      } catch {
        // Try the next store URL before showing a hard error.
      }
    }

    Alert.alert(
      t("profile.subscriptionManageErrorTitle"),
      t("profile.subscriptionManageErrorBody")
    );
  };

  const performAccountDeletion = () => {
    Alert.alert(
      t("profile.deleteAccountFinalTitle"),
      t("profile.deleteAccountFinalBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingAccount(true);
              const result = await deleteAccount();
              Alert.alert(
                t("profile.deleteAccountSuccessTitle"),
                result.warning
                  ? `${result.message}\n\n${result.warning}`
                  : (result.message || t("profile.deleteAccountSuccessBody"))
              );
              await signOut();
            } catch (error) {
              const message = error instanceof Error
                ? error.message
                : t("common.error");
              Alert.alert(t("profile.deleteAccountErrorTitle"), message);
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  const confirmDeleteAccount = () => {
    const warning = [
      t("profile.deleteAccountConfirmBody"),
      tier !== "free" ? t("profile.deleteAccountStoreHint") : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    Alert.alert(
      t("profile.deleteAccountConfirmTitle"),
      warning,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: performAccountDeletion,
        },
      ]
    );
  };

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

  const toggleBiometricLock = async (value: boolean) => {
    if (isGuest) {
      Alert.alert(
        "Login erforderlich",
        "Melde dich an, damit clearn deine App danach lokal mit Face ID schützen kann.",
        [
          { text: "Abbrechen", style: "cancel" },
          { text: "Anmelden", onPress: () => router.push("/auth") },
        ]
      );
      return;
    }

    if (value) {
      const availability = await refreshBiometricAvailability();
      if (!availability.canUse) {
        Alert.alert(
          `${biometricLabel} nicht verfügbar`,
          availability.hasHardware
            ? `Bitte richte ${biometricLabel} zuerst in iOS ein.`
            : `${biometricLabel} wird auf diesem Gerät nicht unterstützt.`
        );
        return;
      }
    }

    const changed = await setBiometricLockEnabled(value);
    if (!changed) {
      const message =
        useBiometricLockStore.getState().lastError ??
        `${biometricLabel} konnte nicht aktiviert werden.`;
      Alert.alert(`${biometricLabel} nicht aktiviert`, message);
    }
  };

  const tierLabel = isGuest
    ? "Gast"
    : tier === "free"
      ? "Free"
      : tier === "pro"
        ? "Pro"
        : tier === "lifetime"
          ? "Lifetime"
          : tier;
  const isFreeTier = tier === "free";
  const isProTier = tier === "pro";
  const isDark = resolvedThemeMode === "dark";
  const isSystemMode = themeMode === "system";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl }}
      >
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
              }}>{isGuest ? "Status" : "E-Mail"}</Text>
              <Text style={{ fontSize: typography.base, fontWeight: typography.medium, color: c.text, marginTop: 2 }}>
                {email ?? "Gastmodus"}
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
              {tier === "lifetime" ? (
                <Text style={{ fontSize: typography.sm, color: c.textSecondary, marginTop: 2 }}>
                  {t("paywall.tierLifetimeHint")}
                </Text>
              ) : null}
              {tier === "pro" && subExpiresAt ? (
                <Text style={{ fontSize: typography.sm, color: c.textSecondary, marginTop: 2 }}>
                  {t("paywall.paidUntil", { date: new Date(subExpiresAt).toLocaleDateString() })}
                </Text>
              ) : null}
              {billingIssueAt ? (
                <View style={{
                  marginTop: spacing.sm,
                  backgroundColor: c.warningLight,
                  borderRadius: radius.sm,
                  paddingHorizontal: spacing.md,
                  paddingVertical: 6,
                }}>
                  <Text style={{ fontSize: typography.sm, color: c.warning }}>
                    {t("profile.billingIssue")}
                  </Text>
                </View>
              ) : null}
              {isGuest ? (
                <TouchableOpacity
                  onPress={() => router.push("/auth")}
                  activeOpacity={0.8}
                  style={{
                    marginTop: spacing.sm,
                    alignSelf: "flex-start",
                    backgroundColor: c.primaryLight,
                    borderRadius: radius.sm,
                    paddingHorizontal: spacing.md,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ color: c.primary, fontSize: typography.sm, fontWeight: typography.semibold }}>
                    Anmelden oder registrieren
                  </Text>
                </TouchableOpacity>
              ) : isFreeTier ? (
                <TouchableOpacity
                  onPress={() => router.push("/paywall")}
                  activeOpacity={0.8}
                  style={{
                    marginTop: spacing.sm,
                    alignSelf: "flex-start",
                    backgroundColor: c.primaryLight,
                    borderRadius: radius.sm,
                    paddingHorizontal: spacing.md,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ color: c.primary, fontSize: typography.sm, fontWeight: typography.semibold }}>
                    {t("paywall.openCta")}
                  </Text>
                </TouchableOpacity>
              ) : isProTier ? (
                <TouchableOpacity
                  onPress={openSubscriptionManagement}
                  activeOpacity={0.8}
                  style={{
                    marginTop: spacing.sm,
                    alignSelf: "flex-start",
                    backgroundColor: c.primaryLight,
                    borderRadius: radius.sm,
                    paddingHorizontal: spacing.md,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ color: c.primary, fontSize: typography.sm, fontWeight: typography.semibold }}>
                    {t("profile.manageSubscription")}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>

        {/* Referral */}
        <TouchableOpacity
          onPress={() => (userId ? router.push("/friend-add") : router.push("/auth"))}
          activeOpacity={0.8}
          style={{
            backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg,
            borderWidth: 1, borderColor: c.border, flexDirection: "row", alignItems: "center",
            gap: spacing.md, ...shadows.sm,
          }}
        >
          <View style={{
            width: 40, height: 40, borderRadius: radius.md,
            backgroundColor: c.successLight ?? c.surfaceSecondary,
            justifyContent: "center", alignItems: "center",
          }}>
            <Gift size={18} color={c.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: c.text }}>
              {t("referral.profileButton")}
            </Text>
            <Text style={{ fontSize: typography.sm, color: c.textSecondary, marginTop: 2 }}>
              {t("referral.profileButtonSubtitle")}
            </Text>
          </View>
          <ChevronRight size={18} color={c.primary} />
        </TouchableOpacity>

        {/* Anzeigename */}
        <TouchableOpacity
          onPress={() => (userId ? setNameEditVisible(true) : router.push("/auth"))}
          activeOpacity={0.8}
          style={{
            backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg,
            borderWidth: 1, borderColor: c.border, flexDirection: "row", alignItems: "center",
            gap: spacing.md, ...shadows.sm,
          }}
        >
          <View style={{
            width: 40, height: 40, borderRadius: radius.md,
            backgroundColor: c.primaryLight,
            justifyContent: "center", alignItems: "center",
          }}>
            <UserRound size={18} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: c.text }}>
              {t("displayName.profileRow")}
            </Text>
            <Text style={{ fontSize: typography.sm, color: c.textSecondary, marginTop: 2 }}>
              {displayName ?? t("displayName.profileRowEmpty")}
            </Text>
          </View>
          <ChevronRight size={18} color={c.primary} />
        </TouchableOpacity>

        {/* Geschlecht — steuert die Wortform bei Freunden (#498) */}
        <View style={{
          backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg,
          borderWidth: 1, borderColor: c.border, gap: spacing.md, ...shadows.sm,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View style={{
              width: 40, height: 40, borderRadius: radius.md,
              backgroundColor: c.primaryLight,
              justifyContent: "center", alignItems: "center",
            }}>
              <UserRound size={18} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: c.text }}>
                {t("gender.profileRow")}
              </Text>
              <Text style={{ fontSize: typography.xs, color: c.textTertiary, marginTop: 2 }}>
                {t("gender.profileRowSubtitle")}
              </Text>
            </View>
          </View>
          {/* Gleiche vier Optionen wie die Registrierung (#609); „Sag ich
              nicht" bekommt wegen der längeren Beschriftung eine eigene Zeile. */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {(["female", "male", "diverse", "prefer_not_to_say"] as const).map((value) => {
              const selected = gender === value;
              const wide = value === "prefer_not_to_say";
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => (userId ? void handleGenderSelect(value) : router.push("/auth"))}
                  disabled={genderBusy}
                  activeOpacity={0.8}
                  style={{
                    ...(wide ? { width: "100%" } : { flex: 1 }),
                    backgroundColor: selected ? c.primary : c.surfaceSecondary,
                    borderRadius: radius.md,
                    paddingVertical: 10,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: selected ? c.textInverse : c.textSecondary, fontWeight: typography.semibold }}>
                    {t(`gender.${value}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Leaderboard */}
        <TouchableOpacity
          onPress={() => (userId ? router.push("/leaderboard") : router.push("/auth"))}
          activeOpacity={0.8}
          style={{
            backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg,
            borderWidth: 1, borderColor: c.border, flexDirection: "row", alignItems: "center",
            gap: spacing.md, ...shadows.sm,
          }}
        >
          <View style={{
            width: 40, height: 40, borderRadius: radius.md,
            backgroundColor: `${c.warning}22`,
            justifyContent: "center", alignItems: "center",
          }}>
            <Trophy size={18} color={c.warning} fill={c.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: c.text }}>
              {t("leaderboard.profileButton")}
            </Text>
            <Text style={{ fontSize: typography.sm, color: c.textSecondary, marginTop: 2 }}>
              {t("leaderboard.profileButtonSubtitle")}
            </Text>
          </View>
          <ChevronRight size={18} color={c.primary} />
        </TouchableOpacity>

        {/* Appearance */}
        <View style={{
          backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg,
          borderWidth: 1, borderColor: c.border, gap: spacing.md, ...shadows.sm,
        }}>
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
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: c.text }}>
                Design
              </Text>
              <Text style={{ fontSize: typography.xs, color: c.textTertiary, marginTop: 2 }}>
                {isSystemMode
                  ? `Folgt System (${isDark ? "Dunkel" : "Hell"})`
                  : isDark
                    ? "Dunkel manuell gewählt"
                    : "Hell manuell gewählt"}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <TouchableOpacity
              onPress={setSystemTheme}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: isSystemMode ? c.primary : c.surfaceSecondary,
                borderRadius: radius.md,
                paddingVertical: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ color: isSystemMode ? c.textInverse : c.textSecondary, fontWeight: typography.semibold }}>
                System
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setThemeMode("light")}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: !isSystemMode && !isDark ? c.primary : c.surfaceSecondary,
                borderRadius: radius.md,
                paddingVertical: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ color: !isSystemMode && !isDark ? c.textInverse : c.textSecondary, fontWeight: typography.semibold }}>
                Hell
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setThemeMode("dark")}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: !isSystemMode && isDark ? c.primary : c.surfaceSecondary,
                borderRadius: radius.md,
                paddingVertical: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ color: !isSystemMode && isDark ? c.textInverse : c.textSecondary, fontWeight: typography.semibold }}>
                Dunkel
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Local security */}
        <View style={{
          backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg,
          borderWidth: 1, borderColor: c.border, gap: spacing.md, ...shadows.sm,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 }}>
              <View style={{
                width: 40, height: 40, borderRadius: radius.md,
                backgroundColor: biometricEnabled ? c.primaryLight : c.surfaceSecondary,
                justifyContent: "center", alignItems: "center",
              }}>
                <Shield size={18} color={biometricEnabled ? c.primary : c.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: c.text }}>
                  Mit {biometricLabel} entsperren
                </Text>
                <Text style={{ fontSize: typography.xs, color: c.textTertiary, marginTop: 2 }}>
                  {isGuest
                    ? "Nach dem Login kannst du clearn lokal schützen."
                    : biometricCanUse
                      ? "Sperrt clearn beim Öffnen und nach App-Wechseln. Deine Session bleibt sicher auf dem Gerät."
                      : biometricHasHardware
                        ? `${biometricLabel} ist noch nicht in iOS eingerichtet.`
                        : `${biometricLabel} ist auf diesem Gerät nicht verfügbar.`}
                </Text>
              </View>
            </View>
            <Switch
              value={!isGuest && biometricEnabled}
              onValueChange={(value) => {
                void toggleBiometricLock(value);
              }}
              disabled={isGuest || !biometricCanUse}
              trackColor={{ false: c.surfaceSecondary, true: c.primaryLight }}
              thumbColor={biometricEnabled ? c.primary : c.textTertiary}
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

        {/* #609: Die Einführung war nach dem ersten Start nicht mehr erreichbar —
            `reset` gab es im Zustand, aber kein Bedienelement dafür. Beim
            zweiten Ansehen entsteht kein weiteres Beispiel-Deck (replay). */}
        {!isGuest && (
          <TouchableOpacity
            onPress={() => {
              startOnboardingReplay();
              router.push("/onboarding");
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            style={{
              backgroundColor: c.surface,
              borderRadius: radius.lg,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: c.border,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              ...shadows.sm,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: c.primaryLight,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <GraduationCap size={18} color={c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: typography.base,
                    fontWeight: typography.semibold,
                    color: c.text,
                  }}
                >
                  {t("onboarding.replay")}
                </Text>
                <Text style={{ fontSize: typography.xs, color: c.textTertiary, marginTop: 2 }}>
                  {t("onboarding.replayHint")}
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={c.textTertiary} />
          </TouchableOpacity>
        )}

        {/* Language switcher intentionally hidden: many screens are still
            hard-wired German (#213), so an English toggle would only deliver
            a half-translated app. Bring it back once i18n is complete. */}

        <View
          style={{
            backgroundColor: c.surface,
            borderRadius: radius.lg,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: c.border,
            gap: spacing.md,
            ...shadows.sm,
          }}
        >
          <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: c.text }}>
            {t("profile.legalSection")}
          </Text>

          {[
            {
              key: "support",
              label: t("profile.support"),
              subtitle: t("profile.supportSubtitle"),
              icon: <CircleHelp size={18} color={c.primary} />,
              iconBg: c.primaryLight,
              url: SUPPORT_URL,
            },
            {
              key: "privacy",
              label: t("profile.privacy"),
              subtitle: t("profile.privacySubtitle"),
              icon: <Shield size={18} color={c.success} />,
              iconBg: c.successLight ?? c.surfaceSecondary,
              url: PRIVACY_URL,
            },
            {
              key: "tracking",
              label: t("profile.tracking"),
              subtitle: t("profile.trackingSubtitle"),
              icon: <SlidersHorizontal size={18} color={c.primary} />,
              iconBg: c.primaryLight,
              route: "/tracking-preferences",
            },
            // Papierkorb (#614) — Gegenstück zur Profil-Zeile im Web.
            {
              key: "trash",
              label: t("profile.trash"),
              subtitle: t("profile.trashSubtitle"),
              icon: <Trash2 size={18} color={c.primary} />,
              iconBg: c.primaryLight,
              route: "/trash",
            },
            {
              key: "impressum",
              label: t("profile.impressum"),
              subtitle: t("profile.impressumSubtitle"),
              icon: <FileText size={18} color={c.warning} />,
              iconBg: `${c.warning}22`,
              url: IMPRESSUM_URL,
            },
            {
              key: "terms",
              label: t("profile.terms"),
              subtitle: t("profile.termsSubtitle"),
              icon: <BookOpen size={18} color={c.primary} />,
              iconBg: c.primaryLight,
              url: TERMS_URL,
            },
          ].map((item, index, items) => (
            <View key={item.key}>
              <TouchableOpacity
                onPress={() => {
                  if ("route" in item && item.route) {
                    router.push(item.route);
                    return;
                  }
                  if ("url" in item && item.url) {
                    void openExternalLink(item.url, item.label);
                  }
                }}
                activeOpacity={0.8}
                style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.md,
                    backgroundColor: item.iconBg,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  {item.icon}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: c.text }}>
                    {item.label}
                  </Text>
                  <Text style={{ fontSize: typography.sm, color: c.textSecondary, marginTop: 2 }}>
                    {item.subtitle}
                  </Text>
                </View>
                <ChevronRight size={18} color={c.primary} />
              </TouchableOpacity>
              {index < items.length - 1 ? <View style={{ height: 1, backgroundColor: c.borderLight, marginTop: spacing.md }} /> : null}
            </View>
          ))}
        </View>

        {userId ? (
          <>
            <TouchableOpacity
              onPress={confirmDeleteAccount}
              activeOpacity={0.8}
              disabled={deletingAccount}
              style={{
                backgroundColor: c.errorLight,
                borderRadius: radius.lg,
                padding: spacing.lg,
                borderWidth: 1,
                borderColor: "rgba(239,68,68,0.24)",
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                opacity: deletingAccount ? 0.7 : 1,
                ...shadows.sm,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: "rgba(239,68,68,0.12)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Trash2 size={18} color={c.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: c.error }}>
                  {deletingAccount ? t("profile.deleteAccountBusy") : t("profile.deleteAccount")}
                </Text>
                <Text style={{ fontSize: typography.sm, color: c.error, marginTop: 2 }}>
                  {t("profile.deleteAccountSubtitle")}
                </Text>
              </View>
            </TouchableOpacity>

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
          </>
        ) : null}

        <Text style={{ fontSize: typography.xs, color: c.textTertiary, textAlign: "center" }}>
          {APP_PROFILE_LABEL}
        </Text>
      </ScrollView>

      <TextPromptModal
        visible={nameEditVisible}
        title={t("displayName.editTitle")}
        label={t("displayName.label")}
        placeholder={t("displayName.placeholder")}
        initialValue={displayName ?? ""}
        confirmLabel={t("displayName.save")}
        icon={UserRound}
        // Servergrenze aus Etappe 1 (#473) — stoppt schon beim Tippen.
        maxLength={20}
        onCancel={() => setNameEditVisible(false)}
        onSubmit={(value) => {
          void handleNameSave(value);
        }}
      />
    </SafeAreaView>
  );
}
