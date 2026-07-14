import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useTranslation } from "react-i18next";
import { Bell } from "lucide-react-native";
import { useColors, spacing, radius, typography, shadows } from "../theme";
import { enablePushNotifications } from "../lib/notifications";

// Remembered once we've asked, so the rationale never nags a second time.
const ASKED_KEY = "clearn-notif-prompt-asked";

/**
 * One-time, friendly pre-permission prompt. The app previously only ever
 * *checked* notification permission (and so never registered a push token, so
 * no server push ever arrived). This asks at a good moment — explaining why
 * first — and registers the token on grant. Renders nothing once handled.
 */
export function NotificationPermissionPrompt() {
  const colors = useColors();
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if ((await AsyncStorage.getItem(ASKED_KEY)) === "true") return;
        const { status, canAskAgain } = await Notifications.getPermissionsAsync();
        // Already granted (token handled at app start) or permanently denied
        // (we can't re-prompt) → mark done, show nothing.
        if (status === "granted" || (status === "denied" && !canAskAgain)) {
          await AsyncStorage.setItem(ASKED_KEY, "true");
          return;
        }
        if (active) setVisible(true);
      } catch {
        // best-effort — if this fails we simply don't prompt
      }
    })();
    return () => { active = false; };
  }, []);

  const finish = async () => {
    await AsyncStorage.setItem(ASKED_KEY, "true").catch(() => {});
    setVisible(false);
  };

  const handleAllow = async () => {
    setBusy(true);
    try {
      await enablePushNotifications();
    } finally {
      setBusy(false);
      await finish();
    }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={finish}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(15,23,42,0.55)",
          justifyContent: "center",
          alignItems: "center",
          padding: spacing.xl,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 340,
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            padding: spacing.xl,
            alignItems: "center",
            gap: spacing.md,
            ...shadows.lg,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.primaryLight,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Bell size={26} color={colors.primary} />
          </View>
          <Text style={{ fontSize: typography.xl, fontWeight: typography.bold, color: colors.text, textAlign: "center" }}>
            {t("notifPrompt.title")}
          </Text>
          <Text style={{ fontSize: typography.sm, color: colors.textSecondary, textAlign: "center", lineHeight: 20 }}>
            {t("notifPrompt.body")}
          </Text>
          <Pressable
            onPress={handleAllow}
            disabled={busy}
            style={{
              alignSelf: "stretch",
              backgroundColor: colors.primary,
              borderRadius: radius.lg,
              paddingVertical: spacing.md,
              alignItems: "center",
              marginTop: spacing.sm,
            }}
          >
            <Text style={{ color: colors.textInverse, fontSize: typography.base, fontWeight: typography.bold }}>
              {busy ? t("notifPrompt.busy") : t("notifPrompt.allow")}
            </Text>
          </Pressable>
          <Pressable onPress={finish} disabled={busy} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Text style={{ color: colors.textTertiary, fontSize: typography.sm, fontWeight: typography.medium }}>
              {t("notifPrompt.later")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
