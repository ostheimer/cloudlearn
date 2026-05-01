import { Text, TouchableOpacity, View } from "react-native";
import { radius, shadows, spacing, typography, useColors } from "../theme";

interface AuthPromptCardProps {
  title: string;
  body: string;
  ctaLabel?: string;
  onPress: () => void;
}

export function AuthPromptCard({
  title,
  body,
  ctaLabel = "Anmelden oder registrieren",
  onPress,
}: AuthPromptCardProps) {
  const colors = useColors();

  return (
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
      <View style={{ gap: spacing.sm }}>
        <Text
          style={{
            color: colors.text,
            fontSize: typography.xl,
            fontWeight: typography.bold,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: typography.base,
            lineHeight: 22,
          }}
        >
          {body}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={{
          backgroundColor: colors.primary,
          borderRadius: radius.md,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 14,
        }}
      >
        <Text
          style={{
            color: colors.textInverse,
            fontSize: typography.base,
            fontWeight: typography.bold,
          }}
        >
          {ctaLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
