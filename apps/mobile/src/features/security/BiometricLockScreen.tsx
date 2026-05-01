import { ActivityIndicator, Image, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LockKeyhole } from "lucide-react-native";
import { radius, spacing, typography } from "../../theme";

const brandBackground = "#4F46E5";
const brandSurface = "rgba(15, 23, 42, 0.18)";
const brandBorder = "rgba(255, 255, 255, 0.18)";
const brandText = "#FFFFFF";
const brandTextSecondary = "rgba(255, 255, 255, 0.78)";
const brandButtonBackground = "#EEF2FF";
const brandButtonText = "#312E81";

interface BiometricLockScreenProps {
  label: string;
  authenticating: boolean;
  lastError: string | null;
  onUnlock: () => void;
  onSignOut: () => void;
}

export function BiometricLockScreen({
  label,
  authenticating,
  lastError,
  onUnlock,
  onSignOut,
}: BiometricLockScreenProps) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: brandBackground }}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: spacing.xl,
        }}
      >
        <View style={{ alignItems: "center", marginBottom: spacing.xxxl }}>
          <Image
            source={require("../../../assets/brand-mark.png")}
            style={{ width: 148, height: 148 }}
            resizeMode="contain"
          />
          <Text
            style={{
              color: brandTextSecondary,
              fontSize: typography.base,
              marginTop: spacing.xs,
            }}
          >
            Foto — Flashcards — Wissen
          </Text>
        </View>

        <View
          style={{
            backgroundColor: brandSurface,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: brandBorder,
            padding: spacing.xl,
            gap: spacing.lg,
          }}
        >
          <View style={{ alignItems: "center", gap: spacing.md }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: radius.lg,
                backgroundColor: "rgba(255, 255, 255, 0.14)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LockKeyhole size={24} color={brandText} />
            </View>
            <Text
              style={{
                color: brandText,
                fontSize: typography.xxl,
                fontWeight: typography.bold,
                textAlign: "center",
              }}
            >
              clearn ist gesperrt
            </Text>
            <Text
              style={{
                color: brandTextSecondary,
                fontSize: typography.base,
                lineHeight: 22,
                textAlign: "center",
              }}
            >
              Entsperre die App lokal mit {label}, um deine Lernstände und
              Decks zu öffnen.
            </Text>
          </View>

          {lastError ? (
            <Text
              style={{
                color: "#FDE68A",
                fontSize: typography.sm,
                lineHeight: 20,
                textAlign: "center",
              }}
            >
              {lastError}
            </Text>
          ) : null}

          <TouchableOpacity
            onPress={onUnlock}
            disabled={authenticating}
            activeOpacity={0.85}
            style={{
              backgroundColor: authenticating
                ? "rgba(238, 242, 255, 0.5)"
                : brandButtonBackground,
              borderRadius: radius.md,
              paddingVertical: 16,
              alignItems: "center",
            }}
          >
            {authenticating ? (
              <ActivityIndicator color={brandButtonText} />
            ) : (
              <Text
                style={{
                  color: brandButtonText,
                  fontSize: typography.lg,
                  fontWeight: typography.bold,
                }}
              >
                Mit {label} entsperren
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onSignOut}
            disabled={authenticating}
            style={{ alignItems: "center", paddingVertical: spacing.xs }}
          >
            <Text
              style={{
                color: brandTextSecondary,
                fontSize: typography.base,
                fontWeight: typography.medium,
              }}
            >
              Abmelden
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
