import { useEffect } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Flame, Sparkles, Trophy, Zap } from "lucide-react-native";
import { useColors, spacing, radius, typography, shadows } from "../theme";
import type { MilestoneToast } from "../features/milestones/useMilestoneToast";

interface Props {
  celebration: MilestoneToast | null;
  onDismiss: () => void;
}

// Streak length behind each milestone key, for the big number in the circle.
const DAYS_FOR_KEY: Record<string, number> = {
  streak_7: 7,
  streak_30: 30,
  streak_100: 100,
};

/**
 * Full-screen celebration for streak milestones (7/30/100). Unlike the small
 * MilestoneToast (used for first_deck/first_review), this is a deliberate
 * "stop and feel good" moment — it waits for a tap instead of auto-dismissing.
 * Rendered only when `celebration` is set; the caller clears it via onDismiss.
 */
export function MilestoneCelebration({ celebration, onDismiss }: Props) {
  const { t } = useTranslation();
  const colors = useColors();

  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);
  const sparkle = useSharedValue(0);

  useEffect(() => {
    if (celebration) {
      opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.ease) });
      scale.value = withSequence(
        withTiming(1.08, { duration: 260, easing: Easing.out(Easing.back(2)) }),
        withTiming(1, { duration: 140 })
      );
      sparkle.value = withDelay(180, withTiming(1, { duration: 480, easing: Easing.out(Easing.ease) }));
    } else {
      opacity.value = 0;
      scale.value = 0.6;
      sparkle.value = 0;
    }
  }, [celebration, opacity, scale, sparkle]);

  const cardStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: sparkle.value,
    transform: [{ scale: 0.6 + sparkle.value * 0.4 }],
  }));

  if (!celebration) return null;

  const days = DAYS_FOR_KEY[celebration.key] ?? 0;
  const isTrophy = celebration.key === "streak_100";

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(15,23,42,0.55)",
          justifyContent: "center",
          alignItems: "center",
          padding: spacing.xl,
        }}
      >
        <Animated.View
          style={[
            {
              width: "100%",
              maxWidth: 340,
              backgroundColor: colors.warningLight,
              borderRadius: radius.xl,
              paddingVertical: spacing.xxl,
              paddingHorizontal: spacing.xl,
              alignItems: "center",
              gap: spacing.md,
              ...shadows.lg,
            },
            cardStyle,
          ]}
        >
          <Animated.View style={[{ flexDirection: "row", gap: spacing.sm }, sparkleStyle]}>
            <Sparkles size={18} color={colors.warning} />
            <Sparkles size={22} color={colors.warning} />
            <Sparkles size={18} color={colors.warning} />
          </Animated.View>

          <Animated.View
            style={[
              {
                width: 108,
                height: 108,
                borderRadius: 54,
                backgroundColor: colors.warning,
                justifyContent: "center",
                alignItems: "center",
                gap: 2,
              },
              circleStyle,
            ]}
          >
            {isTrophy ? (
              <Trophy size={28} color={colors.textInverse} />
            ) : (
              <Flame size={28} color={colors.textInverse} fill={colors.textInverse} />
            )}
            <Text style={{ fontSize: 30, fontWeight: typography.extrabold, color: colors.textInverse, lineHeight: 32 }}>
              {days}
            </Text>
          </Animated.View>

          <Text style={{ fontSize: typography.xl, fontWeight: typography.bold, color: colors.text, textAlign: "center" }}>
            {t("streakCelebrate.title", { days })}
          </Text>
          <Text style={{ fontSize: typography.sm, color: colors.textSecondary, textAlign: "center" }}>
            {t("streakCelebrate.subtitle")}
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: colors.surface,
              borderRadius: radius.full,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
            }}
          >
            <Zap size={16} color={colors.warning} />
            <Text style={{ fontSize: typography.base, fontWeight: typography.bold, color: colors.warning }}>
              +{celebration.lpGranted} LP
            </Text>
          </View>

          <Pressable
            onPress={onDismiss}
            style={{
              marginTop: spacing.sm,
              backgroundColor: colors.warning,
              borderRadius: radius.lg,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.xxl,
              alignSelf: "stretch",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: typography.base, fontWeight: typography.bold, color: colors.textInverse }}>
              {t("streakCelebrate.cta")}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}
