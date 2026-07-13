import { useEffect, type ComponentType } from "react";
import { Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Flame, PartyPopper, Star, Trophy, Zap } from "lucide-react-native";
import { useColors, spacing, radius, typography, shadows } from "../theme";
import type { MilestoneToast } from "../features/milestones/useMilestoneToast";

interface MilestoneToastProps {
  toast: MilestoneToast | null;
}

// Drawn icons instead of emoji (house rule: no emojis in the app UI).
const MILESTONE_ICONS: Record<
  string,
  ComponentType<{ size?: number; color?: string }>
> = {
  first_deck:    PartyPopper,
  first_review:  Star,
  streak_7:      Flame,
  streak_30:     Flame,
  streak_100:    Trophy,
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

  const MilestoneIcon = MILESTONE_ICONS[toast.key] ?? Zap;

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
        <MilestoneIcon size={18} color={colors.textInverse} />
        <View>
          <Text style={{ color: colors.textInverse, fontSize: typography.sm, fontWeight: typography.bold }}>
            {t(`lp.milestone.${toast.key}`, { lp: toast.lpGranted })}
          </Text>
        </View>
        <View style={{ backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Zap size={12} color={colors.textInverse} />
            <Text style={{ color: colors.textInverse, fontSize: typography.xs, fontWeight: typography.bold }}>
              +{toast.lpGranted}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}
