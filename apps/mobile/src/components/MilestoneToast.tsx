import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Zap } from "lucide-react-native";
import { useColors, spacing, radius, typography, shadows } from "../theme";
import type { MilestoneToast } from "../features/milestones/useMilestoneToast";

interface MilestoneToastProps {
  toast: MilestoneToast | null;
}

const MILESTONE_EMOJIS: Record<string, string> = {
  first_deck:    "🎉",
  first_review:  "⭐",
  streak_7:      "🔥",
  streak_30:     "🔥",
  streak_100:    "🏆",
};

export function MilestoneToastView({ toast }: MilestoneToastProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-20);

  useEffect(() => {
    if (toast) {
      opacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.ease) });
      translateY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.back(1.5)) });
    } else {
      opacity.value = withDelay(100, withTiming(0, { duration: 250 }));
      translateY.value = withDelay(100, withTiming(-20, { duration: 250 }));
    }
  }, [toast, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!toast) return null;

  const emoji = MILESTONE_EMOJIS[toast.key] ?? "⚡";

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: 80,
          alignSelf: "center",
          zIndex: 999,
          maxWidth: 320,
        },
        animatedStyle,
      ]}
      pointerEvents="none"
    >
      <View
        style={{
          backgroundColor: colors.warning,
          borderRadius: radius.full ?? 999,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          ...shadows.lg,
        }}
      >
        <Text style={{ fontSize: 18 }}>{emoji}</Text>
        <View>
          <Text style={{ color: colors.textInverse, fontSize: typography.sm, fontWeight: typography.bold }}>
            {t(`lp.milestone.${toast.key}`, { lp: toast.lpGranted })}
          </Text>
        </View>
        <View style={{ backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Zap size={12} color={colors.textInverse} fill={colors.textInverse} />
            <Text style={{ color: colors.textInverse, fontSize: typography.xs, fontWeight: typography.bold }}>
              +{toast.lpGranted}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}
