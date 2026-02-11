import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Mail,
  Crown,
  Globe,
  LogOut,
} from "lucide-react-native";
import { i18n } from "../../src/i18n";
import { useSessionStore } from "../../src/store/sessionStore";
import { getSubscriptionStatus } from "../../src/lib/api";
import { colors, spacing, radius, typography, shadows } from "../../src/theme";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const userId = useSessionStore((state) => state.userId);
  const email = useSessionStore((state) => state.email);
  const signOut = useSessionStore((state) => state.signOut);
  const [tier, setTier] = useState("...");

  useEffect(() => {
    if (!userId) return;
    getSubscriptionStatus(userId)
      .then((res) => setTier(res.status.tier))
      .catch(() => setTier("unbekannt"));
  }, [userId]);

  const tierLabel = tier === "free" ? "Free" : tier === "pro" ? "Pro" : tier;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, gap: spacing.lg, padding: spacing.lg }}>
        <Text
          style={{
            fontSize: typography.xxl,
            fontWeight: typography.bold,
            color: colors.text,
          }}
        >
          {t("profileTab")}
        </Text>

        {/* Account info card */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: colors.border,
            gap: spacing.lg,
            ...shadows.sm,
          }}
        >
          {/* Email */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                backgroundColor: colors.primaryLight,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Mail size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: typography.xs,
                  color: colors.textTertiary,
                  textTransform: "uppercase",
                  fontWeight: typography.semibold,
                  letterSpacing: 0.5,
                }}
              >
                E-Mail
              </Text>
              <Text
                style={{
                  fontSize: typography.base,
                  fontWeight: typography.medium,
                  color: colors.text,
                  marginTop: 2,
                }}
              >
                {email ?? "—"}
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: colors.borderLight }} />

          {/* Subscription */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                backgroundColor: colors.warningLight,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Crown size={18} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: typography.xs,
                  color: colors.textTertiary,
                  textTransform: "uppercase",
                  fontWeight: typography.semibold,
                  letterSpacing: 0.5,
                }}
              >
                Abo-Stufe
              </Text>
              <Text
                style={{
                  fontSize: typography.base,
                  fontWeight: typography.semibold,
                  color: colors.text,
                  marginTop: 2,
                }}
              >
                {tierLabel}
              </Text>
            </View>
          </View>
        </View>

        {/* Language section */}
        <View style={{ gap: spacing.sm }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              marginBottom: spacing.xs,
            }}
          >
            <Globe size={16} color={colors.textSecondary} />
            <Text
              style={{
                fontSize: typography.base,
                fontWeight: typography.semibold,
                color: colors.text,
              }}
            >
              Sprache
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm + 2 }}>
            {(["de", "en"] as const).map((lang) => {
              const isActive = i18n.language === lang;
              return (
                <TouchableOpacity
                  key={lang}
                  onPress={() => void i18n.changeLanguage(lang)}
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    backgroundColor: isActive
                      ? colors.primary
                      : colors.surface,
                    borderRadius: radius.md,
                    paddingVertical: 14,
                    alignItems: "center",
                    borderWidth: isActive ? 0 : 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: isActive
                        ? colors.textInverse
                        : colors.text,
                      fontWeight: typography.semibold,
                      fontSize: typography.base,
                    }}
                  >
                    {lang === "de" ? "Deutsch" : "English"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Sign out button */}
        <TouchableOpacity
          onPress={signOut}
          activeOpacity={0.8}
          style={{
            backgroundColor: colors.errorLight,
            borderRadius: radius.md,
            paddingVertical: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
            marginBottom: spacing.md,
            borderWidth: 1,
            borderColor: "rgba(239,68,68,0.2)",
          }}
        >
          <LogOut size={18} color={colors.error} />
          <Text
            style={{
              color: colors.error,
              fontSize: typography.lg,
              fontWeight: typography.bold,
            }}
          >
            {t("signOut")}
          </Text>
        </TouchableOpacity>

        <Text
          style={{
            fontSize: typography.xs,
            color: colors.textTertiary,
            textAlign: "center",
          }}
        >
          clearn.ai v0.1.0
        </Text>
      </View>
    </SafeAreaView>
  );
}
