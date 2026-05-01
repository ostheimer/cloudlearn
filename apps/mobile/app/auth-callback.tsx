import { useEffect, useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSessionStore } from "../src/store/sessionStore";
import { spacing, typography } from "../src/theme";
import { supabase } from "../src/lib/supabase";
import { toGermanAuthError } from "../src/lib/authErrorMessages";
import { consumePendingPasswordRecovery } from "../src/lib/passwordRecovery";

const brandBackground = "#4F46E5";
const brandText = "#FFFFFF";
const brandTextSecondary = "rgba(255, 255, 255, 0.78)";
const brandButtonBackground = "#EEF2FF";
const brandButtonText = "#312E81";

function firstParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && value[0]) {
    return value[0];
  }

  return null;
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const authCode = firstParam(params.code);
  const flowType = firstParam(params.type);
  const rawError = firstParam(params.error_description) ?? firstParam(params.error);
  const hasAuthParams = Boolean(authCode || rawError);

  useEffect(() => {
    let active = true;

    const finishAuthRedirect = async () => {
      const isRecoveryFlow =
        flowType === "recovery" || (await consumePendingPasswordRecovery());

      if (!active) {
        return;
      }

      if (isAuthenticated) {
        router.replace(isRecoveryFlow ? "/reset-password" : "/(tabs)");
        return;
      }

      if (rawError) {
        setErrorMessage(toGermanAuthError(rawError));
        return;
      }

      if (!hasAuthParams || !authCode) {
        setErrorMessage("Der Anmeldelink konnte nicht gelesen werden. Bitte fordere einen neuen Link an.");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(authCode);
      if (!active) {
        return;
      }

      if (error) {
        setErrorMessage(toGermanAuthError(error.message));
        return;
      }

      router.replace(isRecoveryFlow ? "/reset-password" : "/(tabs)");
    };

    void finishAuthRedirect();

    return () => {
      active = false;
    };
  }, [authCode, flowType, hasAuthParams, isAuthenticated, rawError, router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: brandBackground }}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.xxl,
          gap: spacing.lg,
        }}
      >
        <Image
          source={require("../assets/brand-mark.png")}
          style={{ width: 180, height: 180 }}
          resizeMode="contain"
        />
        <ActivityIndicator color={brandText} size="large" />
        <Text
          style={{
            color: brandText,
            fontSize: typography.xl,
            fontWeight: typography.bold,
            textAlign: "center",
          }}
        >
          Anmeldung wird abgeschlossen ...
        </Text>
        {errorMessage ? (
          <>
            <Text
              style={{
                color: brandTextSecondary,
                fontSize: typography.base,
                textAlign: "center",
              }}
            >
              {errorMessage}
            </Text>
            <TouchableOpacity
              onPress={() => router.replace("/auth")}
              activeOpacity={0.85}
              style={{
                backgroundColor: brandButtonBackground,
                borderRadius: 16,
                paddingHorizontal: spacing.xl,
                paddingVertical: spacing.md,
              }}
            >
              <Text
                style={{
                  color: brandButtonText,
                  fontSize: typography.base,
                  fontWeight: typography.bold,
                }}
              >
                Zurück zum Login
              </Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
