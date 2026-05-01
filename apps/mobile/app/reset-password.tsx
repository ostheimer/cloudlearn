import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { toGermanAuthError } from "../src/lib/authErrorMessages";
import {
  clearPendingPasswordRecovery,
  markPasswordRecoverySessionHandled,
} from "../src/lib/passwordRecovery";
import { useSessionStore } from "../src/store/sessionStore";
import { radius, spacing, typography } from "../src/theme";

const brandBackground = "#4F46E5";
const brandSurface = "rgba(15, 23, 42, 0.18)";
const brandBorder = "rgba(255, 255, 255, 0.18)";
const brandText = "#FFFFFF";
const brandTextSecondary = "rgba(255, 255, 255, 0.78)";
const brandTextTertiary = "rgba(255, 255, 255, 0.56)";
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

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const isLoadingSession = useSessionStore((state) => state.isLoading);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const session = useSessionStore((state) => state.session);
  const setSession = useSessionStore((state) => state.setSession);
  const authCode = firstParam(params.code);
  const rawError = firstParam(params.error_description) ?? firstParam(params.error);
  const [exchangingCode, setExchangingCode] = useState(Boolean(authCode));
  const [linkError, setLinkError] = useState<string | null>(
    rawError ? toGermanAuthError(rawError) : null
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    const exchangeRecoveryCode = async () => {
      if (!authCode || isAuthenticated) {
        setExchangingCode(false);
        return;
      }

      setExchangingCode(true);
      const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);
      if (!active) {
        return;
      }

      if (error) {
        setLinkError(toGermanAuthError(error.message));
      } else {
        setSession(data.session);
      }
      setExchangingCode(false);
    };

    void exchangeRecoveryCode();

    return () => {
      active = false;
    };
  }, [authCode, isAuthenticated, setSession]);

  const handleSubmit = async () => {
    if (password.length < 6) {
      Alert.alert("Fehler", "Passwort muss mindestens 6 Zeichen lang sein.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Fehler", "Passwörter stimmen nicht überein.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        Alert.alert("Passwort konnte nicht geändert werden", toGermanAuthError(error.message));
        return;
      }

      await markPasswordRecoverySessionHandled(session);
      await clearPendingPasswordRecovery();
      await supabase.auth.signOut();
      setSession(null);
      router.replace("/auth");

      Alert.alert("Passwort geändert", "Melde dich jetzt mit deinem neuen Passwort an.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    backgroundColor: brandSurface,
    borderWidth: 1,
    borderColor: brandBorder,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: typography.base,
    color: brandText,
  } as const;

  if (isLoadingSession || exchangingCode) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: brandBackground }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={brandText} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: brandBackground }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.xxl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ width: "100%", maxWidth: 440, alignSelf: "center" }}>
            <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
              <Image
                source={require("../assets/brand-mark.png")}
                style={{ width: 140, height: 140 }}
                resizeMode="contain"
              />
              <Text
                style={{
                  color: brandTextSecondary,
                  fontSize: typography.sm,
                  marginTop: spacing.xs,
                }}
              >
                Foto — Flashcards — Wissen
              </Text>
            </View>

            <Text
              style={{
                color: brandText,
                fontSize: typography.xxl,
                fontWeight: typography.bold,
                textAlign: "center",
                marginBottom: spacing.md,
              }}
            >
              Neues Passwort setzen
            </Text>

            {linkError || !isAuthenticated ? (
              <>
                <Text
                  style={{
                    color: brandTextSecondary,
                    fontSize: typography.base,
                    lineHeight: 24,
                    textAlign: "center",
                    marginBottom: spacing.xl,
                  }}
                >
                  {linkError ?? "Der Passwort-Link ist abgelaufen oder wurde bereits verwendet. Bitte fordere einen neuen Link an."}
                </Text>
                <TouchableOpacity
                  onPress={() => router.replace("/auth")}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: brandButtonBackground,
                    borderRadius: radius.md,
                    paddingVertical: 15,
                    alignItems: "center",
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
            ) : (
              <>
                <Text
                  style={{
                    color: brandTextSecondary,
                    fontSize: typography.base,
                    lineHeight: 24,
                    textAlign: "center",
                    marginBottom: spacing.xl,
                  }}
                >
                  Wähle ein neues Passwort für dein clearn-Konto.
                </Text>

                <View style={{ gap: spacing.md }}>
                  <View>
                    <Text
                      style={{
                        color: brandTextSecondary,
                        fontSize: typography.sm,
                        fontWeight: typography.semibold,
                        marginBottom: spacing.xs,
                      }}
                    >
                      Neues Passwort
                    </Text>
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="••••••••"
                      placeholderTextColor={brandTextTertiary}
                      secureTextEntry
                      autoComplete="new-password"
                      textContentType="newPassword"
                      style={inputStyle}
                      returnKeyType="next"
                    />
                  </View>

                  <View>
                    <Text
                      style={{
                        color: brandTextSecondary,
                        fontSize: typography.sm,
                        fontWeight: typography.semibold,
                        marginBottom: spacing.xs,
                      }}
                    >
                      Passwort bestätigen
                    </Text>
                    <TextInput
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="••••••••"
                      placeholderTextColor={brandTextTertiary}
                      secureTextEntry
                      autoComplete="new-password"
                      textContentType="newPassword"
                      style={inputStyle}
                      returnKeyType="go"
                      onSubmitEditing={() => {
                        void handleSubmit();
                      }}
                    />
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      void handleSubmit();
                    }}
                    disabled={submitting}
                    activeOpacity={0.85}
                    style={{
                      backgroundColor: submitting
                        ? "rgba(238, 242, 255, 0.5)"
                        : brandButtonBackground,
                      borderRadius: radius.md,
                      paddingVertical: 15,
                      alignItems: "center",
                      marginTop: spacing.sm,
                    }}
                  >
                    {submitting ? (
                      <ActivityIndicator color={brandButtonText} />
                    ) : (
                      <Text
                        style={{
                          color: brandButtonText,
                          fontSize: typography.base,
                          fontWeight: typography.bold,
                        }}
                      >
                        Passwort speichern
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
