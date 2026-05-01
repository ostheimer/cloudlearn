import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Shield, Sparkles, Smartphone } from "lucide-react-native";
import {
  useTrackingConsentStore,
  type TrackingPermissionStatus,
} from "../src/features/ads/trackingConsent";
import { radius, shadows, spacing, typography, useColors } from "../src/theme";

function getSystemStatusTranslationKey(status: TrackingPermissionStatus) {
  switch (status) {
    case "granted":
      return "tracking.systemStatusGranted";
    case "denied":
      return "tracking.systemStatusDenied";
    case "undetermined":
      return "tracking.systemStatusUndetermined";
    default:
      return "tracking.systemStatusUnavailable";
  }
}

export default function TrackingPreferencesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useColors();
  const hydrated = useTrackingConsentStore((state) => state.hydrated);
  const preference = useTrackingConsentStore((state) => state.preference);
  const permissionStatus = useTrackingConsentStore(
    (state) => state.permissionStatus
  );
  const initialize = useTrackingConsentStore((state) => state.initialize);
  const refreshPermissionStatus = useTrackingConsentStore(
    (state) => state.refreshPermissionStatus
  );
  const chooseNonPersonalizedAds = useTrackingConsentStore(
    (state) => state.chooseNonPersonalizedAds
  );
  const allowPersonalizedAds = useTrackingConsentStore(
    (state) => state.allowPersonalizedAds
  );
  const personalizedAdsEnabled = useTrackingConsentStore((state) =>
    state.isPersonalizedAdsEnabled()
  );
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!hydrated) {
      void initialize();
      return;
    }

    void refreshPermissionStatus();
  }, [hydrated, initialize, refreshPermissionStatus]);

  const currentModeKey = useMemo(() => {
    if (personalizedAdsEnabled) {
      return "tracking.modePersonalized";
    }
    if (preference === "non_personalized") {
      return "tracking.modeNonPersonalized";
    }
    return "tracking.modeUndecided";
  }, [personalizedAdsEnabled, preference]);

  const handleEnablePersonalizedAds = async () => {
    try {
      setUpdating(true);
      const result = await allowPersonalizedAds();

      if (result.granted) {
        Alert.alert(
          t("tracking.updatedTitle"),
          t("tracking.updatedPersonalizedBody")
        );
        return;
      }

      if (
        Platform.OS === "ios" &&
        result.permissionStatus === "denied" &&
        !result.canAskAgain
      ) {
        Alert.alert(
          t("tracking.permissionBlockedTitle"),
          t("tracking.permissionBlockedBody"),
          [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("tracking.openSettings"),
              onPress: () => {
                void Linking.openSettings();
              },
            },
          ]
        );
        return;
      }

      Alert.alert(
        t("tracking.updatedTitle"),
        t("tracking.updatedNonPersonalizedBody")
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleUseNonPersonalizedAds = async () => {
    try {
      setUpdating(true);
      await chooseNonPersonalizedAds();
      Alert.alert(
        t("tracking.updatedTitle"),
        t("tracking.updatedNonPersonalizedBody")
      );
    } finally {
      setUpdating(false);
    }
  };

  const canOpenSettings =
    Platform.OS === "ios" && permissionStatus === "denied";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          gap: spacing.lg,
          padding: spacing.lg,
          paddingBottom: spacing.xxl,
        }}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <Text
            style={{
              fontSize: typography.xxl,
              fontWeight: typography.bold,
              color: colors.text,
            }}
          >
            {t("tracking.title")}
          </Text>
        </View>

        {!hydrated ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginTop: spacing.xl }}
          />
        ) : (
          <>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.xl,
                padding: spacing.xl,
                borderWidth: 1,
                borderColor: colors.border,
                gap: spacing.md,
                ...shadows.sm,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.lg,
                  backgroundColor: colors.primaryLight,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Sparkles size={22} color={colors.primary} />
              </View>
              <Text
                style={{
                  fontSize: typography.lg,
                  fontWeight: typography.bold,
                  color: colors.text,
                }}
              >
                {t("tracking.currentMode")}
              </Text>
              <Text
                style={{
                  fontSize: typography.base,
                  color: colors.text,
                  fontWeight: typography.semibold,
                }}
              >
                {t(currentModeKey)}
              </Text>
              <Text
                style={{
                  fontSize: typography.sm,
                  color: colors.textSecondary,
                  lineHeight: 20,
                }}
              >
                {t("tracking.explainerBody")}
              </Text>
            </View>

            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                padding: spacing.lg,
                borderWidth: 1,
                borderColor: colors.border,
                gap: spacing.md,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
              >
                <Shield size={18} color={colors.success} />
                <Text
                  style={{
                    fontSize: typography.base,
                    fontWeight: typography.semibold,
                    color: colors.text,
                  }}
                >
                  {t("tracking.systemStatus")}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: typography.base,
                  color: colors.text,
                  fontWeight: typography.semibold,
                }}
              >
                {t(getSystemStatusTranslationKey(permissionStatus))}
              </Text>
              <Text
                style={{
                  fontSize: typography.sm,
                  color: colors.textSecondary,
                  lineHeight: 20,
                }}
              >
                {Platform.OS === "ios"
                  ? t("tracking.iosHint")
                  : t("tracking.nonIosHint")}
              </Text>
            </View>

            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                padding: spacing.lg,
                borderWidth: 1,
                borderColor: colors.border,
                gap: spacing.md,
              }}
            >
              <TouchableOpacity
                onPress={() => {
                  void handleEnablePersonalizedAds();
                }}
                disabled={updating}
                activeOpacity={0.8}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                  opacity: updating ? 0.7 : 1,
                }}
              >
                <Text
                  style={{
                    fontSize: typography.base,
                    fontWeight: typography.bold,
                    color: colors.textInverse,
                    textAlign: "center",
                  }}
                >
                  {t("tracking.enablePersonalized")}
                </Text>
                <Text
                  style={{
                    fontSize: typography.sm,
                    color: "rgba(255,255,255,0.8)",
                    textAlign: "center",
                    marginTop: 6,
                  }}
                >
                  {t("tracking.enablePersonalizedSubtitle")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  void handleUseNonPersonalizedAds();
                }}
                disabled={updating}
                activeOpacity={0.8}
                style={{
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: updating ? 0.7 : 1,
                }}
              >
                <Text
                  style={{
                    fontSize: typography.base,
                    fontWeight: typography.bold,
                    color: colors.text,
                    textAlign: "center",
                  }}
                >
                  {t("tracking.useNonPersonalized")}
                </Text>
                <Text
                  style={{
                    fontSize: typography.sm,
                    color: colors.textSecondary,
                    textAlign: "center",
                    marginTop: 6,
                  }}
                >
                  {t("tracking.useNonPersonalizedSubtitle")}
                </Text>
              </TouchableOpacity>

              {canOpenSettings ? (
                <TouchableOpacity
                  onPress={() => {
                    void Linking.openSettings();
                  }}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: spacing.sm,
                    paddingTop: spacing.xs,
                  }}
                >
                  <Smartphone size={16} color={colors.primary} />
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: typography.sm,
                      fontWeight: typography.semibold,
                    }}
                  >
                    {t("tracking.openSettings")}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
